'use client';

import type { StudioInterviewRecord, StudioInterviewUpdateValues } from '@/lib/studio-interviews';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircleIcon } from 'lucide-react';
import { useEffect } from 'react';
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
  studioInterviewStatusMeta,
  studioInterviewStatusValues,
  studioInterviewUpdateSchema,
} from '@/lib/studio-interviews';

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
  const form = useForm<StudioInterviewUpdateValues>({
    resolver: zodResolver(studioInterviewUpdateSchema),
    defaultValues: {
      candidateEmail: '',
      notes: '',
      status: 'ready',
    },
  });

  useEffect(() => {
    if (!record) {
      return;
    }

    form.reset({
      candidateEmail: record.candidateEmail ?? '',
      notes: record.notes ?? '',
      status: record.status,
    });
  }, [form, record]);

  async function onSubmit(values: StudioInterviewUpdateValues) {
    if (!record) {
      return;
    }

    const response = await fetch(`/api/studio/interviews/${record.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(values),
    });

    const payload = (await response.json().catch(() => null)) as StudioInterviewRecord | { error?: string } | null;

    if (!response.ok || !payload || 'error' in payload) {
      toast.error(payload && 'error' in payload ? payload.error ?? '更新失败' : '更新失败');
      return;
    }

    onUpdated(payload as StudioInterviewRecord);
    onOpenChange(false);
    toast.success('面试记录已更新');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>编辑面试记录</DialogTitle>
          <DialogDescription>更新候选人联系方式、状态和备注。</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
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
              name='status'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>状态</FormLabel>
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

            <FormField
              control={form.control}
              name='notes'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注</FormLabel>
                  <FormControl>
                    <Textarea className='min-h-28' placeholder='记录候选人背景、跟进建议或招聘备注' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button disabled={form.formState.isSubmitting} type='submit'>
                {form.formState.isSubmitting ? <LoaderCircleIcon className='size-4 animate-spin' /> : null}
                保存更新
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
