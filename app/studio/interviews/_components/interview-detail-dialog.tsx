'use client';

import type { StudioInterviewRecord } from '@/lib/studio-interviews';
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

export function InterviewDetailDialog({
  open,
  onOpenChange,
  record,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: StudioInterviewRecord | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-4xl overflow-hidden p-0'>
        {record
          ? (
              <>
                <DialogHeader className='border-b px-6 py-5'>
                  <DialogTitle className='flex items-center gap-3'>
                    <span>{record.candidateName}</span>
                    <InterviewStatusBadge status={record.status} />
                  </DialogTitle>
                  <DialogDescription>
                    {record.targetRole ?? '待识别岗位'} · {record.resumeFileName}
                  </DialogDescription>
                </DialogHeader>

                <ScrollArea className='max-h-[calc(90vh-88px)]'>
                  <div className='grid gap-6 px-6 py-6 lg:grid-cols-[0.9fr_1.1fr]'>
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
                            <span>{formatValue(record.resumeProfile.workYears)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>年龄</span>
                            <span>{formatValue(record.resumeProfile.age)}</span>
                          </div>
                          <div className='flex items-center justify-between gap-4'>
                            <span className='text-muted-foreground'>性别</span>
                            <span>{formatValue(record.resumeProfile.gender)}</span>
                          </div>
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>技能与优势</h3>
                        <p className='mt-3 text-muted-foreground text-sm leading-relaxed'>
                          技能：{record.resumeProfile.skills.join('、') || '未发现信息'}
                        </p>
                        <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                          优势：{record.resumeProfile.personalStrengths.join('、') || '未发现信息'}
                        </p>
                        <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                          学校：{record.resumeProfile.schools.join('、') || '未发现信息'}
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
                          {record.interviewQuestions.map(question => (
                            <div className='rounded-xl border border-border/60 bg-muted/30 p-3' key={question.order}>
                              <div className='flex items-center justify-between gap-3'>
                                <span className='font-medium text-sm'>第 {question.order} 题</span>
                                <span className='text-muted-foreground text-xs uppercase'>{question.difficulty}</span>
                              </div>
                              <p className='mt-2 text-sm leading-relaxed'>{question.question}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>工作经历</h3>
                        <div className='mt-4 space-y-4'>
                          {record.resumeProfile.workExperiences.length > 0
                            ? record.resumeProfile.workExperiences.map((item, index) => (
                                <div key={`${item.company ?? 'company'}-${index}`}>
                                  <p className='font-medium text-sm'>
                                    {formatValue(item.company)} · {formatValue(item.role)}
                                  </p>
                                  <p className='mt-1 text-muted-foreground text-xs'>{formatValue(item.period)}</p>
                                  <p className='mt-2 text-sm leading-relaxed'>{formatValue(item.summary)}</p>
                                  {index < record.resumeProfile.workExperiences.length - 1 ? <Separator className='mt-4' /> : null}
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无工作经历。</p>}
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
