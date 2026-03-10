'use client';

import type { StudioInterviewRecord } from '@/lib/studio-interviews';
import { CopyIcon, LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { InterviewStatusBadge } from './interview-status-badge';

function formatValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '未填写';
  }

  return String(value);
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) {
    return '待定';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

function ensureStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter(item => typeof item === 'string' && item.trim().length > 0);
}

function ensureArray<T>(value: unknown) {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function InterviewDetailDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: StudioInterviewRecord | null
}) {
  async function handleCopy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('面试链接已复制');
    }
    catch {
      toast.error('复制失败，请手动复制');
    }
  }

  const scheduleEntries = ensureArray<StudioInterviewRecord['scheduleEntries'][number]>(record?.scheduleEntries);
  const interviewQuestions = ensureArray<StudioInterviewRecord['interviewQuestions'][number]>(record?.interviewQuestions);
  const workExperiences = ensureArray<NonNullable<StudioInterviewRecord['resumeProfile']>['workExperiences'][number]>(record?.resumeProfile?.workExperiences);
  const projectExperiences = ensureArray<NonNullable<StudioInterviewRecord['resumeProfile']>['projectExperiences'][number]>(record?.resumeProfile?.projectExperiences);
  const skills = ensureStringArray(record?.resumeProfile?.skills);
  const personalStrengths = ensureStringArray(record?.resumeProfile?.personalStrengths);
  const schools = ensureStringArray(record?.resumeProfile?.schools);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='max-h-[90vh] max-w-5xl overflow-hidden p-0'>
        {record
          ? (
              <>
                <DialogHeader className='border-b px-6 py-5'>
                  <DialogTitle className='flex items-center gap-3'>
                    <span>{record.candidateName}</span>
                    <InterviewStatusBadge status={record.status} />
                  </DialogTitle>
                  <DialogDescription>
                    {record.targetRole ?? '待识别岗位'}
                    {' · '}
                    {record.resumeFileName ?? '未上传简历'}
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className='max-h-[calc(90vh-88px)]'>
                  <div className='grid gap-6 px-6 py-6 lg:grid-cols-[0.92fr_1.08fr]'>
                    <section className='space-y-6'>
                      <div className='rounded-2xl border border-border/60 bg-muted/30 p-4'>
                        <h3 className='font-medium text-sm'>基础信息</h3>
                        <div className='mt-4 grid gap-3 text-sm'>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>邮箱</span>
                            <span>{formatValue(record.candidateEmail)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>目标岗位</span>
                            <span>{formatValue(record.targetRole)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>工作年限</span>
                            <span>{formatValue(record.resumeProfile?.workYears)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>年龄</span>
                            <span>{formatValue(record.resumeProfile?.age)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>性别</span>
                            <span>{formatValue(record.resumeProfile?.gender)}</span>
                          </div>
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <div className='flex items-center justify-between gap-3'>
                          <h3 className='font-medium text-sm'>面试链接</h3>
                          <Button onClick={() => void handleCopy(new URL(record.interviewLink, window.location.origin).toString())} size='sm' type='button' variant='outline'>
                            <CopyIcon className='size-4' />
                            复制链接
                          </Button>
                        </div>
                        <div className='mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-sm'>
                          <p className='flex items-center gap-2 font-medium'>
                            <LinkIcon className='size-4 text-muted-foreground' />
                            {record.interviewLink}
                          </p>
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>面试安排</h3>
                        <div className='mt-4 space-y-3'>
                          {scheduleEntries.length > 0
                            ? scheduleEntries.map(entry => (
                                <div className='rounded-xl border border-border/60 bg-muted/30 p-3' key={entry.id}>
                                  <div className='flex items-center justify-between gap-3'>
                                    <span className='font-medium text-sm'>{entry.roundLabel}</span>
                                    <span className='text-muted-foreground text-xs'>{formatDateTime(entry.scheduledAt)}</span>
                                  </div>
                                  <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                                    {entry.notes || '暂无轮次备注'}
                                  </p>
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无面试安排。</p>}
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>技能与优势</h3>
                        <p className='mt-3 text-muted-foreground text-sm leading-relaxed'>
                          技能：
                          {skills.join('、') || '未发现信息'}
                        </p>
                        <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                          优势：
                          {personalStrengths.join('、') || '未发现信息'}
                        </p>
                        <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                          学校：
                          {schools.join('、') || '未发现信息'}
                        </p>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>备注</h3>
                        <p className='mt-3 text-muted-foreground text-sm leading-relaxed'>
                          {record.notes || '暂无备注'}
                        </p>
                      </div>
                    </section>

                    <section className='space-y-6'>
                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>AI 面试题</h3>
                        <div className='mt-4 space-y-3'>
                          {interviewQuestions.length > 0
                            ? interviewQuestions.map(question => (
                                <div className='rounded-xl border border-border/60 bg-muted/30 p-3' key={question.order}>
                                  <div className='flex items-center justify-between gap-3'>
                                    <span className='font-medium text-sm'>
                                      第
                                      {question.order}
                                      {' '}
                                      题
                                    </span>
                                    <span className='text-muted-foreground text-xs uppercase'>{question.difficulty}</span>
                                  </div>
                                  <p className='mt-2 text-sm leading-relaxed'>{question.question}</p>
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无面试题，可通过上传简历自动生成。</p>}
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>工作经历</h3>
                        <div className='mt-4 space-y-4'>
                          {workExperiences.length > 0
                            ? workExperiences.map((item, index) => (
                                <div key={`${item.company ?? 'company'}-${index}`}>
                                  <p className='font-medium text-sm'>
                                    {formatValue(item.company)}
                                    {' '}
                                    ·
                                    {formatValue(item.role)}
                                  </p>
                                  <p className='mt-1 text-muted-foreground text-xs'>{formatValue(item.period)}</p>
                                  <p className='mt-2 text-sm leading-relaxed'>{formatValue(item.summary)}</p>
                                  {index < workExperiences.length - 1 ? <Separator className='mt-4' /> : null}
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无工作经历。</p>}
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>项目经历</h3>
                        <div className='mt-4 space-y-4'>
                          {projectExperiences.length > 0
                            ? projectExperiences.map((item, index) => (
                                <div key={`${item.name ?? 'project'}-${index}`}>
                                  <p className='font-medium text-sm'>
                                    {formatValue(item.name)}
                                    {' '}
                                    ·
                                    {formatValue(item.role)}
                                  </p>
                                  <p className='mt-1 text-muted-foreground text-xs'>{formatValue(item.period)}</p>
                                  <p className='mt-2 text-sm leading-relaxed'>{formatValue(item.summary)}</p>
                                  <p className='mt-2 text-muted-foreground text-xs'>
                                    技术栈：
                                    {item.techStack.join('、') || '未发现信息'}
                                  </p>
                                  {index < projectExperiences.length - 1 ? <Separator className='mt-4' /> : null}
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无项目经历。</p>}
                        </div>
                      </div>
                    </section>
                  </div>
                </ScrollArea>
              </>
            )
          : null}
      </DialogContent>
    </Dialog>
  );
}
