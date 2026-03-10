import { z } from 'zod';
import type { ResumeAnalysisResult } from '@/lib/interview/types';

export const studioInterviewStatusValues = ['draft', 'ready', 'in_progress', 'completed', 'archived'] as const;

export const studioInterviewStatusSchema = z.enum(studioInterviewStatusValues);

export const studioInterviewFormSchema = z.object({
  candidateEmail: z.string().trim().email('请输入有效邮箱').or(z.literal('')),
  notes: z.string().trim().max(2000, '备注不能超过 2000 字'),
  status: studioInterviewStatusSchema,
});

export const studioInterviewUpdateSchema = z.object({
  candidateEmail: z.string().trim().email('请输入有效邮箱').or(z.literal('')),
  notes: z.string().trim().max(2000, '备注不能超过 2000 字'),
  status: studioInterviewStatusSchema,
});

export type StudioInterviewStatus = z.infer<typeof studioInterviewStatusSchema>;
export type StudioInterviewFormValues = z.infer<typeof studioInterviewFormSchema>;
export type StudioInterviewUpdateValues = z.infer<typeof studioInterviewUpdateSchema>;

export interface StudioInterviewRecord {
  id: string
  candidateName: string
  candidateEmail: string | null
  targetRole: string | null
  status: StudioInterviewStatus
  resumeFileName: string
  resumeProfile: ResumeAnalysisResult['resumeProfile']
  interviewQuestions: ResumeAnalysisResult['interviewQuestions']
  notes: string | null
  createdBy: string | null
  createdAt: string | Date
  updatedAt: string | Date
}

export const studioInterviewStatusMeta: Record<StudioInterviewStatus, { label: string, tone: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: '草稿', tone: 'outline' },
  ready: { label: '待面试', tone: 'default' },
  in_progress: { label: '进行中', tone: 'secondary' },
  completed: { label: '已完成', tone: 'secondary' },
  archived: { label: '已归档', tone: 'outline' },
};
