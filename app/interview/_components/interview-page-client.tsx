'use client';

import type { Conversation as ElevenConversationType } from '@elevenlabs/client';
import type { InterviewReport } from '@/lib/interview-report-store';
import { Conversation } from '@elevenlabs/client';
import { MicIcon, PhoneCallIcon, PhoneOffIcon, RefreshCwIcon, ShieldAlertIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

interface Turn {
  id: string
  role: 'agent' | 'user'
  text: string
}

const REPORT_POLL_INTERVAL_MS = 5000;
const REPORT_POLL_MAX_RETRIES = 12;

function pickMessage(event: unknown): Omit<Turn, 'id'> | null {
  if (!event || typeof event !== 'object') {
    return null;
  }

  const value = event as Record<string, unknown>;

  if (typeof value.source === 'string' && typeof value.message === 'string') {
    return {
      role: value.source === 'user' ? 'user' : 'agent',
      text: value.message,
    };
  }

  if (value.type === 'user_transcript') {
    const transcript = (value.user_transcription_event as {
      user_transcript?: unknown
    } | undefined)?.user_transcript;

    if (typeof transcript === 'string' && transcript.trim()) {
      return {
        role: 'user',
        text: transcript,
      };
    }
  }

  if (value.type === 'agent_response') {
    const response = (value.agent_response_event as {
      agent_response?: unknown
    } | undefined)?.agent_response;

    if (typeof response === 'string' && response.trim()) {
      return {
        role: 'agent',
        text: response,
      };
    }
  }

  return null;
}

export default function InterviewPageClient() {
  const conversationRef = useRef<ElevenConversationType | null>(null);
  const [statusText, setStatusText] = useState('disconnected');
  const [modeText, setModeText] = useState('listening');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [isFetchingReport, setIsFetchingReport] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const isConnected = statusText === 'connected';

  const dataCollectionEntries = useMemo(
    () => Object.entries(report?.dataCollectionResults ?? {}),
    [report?.dataCollectionResults],
  );

  const evaluationEntries = useMemo(
    () => Object.entries(report?.evaluationCriteriaResults ?? {}),
    [report?.evaluationCriteriaResults],
  );

  async function fetchReportByConversationId(targetConversationId: string) {
    const response = await fetch(
      `/api/interview/report/${encodeURIComponent(targetConversationId)}`,
      { cache: 'no-store' },
    );

    if (!response.ok) {
      return null;
    }

    const nextReport = (await response.json()) as InterviewReport;
    setReport(nextReport);
    return nextReport;
  }

  async function pollReport(targetConversationId: string) {
    setIsFetchingReport(true);

    try {
      for (let attempt = 0; attempt < REPORT_POLL_MAX_RETRIES; attempt += 1) {
        const nextReport = await fetchReportByConversationId(targetConversationId);

        if (nextReport) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, REPORT_POLL_INTERVAL_MS));
      }

      setErrorText('面试已结束，但结论还未返回。请稍后点击“刷新结论”。');
    }
    finally {
      setIsFetchingReport(false);
    }
  }

  async function startInterview() {
    if (conversationRef.current) {
      return;
    }

    setErrorText(null);
    setReport(null);
    setTurns([]);
    setStatusText('connecting');

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const tokenResponse = await fetch('/api/interview/token', { cache: 'no-store' });

      if (!tokenResponse.ok) {
        const payload = (await tokenResponse.json().catch(() => null)) as {
          error?: string
        } | null;
        throw new Error(payload?.error ?? '无法创建会话 token');
      }

      const tokenPayload = (await tokenResponse.json()) as { token: string };

      const session = await Conversation.startSession({
        connectionType: 'webrtc',
        conversationToken: tokenPayload.token,
        onConnect: () => setStatusText('connected'),
        onDisconnect: () => {
          setStatusText('disconnected');
          conversationRef.current = null;
        },
        onError: (error) => {
          const message = typeof error === 'string' ? error : '会话异常';
          setErrorText(message);
        },
        onMessage: (event) => {
          const picked = pickMessage(event);

          if (!picked || !picked.text.trim()) {
            return;
          }

          setTurns(previous => [
            ...previous,
            {
              id: `${Date.now()}-${crypto.randomUUID()}`,
              ...picked,
            },
          ]);
        },
        onModeChange: ({ mode }) => setModeText(mode),
        onStatusChange: ({ status }) => setStatusText(status),
      });

      conversationRef.current = session;
      setConversationId(session.getId());
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '启动面试失败';
      setErrorText(message);
      setStatusText('disconnected');
    }
  }

  async function stopInterview() {
    const activeConversation = conversationRef.current;

    if (!activeConversation) {
      return;
    }

    setStatusText('disconnecting');

    try {
      await activeConversation.endSession();
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '结束面试失败';
      setErrorText(message);
    }
    finally {
      conversationRef.current = null;
      setStatusText('disconnected');
    }

    if (conversationId) {
      void pollReport(conversationId);
    }
  }

  async function refreshReport() {
    if (!conversationId) {
      return;
    }

    setErrorText(null);
    setIsFetchingReport(true);

    try {
      const nextReport = await fetchReportByConversationId(conversationId);

      if (!nextReport) {
        setErrorText('暂无结论，请确认 webhook 地址已配置并完成一次面试。');
      }
    }
    finally {
      setIsFetchingReport(false);
    }
  }

  return (
    <main className='mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:px-6'>
      <section className='rounded-2xl border border-border/70 bg-card/80 p-5 shadow-[0_22px_45px_-35px_rgba(22,54,89,0.65)]'>
        <p className='inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary text-xs'>
          <PhoneCallIcon className='size-3.5' />
          ElevenLabs AI 面试
        </p>
        <h1 className='pixel-title mt-3 font-bold text-2xl sm:text-3xl'>语音面试与自动结论</h1>
        <p className='mt-2 max-w-4xl font-serif text-muted-foreground text-sm leading-relaxed'>
          点击“开始面试”后，候选人可直接语音作答。结束后系统会通过 webhook 接收 transcript、evaluation 和 data
          collection，并在右侧显示结构化结论。
        </p>

        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <Button disabled={isConnected || statusText === 'connecting'} onClick={startInterview} type='button'>
            <MicIcon className='mr-2 size-4' />
            开始面试
          </Button>

          <Button disabled={!isConnected} onClick={stopInterview} type='button' variant='outline'>
            <PhoneOffIcon className='mr-2 size-4' />
            结束面试
          </Button>

          <Button disabled={!conversationId || isFetchingReport} onClick={refreshReport} type='button' variant='ghost'>
            <RefreshCwIcon className='mr-2 size-4' />
            刷新结论
          </Button>
        </div>

        <div className='mt-4 grid gap-2 text-sm sm:grid-cols-3'>
          <p className='rounded-xl bg-secondary/65 px-3 py-2'>
            会话状态：
            <span className='ml-1 font-semibold'>{statusText}</span>
          </p>
          <p className='rounded-xl bg-secondary/65 px-3 py-2'>
            说话模式：
            <span className='ml-1 font-semibold'>{modeText}</span>
          </p>
          <p className='truncate rounded-xl bg-secondary/65 px-3 py-2'>
            conversationId：
            <span className='ml-1 font-semibold'>{conversationId ?? '-'}</span>
          </p>
        </div>

        <p className='mt-3 flex items-start gap-2 text-muted-foreground text-xs'>
          <ShieldAlertIcon className='mt-0.5 size-3.5 shrink-0' />
          请在 ElevenLabs 控制台把 post-call webhook 指向
          {' '}
          <code>/api/interview/webhook</code>
          ，并配置
          {' '}
          <code>ELEVENLABS_WEBHOOK_SECRET</code>
          。
        </p>

        {errorText
          ? <p className='mt-2 text-destructive text-sm'>{errorText}</p>
          : null}
      </section>

      <section className='grid gap-5 lg:grid-cols-[1.25fr_1fr]'>
        <article className='rounded-2xl border border-border/70 bg-card/75 p-4'>
          <h2 className='font-semibold text-base'>实时对话</h2>
          <div className='mt-3 flex max-h-[65dvh] flex-col gap-2 overflow-y-auto pr-1'>
            {turns.length === 0
              ? (
                  <p className='rounded-xl border border-dashed border-border/70 p-4 text-muted-foreground text-sm'>
                    暂无对话内容。开始面试后，这里会显示候选人与 AI 的语音转文本记录。
                  </p>
                )
              : (
                  turns.map(turn => (
                    <div
                      className={`rounded-xl px-3 py-2 text-sm ${turn.role === 'agent' ? 'bg-accent/65' : 'bg-primary/10'}`}
                      key={turn.id}
                    >
                      <p className='mb-1 text-[11px] text-muted-foreground uppercase tracking-wide'>
                        {turn.role === 'agent' ? 'AI 面试官' : '候选人'}
                      </p>
                      <p className='leading-relaxed'>{turn.text}</p>
                    </div>
                  ))
                )}
          </div>
        </article>

        <article className='rounded-2xl border border-border/70 bg-card/75 p-4'>
          <h2 className='font-semibold text-base'>面试结论</h2>

          {!report
            ? (
                <p className='mt-3 rounded-xl border border-dashed border-border/70 p-4 text-muted-foreground text-sm'>
                  结束面试并等待 webhook 回调后，系统会在这里显示结构化结论。
                </p>
              )
            : (
                <div className='mt-3 space-y-4'>
                  <div className='rounded-xl bg-secondary/65 p-3'>
                    <p className='font-medium text-xs uppercase tracking-wide'>总体结果</p>
                    <p className='mt-1 text-sm'>
                      callSuccessful:
                      {' '}
                      <span className='font-semibold'>{report.callSuccessful ?? 'unknown'}</span>
                    </p>
                    <p className='mt-2 text-sm leading-relaxed'>{report.transcriptSummary ?? '暂无摘要'}</p>
                  </div>

                  <div>
                    <p className='mb-2 font-medium text-sm'>Data Collection</p>
                    <div className='space-y-1.5'>
                      {dataCollectionEntries.length === 0
                        ? <p className='text-muted-foreground text-sm'>暂无提取字段</p>
                        : dataCollectionEntries.map(([key, value]) => (
                            <p className='text-sm' key={key}>
                              <span className='font-medium'>{key}</span>
                              :
                              {' '}
                              {String(value)}
                            </p>
                          ))}
                    </div>
                  </div>

                  <div>
                    <p className='mb-2 font-medium text-sm'>Success Evaluation</p>
                    <div className='space-y-1.5'>
                      {evaluationEntries.length === 0
                        ? <p className='text-muted-foreground text-sm'>暂无评估项</p>
                        : evaluationEntries.map(([key, value]) => (
                            <p className='text-sm' key={key}>
                              <span className='font-medium'>{key}</span>
                              :
                              {' '}
                              {JSON.stringify(value)}
                            </p>
                          ))}
                    </div>
                  </div>
                </div>
              )}
        </article>
      </section>
    </main>
  );
}
