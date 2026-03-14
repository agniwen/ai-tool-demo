'use client';

import type { StudioInterviewRecord } from '@/lib/studio-interviews';
import { CopyIcon, LinkIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '待定';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
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

function ensureProjectExperiences(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{
      name?: string | null
      role?: string | null
      period?: string | null
      summary?: string | null
      techStack: string[]
    }>;
  }

  return value
    .filter(item => typeof item === 'object' && item !== null)
    .map((item) => {
      const project = item as Record<string, unknown>;

      return {
        name: typeof project.name === 'string' ? project.name : null,
        role: typeof project.role === 'string' ? project.role : null,
        period: typeof project.period === 'string' ? project.period : null,
        summary: typeof project.summary === 'string' ? project.summary : null,
        techStack: ensureStringArray(project.techStack),
      };
    });
}

function truncateText(value: string | number | null | undefined, maxLength = 320) {
  const text = formatValue(value);

  if (text === '未填写' || text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className='grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3'>
      <span className='pt-0.5 text-muted-foreground'>{label}</span>
      <span className={`min-w-0 break-words text-foreground leading-relaxed ${valueClassName ?? ''}`}>{value}</span>
    </div>
  );
}

export function InterviewDetailDialog({
  open,
  onOpenChange,
  recordId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: string | null
}) {
  const [record, setRecord] = useState<StudioInterviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const closeDialog = useEffectEvent(() => onOpenChange(false));

  useEffect(() => {
    if (!open || !recordId) {
      return;
    }

    const controller = new AbortController();

    async function loadRecord() {
      setIsLoading(true);
      setRecord(null);

      try {
        const response = await fetch(`/api/studio/interviews/${recordId}`, {
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as StudioInterviewRecord | { error?: string } | null;

        if (!response.ok || !payload || 'error' in payload) {
          throw new Error(payload && 'error' in payload ? payload.error ?? '加载详情失败' : '加载详情失败');
        }

        setRecord(payload as StudioInterviewRecord);
      }
      catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setRecord(null);
        toast.error(error instanceof Error ? error.message : '加载详情失败');
        closeDialog();
      }
      finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadRecord();

    return () => controller.abort();
  }, [open, recordId]);

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
  const projectExperiences = ensureProjectExperiences(record?.resumeProfile?.projectExperiences);
  const skills = ensureStringArray(record?.resumeProfile?.skills);
  const personalStrengths = ensureStringArray(record?.resumeProfile?.personalStrengths);
  const schools = ensureStringArray(record?.resumeProfile?.schools);
  const visibleInterviewQuestions = interviewQuestions.slice(0, 20);
  const visibleWorkExperiences = workExperiences.slice(0, 12);
  const visibleProjectExperiences = projectExperiences.slice(0, 12);
  const visibleSkills = skills.slice(0, 40);
  const visiblePersonalStrengths = personalStrengths.slice(0, 20);
  const visibleSchools = schools.slice(0, 20);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='max-h-[90vh] w-[min(96vw,1440px)] max-w-none overflow-hidden p-0 sm:min-w-[1100px]'>
        <DialogHeader className='border-b px-6 py-5'>
          <DialogTitle className='flex flex-wrap items-center gap-3'>
            <span className='break-words'>{record?.candidateName ?? '候选人详情'}</span>
            {record ? <InterviewStatusBadge status={record.status} /> : null}
          </DialogTitle>
          <DialogDescription className='break-words leading-relaxed'>
            {record
              ? (
                  <>
                    {record.targetRole ?? '待识别岗位'}
                    {' · '}
                    {record.resumeFileName ?? '未上传简历'}
                  </>
                )
              : isLoading
                ? '正在加载候选人详情...'
                : '暂无可展示的候选人详情。'}
          </DialogDescription>
        </DialogHeader>

        {isLoading
          ? (
              <div className='flex min-h-[320px] items-center justify-center px-6 py-10 text-muted-foreground text-sm'>
                正在加载候选人详情...
              </div>
            )
          : record
            ? (
                <div className='max-h-[calc(90vh-88px)] overflow-y-auto px-6 pt-6 pb-14'>
                  <Tabs className='space-y-6' defaultValue='overview' key={recordId ?? 'empty'}>
                    <TabsList>
                      <TabsTrigger value='overview'>概览</TabsTrigger>
                      <TabsTrigger value='questions'>AI 题目</TabsTrigger>
                      <TabsTrigger value='experience'>经历</TabsTrigger>
                    </TabsList>

                    <TabsContent value='overview'>
                      <div className='space-y-6'>
                        <div className='rounded-2xl border border-border/60 bg-muted/30 p-5'>
                          <h3 className='font-medium text-sm'>基础信息</h3>
                          <div className='mt-4 grid gap-3 text-sm'>
                            <DetailRow label='邮箱' value={formatValue(record.candidateEmail)} />
                            <DetailRow label='目标岗位' value={formatValue(record.targetRole)} />
                            <DetailRow label='工作年限' value={formatValue(record.resumeProfile?.workYears)} />
                            <DetailRow label='年龄' value={formatValue(record.resumeProfile?.age)} />
                            <DetailRow label='性别' value={formatValue(record.resumeProfile?.gender)} />
                          </div>
                        </div>

                        <div className='rounded-2xl border border-border/60 bg-background p-5'>
                          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
                            <h3 className='font-medium text-sm'>面试链接</h3>
                            <Button onClick={() => void handleCopy(new URL(record.interviewLink, window.location.origin).toString())} size='sm' type='button' variant='outline'>
                              <CopyIcon className='size-4' />
                              复制链接
                            </Button>
                          </div>
                          <div className='mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-sm'>
                            <p className='flex items-start gap-2 font-medium leading-relaxed'>
                              <LinkIcon className='mt-0.5 size-4 shrink-0 text-muted-foreground' />
                              <span className='break-all'>{record.interviewLink}</span>
                            </p>
                          </div>
                        </div>

                        <div className='rounded-2xl border border-border/60 bg-background p-5'>
                          <h3 className='font-medium text-sm'>面试安排</h3>
                          <div className='mt-4 space-y-3'>
                            {scheduleEntries.length > 0
                              ? scheduleEntries.map(entry => (
                                  <div className='rounded-xl border border-border/60 bg-muted/30 p-3' key={entry.id}>
                                    <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3'>
                                      <span className='break-words font-medium text-sm'>{entry.roundLabel}</span>
                                      <span className='shrink-0 text-muted-foreground text-xs'>{formatDateTime(entry.scheduledAt)}</span>
                                    </div>
                                    <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                                      {truncateText(entry.notes, 180) || '暂无轮次备注'}
                                    </p>
                                  </div>
                                ))
                              : <p className='text-muted-foreground text-sm'>暂无面试安排。</p>}
                          </div>
                        </div>

                        <div className='rounded-2xl border border-border/60 bg-background p-5'>
                          <h3 className='font-medium text-sm'>技能与优势</h3>
                          <p className='mt-3 text-muted-foreground text-sm leading-relaxed'>
                            技能：
                            <span className='break-words'>{visibleSkills.join('、') || '未发现信息'}</span>
                          </p>
                          <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                            优势：
                            <span className='break-words'>{visiblePersonalStrengths.join('、') || '未发现信息'}</span>
                          </p>
                          <p className='mt-2 text-muted-foreground text-sm leading-relaxed'>
                            学校：
                            <span className='break-words'>{visibleSchools.join('、') || '未发现信息'}</span>
                          </p>
                        </div>

                        <div className='rounded-2xl border border-border/60 bg-background p-5'>
                          <h3 className='font-medium text-sm'>备注</h3>
                          <p className='mt-3 text-muted-foreground text-sm leading-relaxed'>
                            {truncateText(record.notes, 600) || '暂无备注'}
                          </p>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value='questions'>
                      <div className='rounded-2xl border border-border/60 bg-background p-4'>
                        <h3 className='font-medium text-sm'>AI 面试题</h3>
                        <div className='mt-4 space-y-3'>
                          {visibleInterviewQuestions.length > 0
                            ? visibleInterviewQuestions.map(question => (
                                <div className='rounded-xl border border-border/60 bg-muted/30 p-3' key={question.order}>
                                  <div className='flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3'>
                                    <span className='font-medium text-sm'>
                                      第
                                      {question.order}
                                      {' '}
                                      题
                                    </span>
                                    <span className='shrink-0 text-muted-foreground text-xs uppercase'>{question.difficulty}</span>
                                  </div>
                                  <p className='mt-2 text-sm leading-relaxed'>{truncateText(question.question, 240)}</p>
                                </div>
                              ))
                            : <p className='text-muted-foreground text-sm'>暂无面试题，可通过上传简历自动生成。</p>}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value='experience'>
                      <div className='space-y-6'>
                        <div className='rounded-2xl border border-border/60 bg-muted/30 p-5'>
                          <h3 className='font-medium text-sm'>工作经历</h3>
                          <div className='mt-4 space-y-4'>
                            {visibleWorkExperiences.length > 0
                              ? visibleWorkExperiences.map((item, index) => (
                                  <div key={`${item.company ?? 'company'}-${index}`}>
                                    <p className='flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-sm'>
                                      {formatValue(item.company)}
                                      <span className='text-muted-foreground'>·</span>
                                      {formatValue(item.role)}
                                    </p>
                                    <p className='mt-1 text-muted-foreground text-xs'>{formatValue(item.period)}</p>
                                    <p className='mt-2 text-sm leading-relaxed'>{truncateText(item.summary, 280)}</p>
                                    {index < visibleWorkExperiences.length - 1 ? <Separator className='mt-4' /> : null}
                                  </div>
                                ))
                              : <p className='text-muted-foreground text-sm'>暂无工作经历。</p>}
                          </div>
                        </div>

                        <div className='rounded-2xl border border-border/60 bg-background p-5'>
                          <h3 className='font-medium text-sm'>项目经历</h3>
                          <div className='mt-4 space-y-4'>
                            {visibleProjectExperiences.length > 0
                              ? visibleProjectExperiences.map((item, index) => (
                                  <div key={`${item.name ?? 'project'}-${index}`}>
                                    <p className='flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-sm'>
                                      {formatValue(item.name)}
                                      <span className='text-muted-foreground'>·</span>
                                      {formatValue(item.role)}
                                    </p>
                                    <p className='mt-1 text-muted-foreground text-xs'>{formatValue(item.period)}</p>
                                    <p className='mt-2 text-sm leading-relaxed'>{truncateText(item.summary, 280)}</p>
                                    <p className='mt-2 text-muted-foreground text-xs'>
                                      技术栈：
                                      {item.techStack.slice(0, 20).join('、') || '未发现信息'}
                                    </p>
                                    {index < visibleProjectExperiences.length - 1 ? <Separator className='mt-4' /> : null}
                                  </div>
                                ))
                              : <p className='text-muted-foreground text-sm'>暂无项目经历。</p>}
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )
            : (
                <div className='flex min-h-[240px] items-center justify-center px-6 py-10 text-muted-foreground text-sm'>
                  暂无可展示的候选人详情。
                </div>
              )}
      </DialogContent>
    </Dialog>
  );
}
