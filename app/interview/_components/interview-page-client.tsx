'use client';

import type { Conversation as ElevenConversationType } from '@elevenlabs/client';
import { Conversation as VoiceConversation } from '@elevenlabs/client';
import {
  AudioLinesIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  MicIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PhoneOffIcon,
  SparklesIcon,
  UserIcon,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { PromptInput, PromptInputBody, PromptInputFooter } from '@/components/ai-elements/prompt-input';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

interface Turn {
  id: string
  role: 'agent' | 'user'
  text: string
  createdAt: number
}

interface AudioDeviceOption {
  deviceId: string
  label: string
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WHITESPACE_REGEX = /\s+/;

function getInitials(name?: string | null, email?: string | null) {
  const source = (name ?? email ?? '').trim();

  if (!source) {
    return 'U';
  }

  const words = source.split(WHITESPACE_REGEX).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]![0]}${words[1]![0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function pickMessage(event: unknown): Omit<Turn, 'id' | 'createdAt'> | null {
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

function formatInterviewStage(statusText: string, modeText: string) {
  if (statusText === 'connecting') {
    return '正在接通';
  }

  if (statusText === 'disconnecting') {
    return '正在结束';
  }

  if (statusText !== 'connected') {
    return '等待开始';
  }

  return modeText === 'speaking' ? 'AI 追问中' : '候选人作答中';
}

function formatStatusSummary(statusText: string) {
  switch (statusText) {
    case 'connected':
      return '通话进行中';
    case 'connecting':
      return '正在建立连接';
    case 'disconnecting':
      return '正在结束面试';
    default:
      return '尚未开始';
  }
}

function LevelBar({
  label,
  value,
  colorClassName,
  isActive,
}: {
  label: string
  value: number
  colorClassName: string
  isActive: boolean
}) {
  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between text-muted-foreground text-xs'>
        <span>{label}</span>
        <span>{isActive ? `${Math.round(value * 100)}%` : '--'}</span>
      </div>
      <div className='h-2 overflow-hidden rounded-full bg-muted/70'>
        <div
          className={cn('h-full rounded-full transition-[width] duration-150', colorClassName)}
          style={{ width: isActive ? `${Math.max(6, value * 100)}%` : '0%' }}
        />
      </div>
    </div>
  );
}

function formatMessageTime(createdAt: number) {
  return timeFormatter.format(new Date(createdAt));
}

export default function InterviewPageClient() {
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const conversationRef = useRef<ElevenConversationType | null>(null);
  const rafRef = useRef<number | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [statusText, setStatusText] = useState('disconnected');
  const [modeText, setModeText] = useState('listening');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<AudioDeviceOption[]>([]);
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState('default');
  const [hasMicPermission, setHasMicPermission] = useState(false);
  const [inputLevel, setInputLevel] = useState(0.08);
  const [outputLevel, setOutputLevel] = useState(0.08);

  const isConnected = statusText === 'connected';
  const showExpandedSidebar = !isSidebarCollapsed || isMobileSidebarOpen;
  const interviewStage = formatInterviewStage(statusText, modeText);
  const connectionSummary = formatStatusSummary(statusText);

  const selectedDeviceLabel = useMemo(() => {
    if (selectedInputDeviceId === 'default') {
      return '系统默认麦克风';
    }

    return audioDevices.find(device => device.deviceId === selectedInputDeviceId)?.label ?? '已选设备';
  }, [audioDevices, selectedInputDeviceId]);

  const latestAgentTurn = useMemo(
    () => turns.toReversed().find(turn => turn.role === 'agent') ?? null,
    [turns],
  );

  const latestUserTurn = useMemo(
    () => turns.toReversed().find(turn => turn.role === 'user') ?? null,
    [turns],
  );

  const stopMeterLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startMeterLoop = useCallback((session: ElevenConversationType) => {
    stopMeterLoop();

    const tick = () => {
      const nextInputLevel = Math.min(1, Math.max(0.06, session.getInputVolume() ** 0.65 * 2.2));
      const nextOutputLevel = Math.min(1, Math.max(0.06, session.getOutputVolume() ** 0.65 * 2.2));

      setInputLevel(nextInputLevel);
      setOutputLevel(nextOutputLevel);
      rafRef.current = requestAnimationFrame(tick);
    };

    tick();
  }, [stopMeterLoop]);

  const handleSignOut = useCallback(async () => {
    await authClient.signOut();
  }, []);

  const userName = session?.user?.name ?? '用户';
  const userEmail = session?.user?.email ?? '';
  const userInitials = getInitials(session?.user?.name, session?.user?.email);

  const loadAudioDevices = useCallback(async (requestPermission: boolean) => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return;
    }

    try {
      if (requestPermission) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setHasMicPermission(true);
        stream.getTracks().forEach(track => track.stop());
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const nextAudioDevices = devices
        .filter(device => device.kind === 'audioinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `麦克风 ${index + 1}`,
        }));

      setAudioDevices(nextAudioDevices);

      if (
        selectedInputDeviceId !== 'default'
        && !nextAudioDevices.some(device => device.deviceId === selectedInputDeviceId)
      ) {
        setSelectedInputDeviceId('default');
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '无法读取麦克风设备';
      setErrorText(message);
    }
  }, [selectedInputDeviceId]);

  useEffect(() => {
    void loadAudioDevices(false);

    const mediaDevices = navigator.mediaDevices;

    if (!mediaDevices?.addEventListener) {
      return;
    }

    const handleDeviceChange = () => {
      void loadAudioDevices(false);
    };

    mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [loadAudioDevices]);

  useEffect(() => {
    return () => {
      stopMeterLoop();
      conversationRef.current?.endSession().catch(() => undefined);
    };
  }, [stopMeterLoop]);

  async function startInterview() {
    if (conversationRef.current) {
      return;
    }

    setErrorText(null);
    setTurns([]);
    setStatusText('connecting');
    setInputLevel(0.08);
    setOutputLevel(0.08);

    try {
      const constraints = selectedInputDeviceId !== 'default'
        ? { audio: { deviceId: { exact: selectedInputDeviceId } } }
        : { audio: true };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setHasMicPermission(true);
      stream.getTracks().forEach(track => track.stop());
      await loadAudioDevices(false);

      const tokenResponse = await fetch('/api/interview/token', { cache: 'no-store' });

      if (!tokenResponse.ok) {
        const payload = (await tokenResponse.json().catch(() => null)) as {
          error?: string
        } | null;
        throw new Error(payload?.error ?? '无法开始面试');
      }

      const tokenPayload = (await tokenResponse.json()) as { token: string };
      let connectedDuringSetup = false;

      const session = await VoiceConversation.startSession({
        connectionType: 'webrtc',
        conversationToken: tokenPayload.token,
        inputDeviceId: selectedInputDeviceId === 'default' ? undefined : selectedInputDeviceId,
        onConnect: () => {
          setStatusText('connected');
          connectedDuringSetup = true;

          if (conversationRef.current) {
            startMeterLoop(conversationRef.current);
          }
        },
        onDisconnect: () => {
          setStatusText('disconnected');
          conversationRef.current = null;
          stopMeterLoop();
          setInputLevel(0.08);
          setOutputLevel(0.08);
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
              createdAt: Date.now(),
              ...picked,
            },
          ]);
        },
        onModeChange: ({ mode }) => setModeText(mode),
        onStatusChange: ({ status }) => setStatusText(status),
      });

      conversationRef.current = session;

      if (connectedDuringSetup || session.isOpen()) {
        startMeterLoop(session);
      }
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '启动面试失败';
      setErrorText(message);
      setStatusText('disconnected');
      stopMeterLoop();
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
      stopMeterLoop();
      setInputLevel(0.08);
      setOutputLevel(0.08);
    }
  }

  return (
    <div className='flex h-screen min-h-screen w-full min-w-0 flex-col overflow-hidden bg-transparent'>
      <div className='grid min-h-0 flex-1 overflow-hidden bg-transparent sm:grid-cols-[auto_minmax(0,1fr)]'>
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-40 flex w-[min(82vw,20rem)] shrink-0 flex-col overflow-hidden border-r border-border/75 bg-card/95 shadow-[0_14px_36px_-32px_rgba(52,96,168,0.6)] backdrop-blur-sm transition-transform duration-200 sm:static sm:z-auto sm:bg-card/80 sm:transition-[width]',
            isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0',
            isSidebarCollapsed ? 'sm:w-14' : 'sm:w-72',
          )}
          id='interview-sidebar'
        >
          <div className='flex items-center gap-1 border-border/65 border-b px-2 py-2'>
            <Button
              aria-label={isSidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
              className='hidden sm:inline-flex'
              onClick={() => setIsSidebarCollapsed(value => !value)}
              size='icon'
              type='button'
              variant='ghost'
            >
              {isSidebarCollapsed
                ? <PanelLeftOpenIcon className='size-4' />
                : <PanelLeftCloseIcon className='size-4' />}
            </Button>

            {showExpandedSidebar
              ? (
                  <>
                    <p className='truncate font-medium text-sm'>设置与状态</p>
                    <Button
                      className='ml-auto hidden sm:flex'
                      onClick={() => void loadAudioDevices(true)}
                      size='sm'
                      type='button'
                      variant='outline'
                    >
                      <AudioLinesIcon className='mr-1 size-3.5' />
                      检测
                    </Button>
                  </>
                )
              : null}

            <Button
              aria-label='关闭侧边栏'
              className={cn(showExpandedSidebar ? 'sm:hidden' : 'ml-auto sm:hidden')}
              onClick={() => setIsMobileSidebarOpen(false)}
              size='icon'
              type='button'
              variant='ghost'
            >
              <PanelLeftCloseIcon className='size-4' />
            </Button>
          </div>

          <div className='min-h-0 flex-1 overflow-y-auto px-3 py-3'>
            {!showExpandedSidebar
              ? null
              : (
                  <>
                    <section className='border-border/60 border-b py-3'>
                      <p className='mb-3 font-medium text-sm'>音频设备</p>

                      <Select onValueChange={setSelectedInputDeviceId} value={selectedInputDeviceId}>
                        <SelectTrigger className='w-full'>
                          <SelectValue placeholder='选择麦克风' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='default'>系统默认麦克风</SelectItem>
                          {audioDevices.map(device => (
                            <SelectItem key={device.deviceId} value={device.deviceId}>
                              {device.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <p className='mt-3 text-muted-foreground text-xs leading-relaxed'>
                        开始面试时会自动请求麦克风权限；如果设备名没有刷新出来，重新点一次“检测”即可。
                      </p>
                    </section>

                    <section className='border-border/60 border-b py-3'>
                      <p className='mb-3 font-medium text-sm'>当前状态</p>
                      <div className='grid gap-2'>
                        <div className='px-1 py-1'>
                          <p className='text-muted-foreground text-[11px]'>面试阶段</p>
                          <p className='mt-1 font-medium text-sm'>{interviewStage}</p>
                        </div>
                        <div className='px-1 py-1'>
                          <p className='text-muted-foreground text-[11px]'>通话状态</p>
                          <p className='mt-1 font-medium text-sm'>{connectionSummary}</p>
                        </div>
                        <div className='px-1 py-1'>
                          <p className='text-muted-foreground text-[11px]'>当前设备</p>
                          <p className='mt-1 truncate font-medium text-sm'>{selectedDeviceLabel}</p>
                        </div>
                        <div className='px-1 py-1'>
                          <p className='text-muted-foreground text-[11px]'>权限状态</p>
                          <p className='mt-1 font-medium text-sm'>{hasMicPermission ? '已获取麦克风权限' : '开始时请求权限'}</p>
                        </div>
                        <div className='px-1 py-1'>
                          <p className='text-muted-foreground text-[11px]'>记录条数</p>
                          <p className='mt-1 font-medium text-sm'>
                            {turns.length}
                            {' '}
                            条
                          </p>
                        </div>
                      </div>
                    </section>

                    <section className='py-3'>
                      <p className='mb-3 font-medium text-sm'>对话摘要</p>
                      <div className='space-y-3'>
                        <div>
                          <p className='text-muted-foreground text-[11px]'>最近一条追问</p>
                          <p className='mt-1 text-sm leading-6'>
                            {latestAgentTurn?.text ?? '开始后这里会显示最近一条面试官追问。'}
                          </p>
                        </div>
                        <div>
                          <p className='text-muted-foreground text-[11px]'>最近一条作答</p>
                          <p className='mt-1 text-sm leading-6'>
                            {latestUserTurn?.text ?? '候选人开口后，这里会显示最近一条回答。'}
                          </p>
                        </div>
                      </div>
                    </section>
                  </>
                )}
          </div>

          <div className='border-border/65 border-t px-2 py-2'>
            {showExpandedSidebar
              ? (
                  <div className='flex items-center gap-2'>
                    {isSessionPending
                      ? <div className='h-9 w-full animate-pulse rounded-full bg-muted' />
                      : session?.user
                        ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  className='w-full justify-start gap-2 rounded-full p-1!'
                                  type='button'
                                  variant='ghost'
                                >
                                  <Avatar size='default'>
                                    <AvatarImage alt={userName} src={session.user.image ?? undefined} />
                                    <AvatarFallback>{userInitials}</AvatarFallback>
                                  </Avatar>
                                  <div className='min-w-0 flex-1 text-left'>
                                    <p className='truncate font-medium text-sm'>{userName}</p>
                                    <p className='truncate text-muted-foreground text-xs'>{userEmail}</p>
                                  </div>
                                  <ChevronsUpDownIcon className='size-4 text-muted-foreground' />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align='end' className='w-56'>
                                <DropdownMenuLabel className='space-y-0.5'>
                                  <p className='truncate font-medium text-sm'>{userName}</p>
                                  <p className='truncate text-muted-foreground text-xs'>{userEmail}</p>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleSignOut} variant='destructive'>
                                  <LogOutIcon className='mr-2 size-4' />
                                  退出登录
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )
                        : <GoogleSignInButton callbackURL='/interview' />}
                  </div>
                )
              : session?.user
                ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label='用户菜单'
                          className='w-full'
                          size='icon'
                          type='button'
                          variant='ghost'
                        >
                          <Avatar size='sm'>
                            <AvatarImage alt={userName} src={session.user.image ?? undefined} />
                            <AvatarFallback>{userInitials}</AvatarFallback>
                          </Avatar>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end' className='w-56'>
                        <DropdownMenuLabel className='space-y-0.5'>
                          <p className='truncate font-medium text-sm'>{userName}</p>
                          <p className='truncate text-muted-foreground text-xs'>{userEmail}</p>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleSignOut} variant='destructive'>
                          <LogOutIcon className='mr-2 size-4' />
                          退出登录
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                : (
                    <Button
                      aria-label='登录'
                      className='w-full'
                      onClick={() => {
                        authClient.signIn.social({
                          provider: 'google',
                          callbackURL: '/interview',
                        });
                      }}
                      size='icon'
                      type='button'
                      variant='ghost'
                    >
                      <UserIcon className='size-4' />
                    </Button>
                  )}
          </div>
        </aside>

        <section className='flex min-h-0 flex-col bg-transparent'>
          <div className='mx-auto flex h-full w-full max-w-5xl min-w-0 flex-col px-1 pt-4 pb-2 sm:px-2 sm:pt-6 sm:pb-4'>
            <header className='px-1'>
              <div className='mb-2 flex items-center gap-2 sm:hidden'>
                <Button
                  aria-controls='interview-sidebar'
                  aria-expanded={isMobileSidebarOpen}
                  onClick={() => setIsMobileSidebarOpen(true)}
                  size='sm'
                  type='button'
                  variant='outline'
                >
                  <PanelLeftOpenIcon className='mr-1 size-4' />
                  设置
                </Button>
              </div>

              <h1 className='pixel-title text-balance font-bold tracking-tight text-2xl sm:text-3xl'>
                AI面试
              </h1>
              <p className='mt-2 max-w-3xl font-serif! text-xs text-muted-foreground sm:text-sm'>
                支持语音面试开场、实时记录追问过程，并让面试官持续掌握当前节奏。
              </p>
            </header>

            <div className='relative mt-4 min-h-0 flex-1 overflow-hidden'>
              <Conversation className='h-full'>
                <ConversationContent className='gap-6 px-0 py-4 sm:py-6'>
                  {turns.length === 0
                    ? (
                        <ConversationEmptyState
                          className='my-10 rounded-2xl border border-dashed border-border/70 bg-background/70'
                          description='点击下方“开始面试”后，这里会依次显示面试官追问与候选人回答。'
                          icon={<SparklesIcon className='size-5' />}
                          title='准备开始一轮面试'
                        />
                      )
                    : turns.map(turn => (
                        <div key={turn.id}>
                          <p
                            className={cn(
                              'mb-1 text-muted-foreground text-xs',
                              turn.role === 'user' ? 'text-right' : 'text-left',
                            )}
                          >
                            {turn.role === 'agent' ? '面试官' : '候选人'}
                            {' · '}
                            {formatMessageTime(turn.createdAt)}
                          </p>

                          <Message from={turn.role === 'agent' ? 'assistant' : 'user'}>
                            <MessageContent>
                              <MessageResponse>{turn.text}</MessageResponse>
                            </MessageContent>
                          </Message>
                        </div>
                      ))}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>
            </div>

            <div className='mt-4 px-1'>
              <PromptInput
                className='**:data-[slot=input-group]:rounded-[1.3rem] **:data-[slot=input-group]:border-border/65 **:data-[slot=input-group]:bg-white **:data-[slot=input-group]:shadow-[0_8px_18px_-20px_rgba(60,44,23,0.5)]'
                onSubmit={() => undefined}
              >
                <PromptInputBody>
                  <div className='px-3 pt-3 pb-2 w-full'>
                    <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                      <LevelBar colorClassName='bg-sky-500' isActive={isConnected} label='候选人音量' value={inputLevel} />
                      <LevelBar colorClassName='bg-amber-500' isActive={isConnected} label='面试官音量' value={outputLevel} />
                    </div>
                  </div>
                </PromptInputBody>

                <PromptInputFooter className='px-3 pb-3 pt-1'>
                  <p className='text-muted-foreground text-xs'>
                    开始后系统会自动监听发言节奏，并把内容同步整理到上方记录区。
                  </p>

                  <div className='flex items-center gap-2'>
                    <Button
                      disabled={isConnected || statusText === 'connecting'}
                      onClick={startInterview}
                      type='button'
                    >
                      <MicIcon className='size-4' />
                      开始面试
                    </Button>
                    <Button
                      disabled={!isConnected}
                      onClick={stopInterview}
                      type='button'
                      variant='outline'
                    >
                      <PhoneOffIcon className='size-4' />
                      结束面试
                    </Button>
                  </div>
                </PromptInputFooter>
              </PromptInput>

              {errorText
                ? (
                    <p aria-live='polite' className='mt-2 px-1 text-destructive text-sm'>
                      {errorText}
                    </p>
                  )
                : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
