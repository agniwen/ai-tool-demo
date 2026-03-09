import type { Metadata } from 'next';
import InterviewPageClient from '@/app/interview-next/_components/interview-page-client';

export const metadata: Metadata = {
  title: 'AI 面试 Next',
  description: '用于发起 interview-next 语音模拟面试、实时查看追问过程与候选人作答记录。',
};

export default function InterviewPage() {
  return <InterviewPageClient />;
}
