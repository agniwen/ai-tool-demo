import type { Metadata } from 'next';
import { desc } from 'drizzle-orm';
import { InterviewManagementPage } from '@/app/studio/interviews/_components/interview-management-page';
import { db } from '@/lib/db';
import { studioInterview, studioInterviewSchedule } from '@/lib/db/schema';
import { buildInterviewLink, sortScheduleEntries } from '@/lib/interview/interview-record';

export const metadata: Metadata = {
  title: 'AI 面试管理',
};

export default async function StudioInterviewsPage() {
  const records = await db.select().from(studioInterview).orderBy(desc(studioInterview.createdAt));
  const scheduleEntries = records.length > 0
    ? await db.select().from(studioInterviewSchedule)
    : [];

  const initialRecords = records.map(record => ({
    ...record,
    interviewQuestions: record.interviewQuestions ?? [],
    scheduleEntries: sortScheduleEntries(
      scheduleEntries.filter(schedule => schedule.interviewRecordId === record.id),
    ),
    interviewLink: buildInterviewLink(record.id),
  }));

  return <InterviewManagementPage initialRecords={initialRecords} />;
}
