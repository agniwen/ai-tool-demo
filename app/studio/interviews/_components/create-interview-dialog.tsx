'use client';

import type { ResumeAnalysisResult } from '@/lib/interview/types';
import type { StudioInterviewFormValues, StudioInterviewRecord } from '@/lib/studio-interviews';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUpIcon, LoaderCircleIcon, SparklesIcon } from 'lucide-react';
import { useState } from 'react';
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
  DialogTrigger,
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
  createDefaultScheduleEntry,
  studioInterviewFormSchema,
  studioInterviewStatusMeta,
  studioInterviewStatusValues,
} from '@/lib/studio-interviews';
import { InterviewScheduleFields } from './interview-schedule-fields';

function normalizeScheduleEntries(values: StudioInterviewFormValues['scheduleEntries']) {
  return values.map((entry, index) => ({
    ...entry,
    sortOrder: index,
  }));
}

export function CreateInterviewDialog({
  onCreated,
}: {
  onCreated: (record: StudioInterviewRecord) => void
}) {
  const [open, setOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePayload, setResumePayload] = useState<ResumeAnalysisResult | null>(null);
  const [isAnalyzingResume, setIsAnalyzingResume] = useState(false);
  const form = useForm<StudioInterviewFormValues>({
    resolver: zodResolver(studioInterviewFormSchema),
    defaultValues: {
      candidateName: '',
      candidateEmail: '',
      targetRole: '',
      notes: '',
      status: 'ready',
      scheduleEntries: [createDefaultScheduleEntry()],
    },
  });
  const scheduleEntries = useFieldArray({
    control: form.control,
    name: 'scheduleEntries',
  });

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
      toast.success('简历分析完成，已回填候选人信息');
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

  async function onSubmit(values: StudioInterviewFormValues) {
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

    const response = await fetch('/api/studio/interviews', {
      method: 'POST',
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as StudioInterviewRecord | { error?: string } | null;

    if (!response.ok || !payload || 'error' in payload) {
      toast.error(payload && 'error' in payload ? payload.error ?? '创建失败' : '创建失败');
      return;
    }

    onCreated(payload as StudioInterviewRecord);
    setOpen(false);
    setResumeFile(null);
    setResumePayload(null);
    form.reset({
      candidateName: '',
      candidateEmail: '',
      targetRole: '',
      notes: '',
      status: 'ready',
      scheduleEntries: [createDefaultScheduleEntry()],
    });
    toast.success('简历库记录已创建');
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <FileUpIcon className='size-4' />
          新建简历记录
        </Button>
      </DialogTrigger>
      <DialogContent className='max-h-[90vh] max-w-4xl overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>新建简历记录</DialogTitle>
          <DialogDescription>支持手动录入候选人资料，也可以先上传 PDF 简历自动分析并回填表单。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='space-y-5' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='grid gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4'>
              <div className='space-y-2'>
                <FormLabel>简历 PDF</FormLabel>
                <Input
                  accept='application/pdf'
                  disabled={isAnalyzingResume || form.formState.isSubmitting}
                  onChange={event => void handleResumeChange(event.target.files?.[0] ?? null)}
                  type='file'
                />
                <p className='text-muted-foreground text-sm'>选填。上传后会调用现有简历分析接口，自动回填候选人姓名、岗位和题目数据。</p>
                {resumeFile ? <p className='text-sm'>{resumeFile.name}</p> : null}
                {resumePayload
                  ? (
                      <div className='rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-sm'>
                        <p className='flex items-center gap-2 font-medium'>
                          <SparklesIcon className='size-4 text-amber-500' />
                          已完成简历分析
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
                    <FormDescription>可选，方便后台检索与跟进。</FormDescription>
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
                    <Textarea className='min-h-28' placeholder='记录候选人来源、业务线、面试关注点等信息' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button disabled={form.formState.isSubmitting || isAnalyzingResume} type='submit'>
                {form.formState.isSubmitting || isAnalyzingResume ? <LoaderCircleIcon className='size-4 animate-spin' /> : null}
                保存简历记录
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
