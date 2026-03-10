'use client';

import type { StudioInterviewFormValues, StudioInterviewRecord } from '@/lib/studio-interviews';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUpIcon, LoaderCircleIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
  studioInterviewFormSchema,
  studioInterviewStatusMeta,
  studioInterviewStatusValues,
} from '@/lib/studio-interviews';

export function CreateInterviewDialog({
  onCreated,
}: {
  onCreated: (record: StudioInterviewRecord) => void
}) {
  const [open, setOpen] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const form = useForm<StudioInterviewFormValues>({
    resolver: zodResolver(studioInterviewFormSchema),
    defaultValues: {
      candidateEmail: '',
      notes: '',
      status: 'ready',
    },
  });

  async function onSubmit(values: StudioInterviewFormValues) {
    if (!resumeFile) {
      setFileError('请上传 PDF 简历');
      return;
    }

    setFileError(null);

    const formData = new FormData();
    formData.append('resume', resumeFile);
    formData.append('candidateEmail', values.candidateEmail);
    formData.append('notes', values.notes);
    formData.append('status', values.status);

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
    form.reset();
    toast.success('已创建 AI 面试记录');
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <FileUpIcon className='size-4' />
          新建 AI 面试
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>新建 AI 面试</DialogTitle>
          <DialogDescription>上传候选人简历后，系统会自动解析信息并生成 10 道面试题。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='space-y-5' onSubmit={form.handleSubmit(onSubmit)}>
            <div className='grid gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/25 p-4'>
              <div className='space-y-2'>
                <FormLabel>简历 PDF</FormLabel>
                <Input
                  accept='application/pdf'
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setResumeFile(file);
                    setFileError(null);
                  }}
                  type='file'
                />
                <p className='text-muted-foreground text-sm'>只支持 PDF，上传后会调用现有简历分析能力自动生成用户画像。</p>
                {resumeFile ? <p className='text-sm'>{resumeFile.name}</p> : null}
                {fileError ? <p className='text-destructive text-sm'>{fileError}</p> : null}
              </div>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
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
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>初始状态</FormLabel>
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

            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea className='min-h-28' placeholder='记录候选人来源、业务线、面试关注点等信息' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button disabled={form.formState.isSubmitting} type='submit'>
                {form.formState.isSubmitting ? <LoaderCircleIcon className='size-4 animate-spin' /> : null}
                创建并分析简历
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
