import type { GeneratedInterviewQuestion, ResumeProfile } from './schema';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { generateText, Output } from 'ai';
import { getInterviewReport, saveInterviewReport } from '@/lib/interview-report-store';
import { factory } from '@/server/factory';
import {
  generatedInterviewQuestionsSchema,
  resumeProfileSchema,
} from './schema';

const MAX_RESUME_FILE_SIZE = 10 * 1024 * 1024;

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

function trimToNull(value: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

function normalizeNumber(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeResumeProfile(profile: ResumeProfile): ResumeProfile {
  return {
    name: profile.name.trim(),
    age: normalizeNumber(profile.age),
    gender: trimToNull(profile.gender),
    targetRoles: uniqueStrings(profile.targetRoles),
    workYears: normalizeNumber(profile.workYears),
    skills: uniqueStrings(profile.skills),
    schools: uniqueStrings(profile.schools),
    workExperiences: profile.workExperiences.map(experience => ({
      company: trimToNull(experience.company),
      role: trimToNull(experience.role),
      period: trimToNull(experience.period),
      summary: trimToNull(experience.summary),
    })),
    projectExperiences: profile.projectExperiences.map(experience => ({
      name: trimToNull(experience.name),
      role: trimToNull(experience.role),
      period: trimToNull(experience.period),
      techStack: uniqueStrings(experience.techStack),
      summary: trimToNull(experience.summary),
    })),
    personalStrengths: uniqueStrings(profile.personalStrengths),
  };
}

function normalizeInterviewQuestions(questions: GeneratedInterviewQuestion[]) {
  return questions.map((question, index) => ({
    order: index + 1,
    difficulty: question.difficulty,
    question: question.question.trim(),
  }));
}

function isPdfFile(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export const interviewRouter = factory.createApp()
  .post('/parse-resume', async (c) => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return c.json(
        {
          error:
            'Missing GOOGLE_GENERATIVE_AI_API_KEY. Please configure your environment variables.',
        },
        500,
      );
    }

    const formData = await c.req.formData();
    const resume = formData.get('resume');

    if (!(resume instanceof File)) {
      return c.json({ error: 'Missing resume PDF file.' }, 400);
    }

    if (!isPdfFile(resume)) {
      return c.json({ error: 'Only PDF resumes are supported.' }, 400);
    }

    if (resume.size > MAX_RESUME_FILE_SIZE) {
      return c.json({ error: 'Resume PDF must be 10MB or smaller.' }, 400);
    }

    const baseURL = process.env.GOOGLE_GENERATIVE_AI_BASE_URL?.trim();
    const provider = createGoogleGenerativeAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
    });
    const modelId = process.env.GOOGLE_MODEL ?? 'gemini-3-flash-preview';
    const pdfBytes = Buffer.from(await resume.arrayBuffer());

    let resumeProfile: ResumeProfile;

    try {
      const { output } = await generateText({
        model: provider(modelId),
        temperature: 0,
        providerOptions: {
          google: {
            structuredOutputs: false,
          },
        },
        output: Output.object({
          schema: resumeProfileSchema,
          name: 'resume_profile',
          description: 'Structured profile extracted from a resume PDF',
        }),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `你是一名简历信息提取助手。请从上传的 PDF 简历中提取候选人信息，并严格输出符合 schema 的 JSON。

提取规则：
1. name 必须是候选人姓名，不能为空，也不要填写学校名、公司名或岗位名。
2. age 只有在简历明确给出时才填写数字，否则返回 null。不要根据毕业年份猜测年龄。
3. gender 只有在简历明确给出时才填写，否则返回 null。
4. targetRoles 可能为多个；如果简历没有明确写求职岗位或求职意向，返回空数组。
5. workYears 只有在简历能明确判断时才返回数字；不能稳定判断时返回 null。
6. skills、schools、personalStrengths 统一返回数组；未知时返回空数组。
7. workExperiences、projectExperiences 统一返回数组；没有则返回空数组。
8. personalStrengths 可以基于简历内容做简要归纳，但必须有简历依据，不要编造。
9. 工作经历和项目经历中的 summary 保持简洁，只保留关键职责、成果或内容。
10. 所有数组字段去重，不要输出重复项。`,
              },
              {
                type: 'file',
                data: pdfBytes,
                mediaType: 'application/pdf',
              },
            ],
          },
        ],
      });

      resumeProfile = normalizeResumeProfile(output);
    }
    catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to extract resume information.',
          stage: 'resume-parsing',
        },
        500,
      );
    }

    try {
      const { output } = await generateText({
        model: provider(modelId),
        temperature: 0.3,
        providerOptions: {
          google: {
            structuredOutputs: false,
          },
        },
        output: Output.object({
          schema: generatedInterviewQuestionsSchema,
          name: 'interview_questions',
          description: 'Ten Chinese interview questions tailored to a candidate resume and target role',
        }),
        prompt: `你是一名技术面试出题助手。请基于下面的候选人简历结构化信息，生成 10 道中文面试题，并严格输出符合 schema 的 JSON。

出题规则：
1. 题目必须与候选人的 targetRoles 高度相关；如果 targetRoles 有多个，优先围绕最核心、最明确的岗位方向出题。
2. 如果 targetRoles 为空，则根据 skills、workExperiences、projectExperiences 推断最可能的岗位方向出题。
3. 题目必须由简入深：
   - 第 1-3 题为 easy，聚焦背景了解、经历澄清、基础能力验证。
   - 第 4-7 题为 medium，聚焦项目细节、技术选型、实现思路、问题排查。
   - 第 8-10 题为 hard，聚焦复杂场景、权衡取舍、系统设计、难点复盘。
4. 优先围绕简历中真实出现过的项目经历、工作经历、技能栈来提问，不要输出泛泛而谈的空洞题目。
5. 不要给答案，不要输出解释，不要重复题目。
6. 只输出 10 道题。

候选人信息：
${JSON.stringify(resumeProfile, null, 2)}`,
      });

      return c.json({
        fileName: resume.name,
        resumeProfile,
        interviewQuestions: normalizeInterviewQuestions(output.interviewQuestions),
      });
    }
    catch (error) {
      return c.json(
        {
          error: error instanceof Error ? error.message : 'Failed to generate interview questions.',
          stage: 'question-generation',
          resumeProfile,
        },
        500,
      );
    }
  })
  .get('/token', async (c) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      return c.json(
        {
          error: 'Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in environment variables.',
        },
        500,
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: {
          'xi-api-key': apiKey,
        },
        method: 'GET',
      },
    );

    if (!response.ok) {
      const bodyText = await response.text();

      return c.json(
        {
          error: 'Failed to generate conversation token.',
          detail: bodyText,
          upstreamStatus: response.status,
        },
        500,
      );
    }

    const data = (await response.json()) as {
      token: string
    };

    return c.json({ token: data.token });
  })
  .post('/webhook', async (c) => {
    const rawBody = await c.req.raw.text();
    const signature = c.req.header('elevenlabs-signature') ?? '';
    const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;

    let event: any;

    try {
      if (webhookSecret) {
        event = await elevenlabs.webhooks.constructEvent(rawBody, signature, webhookSecret);
      }
      else {
        event = JSON.parse(rawBody);
      }
    }
    catch {
      return c.json({ error: 'Invalid webhook payload or signature.' }, 401);
    }

    if (event?.type !== 'post_call_transcription' || !event?.data) {
      return c.json({ received: true });
    }

    const transcript = Array.isArray(event.data.transcript)
      ? event.data.transcript
          .filter((turn: any) => turn?.role === 'agent' || turn?.role === 'user')
          .map((turn: any) => ({
            role: turn.role,
            message: typeof turn.message === 'string' ? turn.message : '',
            timeInCallSecs:
              typeof turn.time_in_call_secs === 'number' ? turn.time_in_call_secs : undefined,
          }))
      : [];

    saveInterviewReport({
      conversationId: event.data.conversation_id,
      agentId: event.data.agent_id,
      status: event.data.status,
      callSuccessful: event.data.analysis?.call_successful,
      transcriptSummary: event.data.analysis?.transcript_summary,
      evaluationCriteriaResults: event.data.analysis?.evaluation_criteria_results ?? {},
      dataCollectionResults: event.data.analysis?.data_collection_results ?? {},
      transcript,
      receivedAt: Date.now(),
    });

    return c.json({ received: true });
  })
  .get('/report/:conversationId', async (c) => {
    const conversationId = c.req.param('conversationId');
    const report = getInterviewReport(conversationId);

    if (!report) {
      return c.json({ error: 'Report not ready.' }, 404);
    }

    return c.json(report);
  });
