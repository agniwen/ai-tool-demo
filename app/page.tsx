"use client";

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
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
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  CheckIcon,
  CopyIcon,
  FileTextIcon,
  MessageSquareIcon,
  RefreshCcwIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MessagePart = UIMessage["parts"][number];

const timeFormatter = new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const QUICK_SUGGESTIONS = [
  "给我一个实习生简历筛选的评分标准（100分制）。",
  "我上传了两份简历，请帮我对比并给出推荐顺序。",
  "请输出候选人的亮点、风险点和追问问题。",
  "这份简历是否建议进入面试？请给出理由。",
];

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
              : "未配置 JD（可在招聘设置中粘贴）"}
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isJobDescriptionDialogOpen, setIsJobDescriptionDialogOpen] =
    useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [jobDescriptionDraft, setJobDescriptionDraft] = useState("");
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(
    null
  );

  const { messages, sendMessage, status, stop, error, regenerate } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
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

  const sendMessageToChat = ({
    files,
    text,
  }: {
    text: string;
    files?: FileUIPart[];
  }) => {
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

  return (
    <main
      className="mx-auto flex h-dvh w-full max-w-5xl flex-col px-4 pt-5 pb-4 sm:px-6 sm:pt-8"
      id="main-content"
    >
      <header className="mb-4 px-1 py-2">
        <h1 className="text-balance font-semibold tracking-tight text-2xl sm:text-3xl">
          实习生简历筛选助手
        </h1>
        <p className="mt-2 max-w-3xl font-serif text-base text-muted-foreground sm:text-lg">
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
              className="h-auto rounded-2xl border-border/70 bg-card/70 px-4 py-2 text-left text-xs leading-relaxed whitespace-normal hover:bg-accent/50"
              disabled={isStreaming}
              key={suggestion}
              onClick={(text) => {
                sendMessageToChat({ text });
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
                description="上传候选人简历（可多份）或输入筛选要求，助手会给出评分与推荐结论。"
                icon={<MessageSquareIcon className="size-10 text-muted-foreground" />}
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

      <PromptInput
        accept="application/pdf"
        className="mt-4 [&_[data-slot=input-group]]:rounded-[1.3rem] [&_[data-slot=input-group]]:border-border/65 [&_[data-slot=input-group]]:bg-card/95 [&_[data-slot=input-group]]:shadow-[0_8px_18px_-20px_rgba(60,44,23,0.5)]"
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

          sendMessageToChat({
            files,
            text: hasText ? trimmed : "请从实习生招聘视角分析这份简历并给出筛选建议。",
          });
          setInput("");
        }}
      >
        <PromptInputHeader>
          <ComposerAttachments />
        </PromptInputHeader>

        <PromptInputBody>
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

      <p className="mt-2 flex items-center gap-1 px-1 text-muted-foreground text-xs">
        <SparklesIcon className="size-3" />
        当前版本适用于实习生简历初筛，可继续扩展为批量评分与结构化评估报告。
      </p>
    </main>
  );
}
