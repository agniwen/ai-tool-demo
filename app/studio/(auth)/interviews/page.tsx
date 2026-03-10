import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { InterviewManagementPage } from '@/app/studio/interviews/_components/interview-management-page';
import { db } from '@/lib/db';
import { studioInterview } from '@/lib/db/schema';

export const metadata: Metadata = {
  title: 'AI 面试管理',
};

export default async function StudioInterviewsPage() {
  const records = await db.select().from(studioInterview).orderBy(desc(studioInterview.createdAt));

  return <InterviewManagementPage initialRecords={records} />;
}
