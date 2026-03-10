'use client';

import type { StudioInterviewRecord } from '@/lib/studio-interviews';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowUpDownIcon,
  BotIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  Trash2Icon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  studioInterviewStatusMeta,
  studioInterviewStatusValues,
} from '@/lib/studio-interviews';
import { CreateInterviewDialog } from './create-interview-dialog';
import { EditInterviewDialog } from './edit-interview-dialog';
import { InterviewDetailDialog } from './interview-detail-dialog';
import { InterviewStatusBadge } from './interview-status-badge';

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function InterviewManagementPage({ initialRecords }: { initialRecords: StudioInterviewRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof studioInterviewStatusValues)[number]>('all');
  const [detailRecord, setDetailRecord] = useState<StudioInterviewRecord | null>(null);
  const [editRecord, setEditRecord] = useState<StudioInterviewRecord | null>(null);
  const [deleteRecord, setDeleteRecord] = useState<StudioInterviewRecord | null>(null);

  const columns = useMemo<ColumnDef<StudioInterviewRecord>[]>(() => [
    {
      accessorKey: 'candidateName',
      header: ({ column }) => (
        <Button className='px-0' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} variant='ghost'>
          候选人
          <ArrowUpDownIcon className='size-4' />
        </Button>
      ),
      cell: ({ row }) => {
        const record = row.original;

        return (
          <div className='min-w-0'>
            <p className='truncate font-medium'>{record.candidateName}</p>
            <p className='truncate text-muted-foreground text-xs'>
              {record.candidateEmail || '未填写邮箱'}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: 'targetRole',
      header: '目标岗位',
      cell: ({ row }) => row.original.targetRole || '待识别岗位',
    },
    {
      accessorKey: 'resumeFileName',
      header: '简历文件',
      cell: ({ row }) => <div className='max-w-48 truncate text-sm'>{row.original.resumeFileName}</div>,
    },
    {
      accessorKey: 'status',
      header: '状态',
      cell: ({ row }) => <InterviewStatusBadge status={row.original.status} />,
      filterFn: (row, id, value) => {
        if (!value || value === 'all') {
          return true;
        }

        return row.getValue(id) === value;
      },
    },
    {
      id: 'questionCount',
      header: '题目数',
      cell: ({ row }) => `${row.original.interviewQuestions.length} 题`,
    },
    {
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button className='px-0' onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} variant='ghost'>
          创建时间
          <ArrowUpDownIcon className='size-4' />
        </Button>
      ),
      cell: ({ row }) => formatDateTime(row.original.createdAt),
    },
    {
      id: 'actions',
      enableHiding: false,
      cell: ({ row }) => {
        const record = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className='size-8 p-0' variant='ghost'>
                <MoreHorizontalIcon className='size-4' />
                <span className='sr-only'>打开操作菜单</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-44'>
              <DropdownMenuLabel>操作</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDetailRecord(record)}>
                <EyeIcon className='size-4' />
                查看详情
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditRecord(record)}>
                <PencilIcon className='size-4' />
                编辑记录
              </DropdownMenuItem>
              <DropdownMenuItem className='text-destructive focus:text-destructive' onClick={() => setDeleteRecord(record)}>
                <Trash2Icon className='size-4' />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ], []);

  const table = useReactTable({
    data: records,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters: [
        {
          id: 'status',
          value: statusFilter,
        },
      ],
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).trim().toLowerCase();

      if (!search) {
        return true;
      }

      return [
        row.original.candidateName,
        row.original.candidateEmail,
        row.original.targetRole,
        row.original.resumeFileName,
      ].some(value => value?.toLowerCase().includes(search));
    },
  });

  const summary = useMemo(() => ({
    total: records.length,
    ready: records.filter(item => item.status === 'ready').length,
    completed: records.filter(item => item.status === 'completed').length,
  }), [records]);

  async function handleDelete() {
    if (!deleteRecord) {
      return;
    }

    const response = await fetch(`/api/studio/interviews/${deleteRecord.id}`, {
      method: 'DELETE',
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      toast.error(payload?.error ?? '删除失败');
      return;
    }

    setRecords(previous => previous.filter(item => item.id !== deleteRecord.id));
    setDeleteRecord(null);
    toast.success('面试记录已删除');
  }

  return (
    <>
      <div className='space-y-6'>
        <section className='rounded-[1.75rem] border border-border/60 bg-background px-6 py-6 shadow-sm lg:px-8 lg:py-8'>
          <div className='flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between'>
            <div className='max-w-2xl space-y-3'>
              <Badge variant='secondary'>Studio / AI 面试管理</Badge>
              <h1 className='text-balance font-semibold text-3xl tracking-tight'>候选人 AI 面试管理台</h1>
              <p className='text-muted-foreground leading-relaxed'>
                使用 TanStack Table 管理候选人面试记录；创建时可直接上传简历，系统会沿用现有简历解析能力自动生成用户信息与面试题。
              </p>
            </div>
            <CreateInterviewDialog onCreated={record => setRecords(previous => [record, ...previous])} />
          </div>
        </section>

        <section className='grid gap-4 md:grid-cols-3'>
          {[
            { label: '总记录数', value: `${summary.total}`, hint: '所有已创建的候选人面试单' },
            { label: '待面试', value: `${summary.ready}`, hint: '已解析完成，可进入面试阶段' },
            { label: '已完成', value: `${summary.completed}`, hint: '已经完成流程，可复盘结果' },
          ].map(item => (
            <Card className='border-border/60 bg-background/92' key={item.label}>
              <CardHeader className='pb-2'>
                <CardDescription>{item.label}</CardDescription>
                <CardTitle className='text-3xl'>{item.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='text-muted-foreground text-sm'>{item.hint}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card className='border-border/60 bg-background/95'>
          <CardHeader className='gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <CardTitle>面试记录表</CardTitle>
              <CardDescription>支持搜索、状态筛选、查看详情、编辑和删除。</CardDescription>
            </div>
            <div className='flex flex-col gap-3 sm:flex-row'>
              <div className='relative min-w-[240px]'>
                <SearchIcon className='pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input className='pl-9' onChange={event => setGlobalFilter(event.target.value)} placeholder='搜索候选人、岗位或简历名' value={globalFilter} />
              </div>
              <Select onValueChange={value => setStatusFilter(value as typeof statusFilter)} value={statusFilter}>
                <SelectTrigger className='min-w-[180px]'>
                  <SelectValue placeholder='按状态筛选' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部状态</SelectItem>
                  {studioInterviewStatusValues.map(status => (
                    <SelectItem key={status} value={status}>
                      {studioInterviewStatusMeta[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {table.getRowModel().rows.length > 0
              ? (
                  <div className='rounded-2xl border border-border/60'>
                    <Table>
                      <TableHeader>
                        {table.getHeaderGroups().map(headerGroup => (
                          <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map(header => (
                              <TableHead key={header.id}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                              </TableHead>
                            ))}
                          </TableRow>
                        ))}
                      </TableHeader>
                      <TableBody>
                        {table.getRowModel().rows.map(row => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map(cell => (
                              <TableCell key={cell.id}>
                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )
              : (
                  <Empty className='border-border/60'>
                    <EmptyHeader>
                      <EmptyMedia variant='icon'>
                        <BotIcon className='size-5' />
                      </EmptyMedia>
                      <EmptyTitle>还没有 AI 面试记录</EmptyTitle>
                      <EmptyDescription>
                        先创建一条候选人面试单，上传 PDF 简历后，后台会自动生成用户信息与题目。
                      </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <CreateInterviewDialog onCreated={record => setRecords(previous => [record, ...previous])} />
                    </EmptyContent>
                  </Empty>
                )}
          </CardContent>
        </Card>
      </div>

      <InterviewDetailDialog onOpenChange={open => !open && setDetailRecord(null)} open={detailRecord !== null} record={detailRecord} />

      <EditInterviewDialog
        onOpenChange={open => !open && setEditRecord(null)}
        onUpdated={updated => setRecords(previous => previous.map(item => item.id === updated.id ? updated : item))}
        open={editRecord !== null}
        record={editRecord}
      />

      <AlertDialog onOpenChange={open => !open && setDeleteRecord(null)} open={deleteRecord !== null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除这条面试记录？</AlertDialogTitle>
            <AlertDialogDescription>
              删除后将无法恢复，包括候选人解析信息和 AI 题目。当前记录：{deleteRecord?.candidateName ?? '未知候选人'}。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant='destructive'>
              删除记录
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
