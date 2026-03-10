import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studioInterview, studioInterviewSchedule } from '@/lib/db/schema';
import { getInterviewReport, saveInterviewReport } from '@/lib/interview-report-store';
import { buildCandidateInterviewView, sortScheduleEntries } from '@/lib/interview/interview-record';
import { factory } from '@/server/factory';
import { analyzeResumeFile, ResumeAnalysisError } from './analysis';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

async function loadCandidateInterviewRecord(id: string) {
  const [record] = await db.select().from(studioInterview).where(eq(studioInterview.id, id)).limit(1);

  if (!record || record.status === 'archived') {
    return null;
  }

  const scheduleEntries = await db
    .select()
    .from(studioInterviewSchedule)
    .where(eq(studioInterviewSchedule.interviewRecordId, id));

  return buildCandidateInterviewView(record, sortScheduleEntries(scheduleEntries));
}

function buildTokenErrorResponse() {
  return {
    error: 'Missing ELEVENLABS_API_KEY or ELEVENLABS_AGENT_ID in environment variables.',
  };
}

export const interviewRouter = factory.createApp()
  .post('/parse-resume', async (c) => {
    const formData = await c.req.formData();
    const resume = formData.get('resume');

    if (!(resume instanceof File)) {
      return c.json({ error: '缺少简历 PDF 文件。' }, 400);
    }

    try {
      const analysis = await analyzeResumeFile(resume);

      return c.json(analysis);
    }
    catch (error) {
      if (error instanceof ResumeAnalysisError) {
        return c.json(
          {
            error: error.message,
            stage: error.stage,
            ...(error.resumeProfile ? { resumeProfile: error.resumeProfile } : {}),
          },
          500,
        );
      }

      if (error instanceof Error) {
        const status = error.message.includes('PDF') || error.message.includes('10 MB') ? 400 : 500;

        return c.json(
          {
            error: error.message,
            stage: 'resume-parsing',
          },
          status as any,
        );
      }

      return c.json(
        {
          error: 'Failed to analyze resume.',
          stage: 'resume-parsing',
        },
        500,
      );
    }
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
  })
  .get('/:id/token', async (c) => {
    const id = c.req.param('id');
    const interviewRecord = await loadCandidateInterviewRecord(id);

    if (!interviewRecord) {
      return c.json({ error: 'Interview not available.' }, 404);
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    const agentId = process.env.ELEVENLABS_AGENT_ID || process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;

    if (!apiKey || !agentId) {
      return c.json(buildTokenErrorResponse(), 500);
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
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const interviewRecord = await loadCandidateInterviewRecord(id);

    if (!interviewRecord) {
      return c.json({ error: 'Interview not available.' }, 404);
    }

    return c.json(interviewRecord);
  });
