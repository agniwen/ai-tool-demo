import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { studioInterview } from '@/lib/db/schema';
import { studioInterviewFormSchema, studioInterviewUpdateSchema } from '@/lib/studio-interviews';
import { factory } from '@/server/factory';
import { analyzeResumeFile, ResumeAnalysisError } from '../interview/analysis';

function toNullableString(value: FormDataEntryValue | null) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}

export const studioInterviewsRouter = factory.createApp()
  .get('/', async (c) => {
    const search = c.req.query('search')?.trim();
    const status = c.req.query('status')?.trim();

    const conditions = [
      search
        ? or(
            ilike(studioInterview.candidateName, `%${search}%`),
            ilike(studioInterview.resumeFileName, `%${search}%`),
            ilike(studioInterview.targetRole, `%${search}%`),
          )
        : undefined,
      status ? eq(studioInterview.status, status as any) : undefined,
    ].filter(Boolean);

    const records = await db
      .select()
      .from(studioInterview)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(studioInterview.createdAt));

    return c.json(records);
  })
  .post('/', async (c) => {
    const formData = await c.req.formData();
    const resume = formData.get('resume');

    if (!(resume instanceof File)) {
      return c.json({ error: '缺少简历 PDF 文件。' }, 400);
    }

    const input = studioInterviewFormSchema.safeParse({
      candidateEmail: toNullableString(formData.get('candidateEmail')) ?? '',
      notes: toNullableString(formData.get('notes')) ?? '',
      status: toNullableString(formData.get('status')) ?? 'ready',
    });

    if (!input.success) {
      return c.json({ error: input.error.issues[0]?.message ?? '表单校验失败。' }, 400);
    }

    try {
      const analysis = await analyzeResumeFile(resume);
      const now = new Date();
      const record = {
        id: crypto.randomUUID(),
        candidateName: analysis.resumeProfile.name,
        candidateEmail: input.data.candidateEmail || null,
        targetRole: analysis.resumeProfile.targetRoles[0] ?? null,
        status: input.data.status,
        resumeFileName: analysis.fileName,
        resumeProfile: analysis.resumeProfile,
        interviewQuestions: analysis.interviewQuestions,
        notes: input.data.notes || null,
        createdBy: c.var.user?.id ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await db.insert(studioInterview).values(record);

      return c.json(record, 201);
    }
    catch (error) {
      if (error instanceof ResumeAnalysisError) {
        return c.json({ error: error.message, stage: error.stage }, 500);
      }

      if (error instanceof Error) {
        const statusCode = error.message.includes('PDF') || error.message.includes('10 MB') ? 400 : 500;
        return c.json({ error: error.message }, statusCode);
      }

      return c.json({ error: '创建面试记录失败。' }, 500);
    }
  })
  .get('/:id', async (c) => {
    const id = c.req.param('id');
    const [record] = await db.select().from(studioInterview).where(eq(studioInterview.id, id)).limit(1);

    if (!record) {
      return c.json({ error: '记录不存在。' }, 404);
    }

    return c.json(record);
  })
  .patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => null);
    const input = studioInterviewUpdateSchema.safeParse(body);

    if (!input.success) {
      return c.json({ error: input.error.issues[0]?.message ?? '表单校验失败。' }, 400);
    }

    const [existing] = await db.select().from(studioInterview).where(eq(studioInterview.id, id)).limit(1);

    if (!existing) {
      return c.json({ error: '记录不存在。' }, 404);
    }

    const [updated] = await db
      .update(studioInterview)
      .set({
        candidateEmail: input.data.candidateEmail || null,
        notes: input.data.notes || null,
        status: input.data.status,
        updatedAt: new Date(),
      })
      .where(eq(studioInterview.id, id))
      .returning();

    return c.json(updated);
  })
  .delete('/:id', async (c) => {
    const id = c.req.param('id');
    const [existing] = await db.select().from(studioInterview).where(eq(studioInterview.id, id)).limit(1);

    if (!existing) {
      return c.json({ error: '记录不存在。' }, 404);
    }

    await db.delete(studioInterview).where(eq(studioInterview.id, id));
    return c.json({ success: true });
  });
