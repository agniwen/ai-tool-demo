"use client";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  chatHistoryDB,
  type StoredConversation,
} from "@/lib/chat-history-db";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type ChatStatus,
  type DynamicToolUIPart,
  type FileUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  RefreshCcwIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type MessagePart = UIMessage["parts"][number];

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const CHAT_REQUEST_TIMEOUT_MS = 8 * 60 * 1000;

const QUICK_SUGGESTIONS = [
  "给我一个实习生简历筛选的评分标准（100分制）。",
  "我上传了两份简历，请帮我对比并给出推荐顺序。",
  "请输出候选人的亮点、风险点和追问问题。",
  "这份简历是否建议进入面试？请给出理由。",
];

const NEW_CHAT_TITLE = "新对话";
const GENERATING_CHAT_TITLE = "生成中...";
const MAX_CHAT_TITLE_LENGTH = 28;
const SESSION_QUERY_KEY = "session";

const sidebarTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

type ConversationListItem = Pick<
  StoredConversation,
  "id" | "title" | "updatedAt" | "isTitleGenerating"
>;

const isTextPart = (
  part: MessagePart
): part is Extract<MessagePart, { type: "text" }> => part.type === "text";

const isFilePart = (
  part: MessagePart
): part is Extract<MessagePart, { type: "file" }> => part.type === "file";

const isReasoningPart = (
  part: MessagePart
): part is Extract<MessagePart, { type: "reasoning" }> =>
  part.type === "reasoning";

const isSourceUrlPart = (
  part: MessagePart
): part is Extract<MessagePart, { type: "source-url" }> =>
  part.type === "source-url";

const isToolPart = (part: MessagePart): part is ToolUIPart | DynamicToolUIPart =>
  part.type === "dynamic-tool" || part.type.startsWith("tool-");

const toDownloadMessage = (message: UIMessage) => {
  const text = message.parts
    .filter(isTextPart)
    .map((part) => part.text)
    .join("\n\n")
    .trim();

  if (text) {
    return { content: text, role: message.role };
  }

  const hasFiles = message.parts.some(isFilePart);
  const hasTools = message.parts.some(isToolPart);
  const fallback = hasFiles
    ? "[Attachment]"
    : hasTools
      ? "[Tool Call]"
      : "[Empty Message]";

  return {
    content: fallback,
    role: message.role,
  };
};

const getMessageTimeText = (message: UIMessage): string | null => {
  const createdAt = (message as UIMessage & {
    createdAt?: Date | string | number;
  }).createdAt;

  if (!createdAt) {
    return null;
  }

  const parsed =
    createdAt instanceof Date ? createdAt : new Date(createdAt);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return timeFormatter.format(parsed);
};

const getConversationTitleFromMessages = (
  messages: UIMessage[],
  fallbackTitle: string = NEW_CHAT_TITLE
) => {
  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return fallbackTitle;
  }

  const text = firstUserMessage.parts
    .filter(isTextPart)
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(" ")
    .trim();

  if (text.length > 0) {
    return text.slice(0, MAX_CHAT_TITLE_LENGTH);
  }

  if (firstUserMessage.parts.some(isFilePart)) {
    return "含附件对话";
  }

  return fallbackTitle;
};

function ComposerAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments className="w-full" variant="inline">
      {attachments.files.map((file) => (
        <Attachment
          data={file}
          key={file.id}
          onRemove={() => attachments.remove(file.id)}
        >
          <AttachmentPreview />
          <AttachmentInfo />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
}

function ResumeScreeningIllustration() {
  return (
    <div className="mx-auto w-fit rounded-2xl border border-blue-100/70 bg-white/75 p-2 shadow-[0_16px_32px_-24px_rgba(59,130,246,0.55)] backdrop-blur-sm">
      <div
        aria-label="简历筛选插画"
        className="h-24 w-24 rounded-xl bg-cover bg-center sm:h-28 sm:w-28"
        role="img"
        style={{
          backgroundImage:
            "url('https://cdn.undraw.co/illustration/recruiter-suggestions_afdd.svg')",
          filter: "hue-rotate(28deg) saturate(0.88)",
        }}
      />
    </div>
  );
}

function ToolPartView({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const defaultOpen =
    part.state === "output-available" || part.state === "output-error";

  return (
    <Tool defaultOpen={defaultOpen}>
      {part.type === "dynamic-tool" ? (
        <ToolHeader
          state={part.state}
          toolName={part.toolName}
          type="dynamic-tool"
        />
      ) : (
        <ToolHeader state={part.state} type={part.type} />
      )}

      <ToolContent>
        <ToolInput input={part.input} />
        <ToolOutput errorText={part.errorText} output={part.output} />
      </ToolContent>
    </Tool>
  );
}

function ComposerFooter({
  input,
  hasJobDescription,
  onClearJobDescription,
  onOpenJobDescriptionSettings,
  status,
  stop,
}: {
  input: string;
  hasJobDescription: boolean;
  onClearJobDescription: () => void;
  onOpenJobDescriptionSettings: () => void;
  status: ChatStatus;
  stop: () => void;
}) {
  const attachments = usePromptInputAttachments();
  const canSubmit =
    input.trim().length > 0 || attachments.files.length > 0;

  return (
    <PromptInputFooter>
      <PromptInputTools>
        <PromptInputActionMenu>
          <PromptInputActionMenuTrigger tooltip="更多输入操作" />
          <PromptInputActionMenuContent>
            <PromptInputActionAddAttachments label="上传 PDF 简历" />

            <PromptInputActionMenuItem
              onSelect={(event) => {
                event.preventDefault();
                attachments.clear();
              }}
            >
              <Trash2Icon className="mr-2 size-4" />
              清空附件
            </PromptInputActionMenuItem>
          </PromptInputActionMenuContent>
        </PromptInputActionMenu>

        <PromptInputActionMenu>
          <PromptInputActionMenuTrigger tooltip="岗位设置">
            <SettingsIcon className="size-4" />
          </PromptInputActionMenuTrigger>
          <PromptInputActionMenuContent>
            <PromptInputActionMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onOpenJobDescriptionSettings();
              }}
            >
              <FileTextIcon className="mr-2 size-4" />
              设置岗位描述（JD）
            </PromptInputActionMenuItem>

            <PromptInputActionMenuItem
              disabled={!hasJobDescription}
              onSelect={(event) => {
                event.preventDefault();
                onClearJobDescription();
              }}
            >
              <Trash2Icon className="mr-2 size-4" />
              清空岗位描述
            </PromptInputActionMenuItem>
          </PromptInputActionMenuContent>
        </PromptInputActionMenu>
      </PromptInputTools>

      <div className="flex items-center gap-2">
        <span className="hidden text-muted-foreground text-xs sm:inline">
          {status === "streaming"
            ? "正在分析简历内容…"
            : hasJobDescription
              ? "已配置岗位描述（JD）"
              : "未配置岗位描述（可在岗位设置中配置）"}
        </span>
        <PromptInputSubmit
          disabled={status === "ready" ? !canSubmit : false}
          onStop={stop}
          status={status}
        />
      </div>
    </PromptInputFooter>
  );
}

export default function Home() {
  const [input, setInput] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    null
  );
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isHistoryReady, setIsHistoryReady] = useState(false);
  const [historyErrorMessage, setHistoryErrorMessage] = useState<string | null>(
    null
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isJobDescriptionDialogOpen, setIsJobDescriptionDialogOpen] =
    useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionDraft, setJobDescriptionDraft] = useState("");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null
  );

  const {
    messages,
    sendMessage,
    setMessages,
    status,
    stop,
    error,
    regenerate,
  } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: async (input, init) => {
        const timeoutController = new AbortController();
        const timeoutId = window.setTimeout(() => {
          timeoutController.abort("Chat request timed out after 8 minutes.");
        }, CHAT_REQUEST_TIMEOUT_MS);

        if (init?.signal) {
          if (init.signal.aborted) {
            timeoutController.abort(init.signal.reason);
          } else {
            init.signal.addEventListener(
              "abort",
              () => timeoutController.abort(init.signal?.reason),
              { once: true }
            );
          }
        }

        try {
          return await fetch(input, {
            ...init,
            signal: timeoutController.signal,
          });
        } finally {
          window.clearTimeout(timeoutId);
        }
      },
    }),
  });

  const downloadableMessages = useMemo(
    () => messages.map(toDownloadMessage),
    [messages]
  );

  const normalizedJobDescription = jobDescription.trim();
  const hasJobDescription = normalizedJobDescription.length > 0;

  const isStreaming = status === "submitted" || status === "streaming";
  const lastMessage = messages.at(-1);
  const showAssistantThinkingBubble =
    isStreaming && lastMessage?.role === "user";

  const updateSessionInUrl = useCallback(
    (sessionId: string | null) => {
      const params = new URLSearchParams(window.location.search);

      if (sessionId) {
        params.set(SESSION_QUERY_KEY, sessionId);
      } else {
        params.delete(SESSION_QUERY_KEY);
      }

      const query = params.toString();
      const nextUrl = query
        ? `${window.location.pathname}?${query}`
        : window.location.pathname;

      window.history.replaceState(window.history.state, "", nextUrl);
    },
    []
  );

  const refreshConversationList = useCallback(async () => {
    const rows = await chatHistoryDB.conversations
      .orderBy("createdAt")
      .reverse()
      .toArray();

    setConversations(
      rows.map((item) => ({
        id: item.id,
        title: item.title,
        updatedAt: item.updatedAt,
        isTitleGenerating: item.isTitleGenerating,
      }))
    );
  }, []);

  const persistConversation = useCallback(async ({
    id,
    nextMessages,
    nextJobDescription,
    createdAt,
    forcedTitle,
    forcedIsTitleGenerating,
  }: {
    id: string;
    nextMessages: UIMessage[];
    nextJobDescription: string;
    createdAt?: number;
    forcedTitle?: string;
    forcedIsTitleGenerating?: boolean;
  }) => {
    const existing = await chatHistoryDB.conversations.get(id);
    const now = Date.now();
    const derivedTitle = getConversationTitleFromMessages(
      nextMessages,
      existing?.title ?? NEW_CHAT_TITLE
    );
    const shouldKeepExistingTitle =
      typeof existing?.title === "string" && existing.title !== NEW_CHAT_TITLE;
    const shouldKeepGeneratingTitle =
      existing?.isTitleGenerating === true && !forcedTitle;
    const resolvedTitle = forcedTitle
      ? forcedTitle
      : shouldKeepGeneratingTitle
        ? existing?.title ?? GENERATING_CHAT_TITLE
        : shouldKeepExistingTitle
          ? existing.title
          : derivedTitle;
    const isTitleGenerating =
      typeof forcedIsTitleGenerating === "boolean"
        ? forcedIsTitleGenerating
        : existing?.isTitleGenerating ?? false;

    await chatHistoryDB.conversations.put({
      id,
      createdAt: createdAt ?? existing?.createdAt ?? now,
      updatedAt: now,
      title: resolvedTitle,
      isTitleGenerating,
      messages: nextMessages,
      jobDescription: nextJobDescription.trim(),
    });

    await refreshConversationList();
  }, [refreshConversationList]);

  const updateConversationTitle = useCallback(
    async (id: string, title: string) => {
      const conversation = await chatHistoryDB.conversations.get(id);

      if (!conversation) {
        return;
      }

      const normalizedTitle = title.trim().slice(0, MAX_CHAT_TITLE_LENGTH);

      if (!normalizedTitle) {
        return;
      }

      await chatHistoryDB.conversations.put({
        ...conversation,
        title: normalizedTitle,
        isTitleGenerating: false,
      });

      await refreshConversationList();
    },
    [refreshConversationList]
  );

  const ensureConversation = async ({
    withGeneratingTitle,
  }: {
    withGeneratingTitle?: boolean;
  } = {}) => {
    if (activeConversationId) {
      return activeConversationId;
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await persistConversation({
      id,
      nextMessages: messages,
      nextJobDescription: jobDescription,
      createdAt: now,
      forcedTitle: withGeneratingTitle ? GENERATING_CHAT_TITLE : undefined,
      forcedIsTitleGenerating: withGeneratingTitle,
    });

    updateSessionInUrl(id);
    setActiveConversationId(id);
    return id;
  };

  const sendMessageToChat = async ({
    files,
    text,
  }: {
    text: string;
    files?: FileUIPart[];
  }) => {
    const isFirstMessageForNewConversation =
      !activeConversationId && messages.length === 0;
    let conversationId: string | null = activeConversationId;

    try {
      conversationId = await ensureConversation({
        withGeneratingTitle: isFirstMessageForNewConversation,
      });
      setHistoryErrorMessage(null);
    } catch {
      setHistoryErrorMessage("本地聊天记录保存失败，请检查浏览器存储权限。");
    }

    if (isFirstMessageForNewConversation && conversationId) {
      const firstMessageText = text.trim();

      if (firstMessageText.length > 0) {
        void fetch("/api/chat-title", {
          body: JSON.stringify({
            hasFiles: Boolean(files?.length),
            text: firstMessageText,
          }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        })
          .then(async (response) => {
            if (!response.ok) {
              return null;
            }

            const payload = (await response.json()) as {
              title?: string;
            };

            return payload.title?.trim() ?? null;
          })
          .then(async (title) => {
            if (title) {
              await updateConversationTitle(conversationId, title);
              return;
            }

            await updateConversationTitle(conversationId, NEW_CHAT_TITLE);
          })
          .catch(() => {
            void updateConversationTitle(conversationId, NEW_CHAT_TITLE);
            setHistoryErrorMessage("会话已创建，但智能标题生成失败。已使用默认标题。");
          });
      }
    }

    sendMessage(
      {
        files,
        text,
      },
      hasJobDescription
        ? {
            body: {
              jobDescription: normalizedJobDescription,
            },
          }
        : undefined
    );
  };

  const startNewConversation = useCallback(
    ({
      shouldSyncUrl = true,
    }: {
      shouldSyncUrl?: boolean;
    } = {}) => {
      stop();
      setIsMobileSidebarOpen(false);
      if (shouldSyncUrl) {
        updateSessionInUrl(null);
      }
      setActiveConversationId(null);
      setMessages([]);
      setInput("");
      setHistoryErrorMessage(null);
      setJobDescription("");
      setJobDescriptionDraft("");
      setUploadErrorMessage(null);
      setIsJobDescriptionDialogOpen(false);
    },
    [stop, updateSessionInUrl, setMessages]
  );

  const openConversation = useCallback(
    async (
      id: string,
      {
        shouldSyncUrl = true,
      }: {
        shouldSyncUrl?: boolean;
      } = {}
    ) => {
      const conversation = await chatHistoryDB.conversations.get(id);

      if (!conversation) {
        await refreshConversationList();
        updateSessionInUrl(null);
        setHistoryErrorMessage("未找到对应的会话记录，已回到新对话。");
        return;
      }

      stop();
      setIsMobileSidebarOpen(false);
      if (shouldSyncUrl) {
        updateSessionInUrl(id);
      }
      setActiveConversationId(id);
      setMessages(conversation.messages);
      setInput("");
      setHistoryErrorMessage(null);
      setJobDescription(conversation.jobDescription);
      setJobDescriptionDraft(conversation.jobDescription);
      setUploadErrorMessage(null);
      setIsJobDescriptionDialogOpen(false);
    },
    [refreshConversationList, stop, updateSessionInUrl, setMessages]
  );

  const deleteConversation = async (id: string) => {
    await chatHistoryDB.conversations.delete(id);

    if (id === activeConversationId) {
      startNewConversation();
    }

    await refreshConversationList();
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await refreshConversationList();
        const sessionId =
          new URLSearchParams(window.location.search)
            .get(SESSION_QUERY_KEY)
            ?.trim() ?? null;

        if (sessionId) {
          await openConversation(sessionId, { shouldSyncUrl: false });
          return;
        }

        setHistoryErrorMessage(null);
      } catch {
        setHistoryErrorMessage("本地聊天记录不可用，侧边栏将不显示历史记录。");
      } finally {
        setIsHistoryReady(true);
      }
    };

    void bootstrap();
  }, [openConversation, refreshConversationList]);

  useEffect(() => {
    if (!isHistoryReady || !activeConversationId) {
      return;
    }

    const saveTimer = window.setTimeout(() => {
      void persistConversation({
        id: activeConversationId,
        nextMessages: messages,
        nextJobDescription: jobDescription,
      }).catch(() => {
        setHistoryErrorMessage("聊天已继续，但本地记录更新失败。");
      });
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [
    activeConversationId,
    isHistoryReady,
    jobDescription,
    messages,
    persistConversation,
  ]);

  const openJobDescriptionDialog = () => {
    setJobDescriptionDraft(jobDescription);
    setIsJobDescriptionDialogOpen(true);
  };

  const saveJobDescription = () => {
    setJobDescription(jobDescriptionDraft.trim());
    setIsJobDescriptionDialogOpen(false);
  };

  const clearJobDescription = () => {
    setJobDescription("");
    setJobDescriptionDraft("");
  };

  const regenerateLastReply = () => {
    regenerate(
      hasJobDescription
        ? {
            body: {
              jobDescription: normalizedJobDescription,
            },
          }
        : undefined
    );
  };

  const handleCopy = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 1200);
    } catch {
      setCopiedMessageId(null);
    }
  };

  const showExpandedSidebar = !isSidebarCollapsed || isMobileSidebarOpen;

  return (
    <div className="flex h-dvh w-full gap-3  pr-3 sm:pr-6">
      {isMobileSidebarOpen ? (
        <button
          aria-label="关闭聊天记录侧边栏"
          className="fixed inset-0 z-30 bg-black/18 backdrop-blur-[1px] sm:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(82vw,20rem)] shrink-0 flex-col overflow-hidden border-r border-border/75 bg-card/95 shadow-[0_14px_36px_-32px_rgba(52,96,168,0.6)] transition-transform duration-200 sm:static sm:z-auto sm:bg-card/80 sm:transition-[width] ${
          isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"
        } ${
          isSidebarCollapsed ? "sm:w-14" : "sm:w-72"
        }`}
        id="chat-history-sidebar"
      >
        <div className="flex items-center gap-1 border-border/65 border-b px-2 py-2">
          <Button
            aria-label={isSidebarCollapsed ? "展开聊天侧边栏" : "收起聊天侧边栏"}
            className="hidden sm:inline-flex"
            onClick={() => setIsSidebarCollapsed((value) => !value)}
            size="icon"
            type="button"
            variant="ghost"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpenIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
          </Button>

          {showExpandedSidebar ? (
            <>
              <p className="truncate font-medium text-sm">聊天记录</p>
              <Button
                className="ml-auto"
                onClick={() => startNewConversation()}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlusIcon className="mr-1 size-3.5" />
                新建
              </Button>
            </>
          ) : null}

          <Button
            aria-label="关闭聊天记录侧边栏"
            className="ml-auto sm:hidden"
            onClick={() => setIsMobileSidebarOpen(false)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <PanelLeftCloseIcon className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
          {isHistoryReady && conversations.length === 0 ? (
            <p className="px-2 py-3 text-muted-foreground text-xs">
              {showExpandedSidebar ? "暂无本地聊天记录" : "-"}
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conversation) => {
                const isActive = conversation.id === activeConversationId;
                const visibleTitle = conversation.isTitleGenerating
                  ? GENERATING_CHAT_TITLE
                  : conversation.title;

                return (
                  <li key={conversation.id}>
                    <div
                      className={`group flex items-center gap-1 rounded-xl border border-transparent px-1 py-1 transition-colors ${
                        isActive
                          ? "border-border/75 bg-accent/60"
                          : "hover:bg-accent/40"
                      }`}
                    >
                      <button
                        className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left"
                        onClick={() => {
                          void openConversation(conversation.id);
                        }}
                        type="button"
                      >
                        <p className="truncate font-medium text-sm">
                          {!showExpandedSidebar
                            ? visibleTitle.slice(0, 1)
                            : visibleTitle}
                        </p>
                        {showExpandedSidebar ? (
                          <p className="mt-1 truncate text-muted-foreground text-xs">
                            {sidebarTimeFormatter.format(
                              new Date(conversation.updatedAt)
                            )}
                          </p>
                        ) : null}
                      </button>

                      {showExpandedSidebar ? (
                        <button
                          aria-label="删除聊天记录"
                          className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            void deleteConversation(conversation.id);
                          }}
                          type="button"
                        >
                          <Trash2Icon className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <main className="min-w-0 flex-1" id="main-content">
        <div className="mx-auto flex h-full w-full max-w-5xl flex-col px-1 pt-4 pb-2 sm:pb-4 sm:px-2 sm:pt-6">
      <header className="mb-4 px-1 pb-2">
        <div className="mb-2 flex items-center justify-between gap-2 sm:hidden">
          <Button
            aria-controls="chat-history-sidebar"
            aria-expanded={isMobileSidebarOpen}
            onClick={() => setIsMobileSidebarOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            <PanelLeftOpenIcon className="mr-1 size-4" />
            聊天记录
          </Button>
          <Button onClick={() => startNewConversation()} size="sm" type="button" variant="ghost">
            <PlusIcon className="mr-1 size-4" />
            新建
          </Button>
        </div>
        <h1 className="text-balance font-bold tracking-tight text-2xl sm:text-3xl">
          实习生简历筛选助手
        </h1>
        <p className="mt-2 max-w-3xl font-serif!  text-sm text-muted-foreground sm:text-base">
          支持多份简历上传、初筛评分、风险识别与面试推进建议
        </p>
      </header>

      <section className="mb-3">
        <p className="mb-2 px-1 font-medium text-muted-foreground text-xs">
          快速提问
        </p>
        <Suggestions className="gap-2.5 pb-1">
          {QUICK_SUGGESTIONS.map((suggestion) => (
            <Suggestion
              className="h-auto rounded-2xl border-border/70 bg-card/70 px-4 py-2 text-left text-xs leading-relaxed whitespace-normal hover:bg-accent"
              disabled={isStreaming}
              key={suggestion}
              onClick={(text) => {
                void sendMessageToChat({ text });
              }}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
      </section>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <Conversation className="h-full">
          <ConversationContent className="p-4 sm:p-6">
            {messages.length === 0 ? (
              <ConversationEmptyState
              className="my-8"
                description="上传候选人简历（最多 8 份）或输入筛选要求，助手会给出评分与推荐结论。"
                title="开始筛选实习生简历"
              />
            ) : (
              <>
                {messages.map((message, messageIndex) => {
                const textParts = message.parts.filter(isTextPart);
                const fileParts = message.parts
                  .map((part, index) => {
                    if (!isFilePart(part)) {
                      return null;
                    }

                    return {
                      ...part,
                      id: `${message.id}-file-${index}`,
                    };
                  })
                  .filter((part): part is FileUIPart & { id: string } =>
                    Boolean(part)
                  );
                const sourceParts = message.parts.filter(isSourceUrlPart);
                const reasoningParts = message.parts.filter(isReasoningPart);
                const reasoningText = reasoningParts
                  .map((part) => part.text)
                  .join("\n\n")
                  .trim();
                const isLastMessage = messageIndex === messages.length - 1;
                const isReasoningStreaming =
                  isLastMessage &&
                  isStreaming &&
                  message.parts.at(-1)?.type === "reasoning";
                const assistantText = textParts
                  .map((part) => part.text)
                  .join("\n\n")
                  .trim();
                const isChatRole =
                  message.role === "user" || message.role === "assistant";
                const messageAuthor =
                  message.role === "assistant" ? "简历筛选助手" : "你";
                const messageTime = getMessageTimeText(message);

                  return (
                    <div key={message.id}>
                    {isChatRole ? (
                      <p
                        className={`mb-1 text-muted-foreground text-xs ${message.role === "user" ? "text-right" : "text-left"}`}
                      >
                        {messageAuthor}
                        {messageTime ? ` · ${messageTime}` : ""}
                      </p>
                    ) : null}

                    {message.role === "assistant" && sourceParts.length > 0 ? (
                      <Sources className="mb-2">
                        <SourcesTrigger count={sourceParts.length} />
                        <SourcesContent>
                          {sourceParts.map((part, index) => {
                            const title =
                              "title" in part && typeof part.title === "string"
                                ? part.title
                                : part.url;

                            return (
                              <Source
                                href={part.url}
                                key={`${message.id}-source-${index}`}
                                title={title}
                              />
                            );
                          })}
                        </SourcesContent>
                      </Sources>
                    ) : null}

                    <Message from={message.role}>
                      <MessageContent>
                        {reasoningText ? (
                          <Reasoning
                            className="w-full"
                            isStreaming={isReasoningStreaming}
                          >
                            <ReasoningTrigger />
                            <ReasoningContent>{reasoningText}</ReasoningContent>
                          </Reasoning>
                        ) : null}

                        {fileParts.length > 0 ? (
                          <Attachments
                            className="mb-2"
                            variant={message.role === "user" ? "inline" : "grid"}
                          >
                            {fileParts.map((part) => (
                              <Attachment data={part} key={part.id}>
                                <AttachmentPreview />
                                {message.role === "user" ? (
                                  <AttachmentInfo />
                                ) : null}
                              </Attachment>
                            ))}
                          </Attachments>
                        ) : null}

                        {message.parts.map((part, index) => {
                          if (part.type === "text") {
                            return (
                              <MessageResponse key={`${message.id}-${index}`}>
                                {part.text}
                              </MessageResponse>
                            );
                          }

                          if (isToolPart(part)) {
                            return (
                              <ToolPartView
                                key={`${message.id}-${part.type}-${index}`}
                                part={part}
                              />
                            );
                          }

                          if (part.type === "step-start") {
                            return (
                              <div
                                className="my-3 border-border border-t opacity-50"
                                key={`${message.id}-step-${index}`}
                              />
                            );
                          }

                          return null;
                        })}
                      </MessageContent>
                    </Message>

                    {message.role === "assistant" &&
                    isLastMessage &&
                    assistantText ? (
                      <MessageActions className="mt-2">
                        <MessageAction
                          disabled={isStreaming}
                          label="重新生成"
                          onClick={regenerateLastReply}
                          tooltip="重新生成"
                        >
                          <RefreshCcwIcon className="size-3" />
                        </MessageAction>

                        <MessageAction
                          label="复制内容"
                          onClick={() => handleCopy(message.id, assistantText)}
                          tooltip="复制"
                        >
                          {copiedMessageId === message.id ? (
                            <CheckIcon className="size-3" />
                          ) : (
                            <CopyIcon className="size-3" />
                          )}
                        </MessageAction>
                      </MessageActions>
                    ) : null}
                    </div>
                  );
                })}

                {showAssistantThinkingBubble ? (
                  <div>
                    <p className="mb-1 text-left text-muted-foreground text-xs">
                      简历筛选助手 · {timeFormatter.format(new Date())}
                    </p>
                    <Message from="assistant">
                      <MessageContent className="px-0 py-1">
                        <div
                          aria-label="简历筛选助手正在思考"
                          className="text-muted-foreground/80"
                          role="status"
                        >
                          <Shimmer duration={1.2}>思考中...</Shimmer>
                        </div>
                      </MessageContent>
                    </Message>
                  </div>
                ) : null}
              </>
            )}
          </ConversationContent>

          <ConversationDownload messages={downloadableMessages} />
          <ConversationScrollButton />
        </Conversation>
      </div>

      {error ? (
        <p aria-live="polite" className="mt-3 text-destructive text-sm">
          请求失败。请检查 API 配置后重试。
        </p>
      ) : null}

      {uploadErrorMessage ? (
        <p aria-live="polite" className="mt-2 text-destructive text-sm">
          {uploadErrorMessage}
        </p>
      ) : null}

      {historyErrorMessage ? (
        <p aria-live="polite" className="mt-2 text-destructive text-sm">
          {historyErrorMessage}
        </p>
      ) : null}

      <PromptInput
        accept="application/pdf"
        className="mt-4  **:data-[slot=input-group]:rounded-[1.3rem] **:data-[slot=input-group]:border-border/65 **:data-[slot=input-group]:bg-white **:data-[slot=input-group]:shadow-[0_8px_18px_-20px_rgba(60,44,23,0.5)]"
        maxFiles={8}
        maxFileSize={10 * 1024 * 1024}
        multiple
        onError={({ code }) => {
          if (code === "accept") {
            setUploadErrorMessage("仅支持上传 PDF 文件。");
            return;
          }

          if (code === "max_file_size") {
            setUploadErrorMessage("单个 PDF 文件不能超过 10 MB。");
            return;
          }

          setUploadErrorMessage("最多上传 8 个 PDF 文件。");
        }}
        onSubmit={({ files, text }) => {
          const trimmed = text.trim();
          const hasText = trimmed.length > 0;
          const hasFiles = files.length > 0;

          if (!hasText && !hasFiles) {
            return;
          }

          setUploadErrorMessage(null);

          void sendMessageToChat({
            files,
            text: hasText ? trimmed : "请从实习生招聘视角分析这份简历并给出筛选建议。",
          });
          setInput("");
        }}
      >
        <PromptInputHeader>
          <ComposerAttachments />
        </PromptInputHeader>

        <PromptInputBody >
          <PromptInputTextarea
            autoComplete="off"
            onChange={(event) => setInput(event.currentTarget.value)}
            placeholder="输入岗位与筛选要求，或上传实习生 PDF 简历（支持多文件）…"
            value={input}
          />
        </PromptInputBody>

        <ComposerFooter
          hasJobDescription={hasJobDescription}
          input={input}
          onClearJobDescription={clearJobDescription}
          onOpenJobDescriptionSettings={openJobDescriptionDialog}
          status={status}
          stop={stop}
        />
      </PromptInput>

      <Dialog
        onOpenChange={setIsJobDescriptionDialogOpen}
        open={isJobDescriptionDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>岗位描述（JD）设置</DialogTitle>
            <DialogDescription>
              这里填写的 JD 会作为简历评估的辅助上下文；若你在对话中明确给出 JD，模型会优先使用你在对话中提供的版本。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="job-description">
              岗位描述内容
            </label>
            <textarea
              autoComplete="off"
              className="min-h-40 w-full rounded-xl border border-border/70 bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="job-description"
              name="jobDescription"
              onChange={(event) =>
                setJobDescriptionDraft(event.currentTarget.value)
              }
              placeholder="例如：前端开发实习生，要求 React/TypeScript 基础，至少 1 个完整项目经历…"
              spellCheck={false}
              value={jobDescriptionDraft}
            />
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                clearJobDescription();
                setIsJobDescriptionDialogOpen(false);
              }}
              type="button"
              variant="outline"
            >
              清空
            </Button>
            <Button onClick={saveJobDescription} type="button">
              保存 JD
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        <p className="mt-2  hidden sm:flex items-center gap-1 px-1 text-muted-foreground text-xs">
          <SparklesIcon className="size-3" />
          受限于vercel免费版本的限制，目前连接仅能持续300秒，注意上传简历的文件大小。
        </p>
      </div>
    </main>
    </div>
  );
}
