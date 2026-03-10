'use client';

import type { ResumeAnalysisResult } from '@/lib/interview/types';
import type { StudioInterviewRecord, StudioInterviewUpdateValues } from '@/lib/studio-interviews';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircleIcon, SparklesIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  getScheduleEntryDateValue,
  studioInterviewStatusMeta,
  studioInterviewStatusValues,
  studioInterviewUpdateSchema,
} from '@/lib/studio-interviews';
import { InterviewScheduleFields } from './interview-schedule-fields';

function normalizeScheduleEntries(values: StudioInterviewUpdateValues['scheduleEntries']) {
  return values.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  }));
}

export function EditInterviewDialog({
  open,
  onOpenChange,
  record,
  onUpdated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  record: StudioInterviewRecord | null
  onUpdated: (record: StudioInterviewRecord) => void
}) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePayload, setResumePayload] = useState<ResumeAnalysisResult | null>(null);
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const form = useForm<StudioInterviewUpdateValues>({
    resolver: zodResolver(studioInterviewUpdateSchema),
    defaultValues: {
      candidateName: '',
      candidateEmail: '',
      targetRole: '',
      notes: '',
      status: 'ready',
      scheduleEntries: [],
    },
  });
  const scheduleEntries = useFieldArray({
    control: form.control,
    name: 'scheduleEntries',
  });

  useEffect(() => {
    if (!record) {
      return;
    }

    form.reset({
      candidateName: record.candidateName,
      candidateEmail: record.candidateEmail ?? '',
      targetRole: record.targetRole ?? '',
      notes: record.notes ?? '',
      status: record.status,
      scheduleEntries: record.scheduleEntries.map((entry, index) => ({
        id: entry.id,
        roundLabel: entry.roundLabel,
        scheduledAt: getScheduleEntryDateValue(entry.scheduledAt),
        notes: entry.notes ?? '',
        sortOrder: entry.sortOrder ?? index,
      })),
    });

    queueMicrotask(() => {
      setResumeFile(null);
      setResumePayload(null);
    });
  }, [form, record]);

  async function handleResumeChange(file: File | null) {
    setResumeFile(file);
    setResumePayload(null);

    if (!file) {
      return;
    }

    setIsAnalyzingResume(true);

    try {
      const formData = new FormData();
      formData.append('resume', file);

      const response = await fetch('/api/interview/parse-resume', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as (ResumeAnalysisResult & { error?: string }) | null;

      if (!response.ok || !payload?.resumeProfile || !payload?.interviewQuestions || !payload.fileName) {
        throw new Error(payload?.error ?? '简历分析失败');
      }

      setResumePayload(payload);
      form.setValue('candidateName', payload.resumeProfile.name, { shouldDirty: true, shouldValidate: true });
      form.setValue('targetRole', payload.resumeProfile.targetRoles[0] ?? '', { shouldDirty: true, shouldValidate: true });
      toast.success('已根据新简历回填候选人信息，面试安排和备注保持不变');
    }
    catch (error) {
      setResumeFile(null);
      setResumePayload(null);
      toast.error(error instanceof Error ? error.message : '简历分析失败');
    }
    finally {
      setIsAnalyzingResume(false);
    }
  }

  async function onSubmit(values: StudioInterviewUpdateValues) {
    if (!record) {
      return;
    }

    const formData = new FormData();
    formData.append('candidateName', values.candidateName);
    formData.append('candidateEmail', values.candidateEmail);
    formData.append('targetRole', values.targetRole);
    formData.append('notes', values.notes);
    formData.append('status', values.status);
    formData.append('scheduleEntries', JSON.stringify(normalizeScheduleEntries(values.scheduleEntries)));

    if (resumeFile) {
      formData.append('resume', resumeFile);
    }

    if (resumePayload) {
      formData.append('resumePayload', JSON.stringify(resumePayload));
    }

    const response = await fetch(`/api/studio/interviews/${record.id}`, {
      method: 'PATCH',
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as StudioInterviewRecord | { error?: string } | null;

    if (!response.ok || !payload || 'error' in payload) {
      toast.error(payload && 'error' in payload ? payload.error ?? '更新失败' : '更新失败');
      return;
    }

    onUpdated(payload as StudioInterviewRecord);
    onOpenChange(false);
    setResumeFile(null);
    setResumePayload(null);
    toast.success('简历记录已更新');
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>编辑简历记录</DialogTitle>
          <DialogDescription>更新候选人资料、流程状态、面试安排，并支持替换简历重新分析。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='space-y-5' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='grid gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4'>
              <div className='space-y-2'>
                <FormLabel>替换简历 PDF</FormLabel>
                <Input
                  accept='application/pdf'
                  disabled={isAnalyzingResume || form.formState.isSubmitting}
                  onChange={event => void handleResumeChange(event.target.files?.[0] ?? null)}
                  type='file'
                />
                <p className='text-muted-foreground text-sm'>重新上传后将回填候选人信息与题目，但不会覆盖已维护的轮次安排和备注。</p>
                {resumeFile ? <p className='text-sm'>{resumeFile.name}</p> : null}
                {resumePayload
                  ? (
                      <div className='rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm'>
                        <p className='flex items-center gap-2 font-medium'>
                          <SparklesIcon className='size-4 text-amber-500' />
                          已完成新简历分析
                        </p>
                        <p className='mt-1 text-muted-foreground'>
                          {resumePayload.resumeProfile.name}
                          {' · '}
                          {resumePayload.resumeProfile.targetRoles[0] ?? '待识别岗位'}
                          {' · '}
                          {resumePayload.interviewQuestions.length}
                          {' '}
                          道题
                        </p>
                      </div>
                    )
                  : null}
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name='candidateName'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>候选人姓名</FormLabel>
                    <FormControl>
                      <Input placeholder='请输入候选人姓名' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='candidateEmail'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>候选人邮箱</FormLabel>
                    <FormControl>
                      <Input placeholder='candidate@example.com' {...field} />
                    </FormControl>
                    <FormDescription>可选，用于后台联系与检索。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='targetRole'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>目标岗位</FormLabel>
                    <FormControl>
                      <Input placeholder='如：前端工程师 / 产品经理' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>当前流程</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='选择状态' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {studioInterviewStatusValues.map(status => (
                          <SelectItem key={status} value={status}>
                            {studioInterviewStatusMeta[status].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <InterviewScheduleFields
              append={scheduleEntries.append}
              fields={scheduleEntries.fields}
              form={form as any}
              remove={scheduleEntries.remove}
            />

            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>内部备注</FormLabel>
                  <FormControl>
                    <Textarea className='min-h-28' placeholder='记录候选人背景、跟进建议或招聘备注' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button disabled={form.formState.isSubmitting || isAnalyzingResume} type='submit'>
                {form.formState.isSubmitting || isAnalyzingResume ? <LoaderCircleIcon className='size-4 animate-spin' /> : null}
                保存更新
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
