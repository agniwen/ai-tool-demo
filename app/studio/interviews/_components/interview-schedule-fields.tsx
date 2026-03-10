'use client';

import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormReturn } from 'react-hook-form';
import type { StudioInterviewFormValues, StudioInterviewUpdateValues } from '@/lib/studio-interviews';
import { CalendarDaysIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { createDefaultScheduleEntry } from '@/lib/studio-interviews';

type InterviewForm = StudioInterviewFormValues | StudioInterviewUpdateValues;

export function InterviewScheduleFields({
  form,
  fields,
  append,
  remove,
}: {
  form: UseFormReturn<InterviewForm>
  fields: FieldArrayWithId<InterviewForm, 'scheduleEntries', 'id'>[]
  append: UseFieldArrayAppend<InterviewForm, 'scheduleEntries'>
  remove: UseFieldArrayRemove
}) {
  return (
    <div className='space-y-4 rounded-2xl border border-border/60 bg-background p-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <h3 className='font-medium text-sm'>面试安排</h3>
          <p className='mt-1 text-muted-foreground text-xs'>支持添加一面、二面、三面等多个轮次，并维护计划时间。</p>
        </div>
        <Button
          onClick={() => append(createDefaultScheduleEntry(fields.length))}
          size='sm'
          type='button'
          variant='outline'
        >
          <PlusIcon className='size-4' />
          新增轮次
        </Button>
      </div>

      <div className='space-y-4'>
        {fields.map((field, index) => (
          <div className='rounded-xl border border-border/60 bg-muted/20 p-4' key={field.id}>
            <div className='mb-3 flex items-center justify-between gap-3'>
              <p className='font-medium text-sm'>
                第
                {index + 1}
                {' '}
                轮
              </p>
              <Button
                disabled={fields.length <= 1}
                onClick={() => remove(index)}
                size='icon'
                type='button'
                variant='ghost'
              >
                <Trash2Icon className='size-4' />
              </Button>
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
              <FormField
                control={form.control}
                name={`scheduleEntries.${index}.roundLabel` as const}
                render={({ field: itemField }) => (
                  <FormItem>
                    <FormLabel>轮次名称</FormLabel>
                    <FormControl>
                      <Input placeholder='如：一面、二面、HR 面' {...itemField} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name={`scheduleEntries.${index}.scheduledAt` as const}
                render={({ field: itemField }) => (
                  <FormItem>
                    <FormLabel>面试时间</FormLabel>
                    <FormControl>
                      <div className='relative'>
                        <CalendarDaysIcon className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                        <Input className='pl-9' type='datetime-local' {...itemField} value={itemField.value ?? ''} />
                      </div>
                    </FormControl>
                    <FormDescription>可留空，表示轮次已创建但时间待定。</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name={`scheduleEntries.${index}.notes` as const}
              render={({ field: itemField }) => (
                <FormItem className='mt-4'>
                  <FormLabel>轮次备注</FormLabel>
                  <FormControl>
                    <Textarea
                      className='min-h-20'
                      placeholder='记录该轮次关注点、面试官、准备要求等'
                      {...itemField}
                      value={itemField.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
