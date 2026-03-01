"use client";

import { Button } from "@/components/ui/button";
import { chatHistoryDB } from "@/lib/chat-history-db";
import { cn } from "@/lib/utils";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isMobileSidebarOpenAtom, isSidebarCollapsedAtom } from "../atoms/sidebar";

type ConversationListItem = {
  id: string;
  title: string;
  updatedAt: number;
  isTitleGenerating: boolean;
};

const GENERATING_CHAT_TITLE = "生成中...";

const sidebarTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export default function ChatSidebar() {
  const pathname = usePathname();
  const params = useParams<{ sessionId?: string | string[] }>();
  const router = useRouter();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useAtom(isSidebarCollapsedAtom);
  const isMobileSidebarOpen = useAtomValue(isMobileSidebarOpenAtom);
  const closeMobileSidebar = useSetAtom(isMobileSidebarOpenAtom);
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [currentPathname, setCurrentPathname] = useState(pathname);

  const activeSessionId = useMemo(() => {
    const routeSessionId = params.sessionId;

    if (typeof routeSessionId === "string" && routeSessionId.trim()) {
      return routeSessionId;
    }

    if (Array.isArray(routeSessionId) && routeSessionId[0]?.trim()) {
      return routeSessionId[0];
    }

    if (!currentPathname.startsWith("/chat/")) {
      return null;
    }

    const id = currentPathname.slice("/chat/".length).split("/")[0];

    return id ? decodeURIComponent(id) : null;
  }, [currentPathname, params.sessionId]);

  useEffect(() => {
    setCurrentPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    const syncPathFromWindow = () => {
      setCurrentPathname(window.location.pathname);
    };

    const syncPathFromCustomEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ pathname?: string }>).detail;

      if (detail?.pathname) {
        setCurrentPathname(detail.pathname);
        return;
      }

      setCurrentPathname(window.location.pathname);
    };

    window.addEventListener("popstate", syncPathFromWindow);
    window.addEventListener("chat:session-path-updated", syncPathFromCustomEvent);

    return () => {
      window.removeEventListener("popstate", syncPathFromWindow);
      window.removeEventListener("chat:session-path-updated", syncPathFromCustomEvent);
    };
  }, []);

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
        isTitleGenerating: item.isTitleGenerating ?? false,
      }))
    );
  }, []);

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => {
      void refreshConversationList();
    }, 0);

    const intervalId = window.setInterval(() => {
      void refreshConversationList();
    }, 1200);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(intervalId);
    };
  }, [refreshConversationList]);

  const handleDelete = useCallback(
    async (id: string) => {
      await chatHistoryDB.conversations.delete(id);
      await refreshConversationList();

      if (activeSessionId === id) {
        router.replace("/chat");
      }
    },
    [activeSessionId, refreshConversationList, router]
  );

  const showExpandedSidebar = !isSidebarCollapsed || isMobileSidebarOpen;

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[min(82vw,20rem)] shrink-0 flex-col overflow-hidden border-r border-border/75 bg-card/95 shadow-[0_14px_36px_-32px_rgba(52,96,168,0.6)] transition-transform duration-200 sm:static sm:z-auto sm:bg-card/80 sm:transition-[width]",
        isMobileSidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0",
        isSidebarCollapsed ? "sm:w-14" : "sm:w-72"
      )}
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
            <Button asChild className="ml-auto" size="sm" type="button" variant="outline">
              <Link href="/chat">
                <PlusIcon className="mr-1 size-3.5" />
                新建
              </Link>
            </Button>
          </>
        ) : null}

        <Button
          aria-label="关闭聊天记录侧边栏"
          className="ml-auto sm:hidden"
          onClick={() => closeMobileSidebar(false)}
          size="icon"
          type="button"
          variant="ghost"
        >
          <PanelLeftCloseIcon className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
        {!showExpandedSidebar ? null : conversations.length === 0 ? (
          <p className="px-2 py-3 text-muted-foreground text-xs">
            暂无本地聊天记录
          </p>
        ) : (
          <ul className="space-y-1">
            {conversations.map((conversation) => {
              const isActive = activeSessionId === conversation.id;
              const visibleTitle = conversation.isTitleGenerating
                ? GENERATING_CHAT_TITLE
                : conversation.title;

              return (
                <li key={conversation.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-1 rounded-xl border border-transparent px-1 py-1 transition-colors",
                      isActive ? "border-border/75 bg-accent/60" : "hover:bg-accent/40"
                    )}
                  >
                    <Link
                      className="min-w-0 flex-1 rounded-md px-2 py-1.5 text-left"
                      href={`/chat/${conversation.id}`}
                    >
                      <p className="truncate font-medium text-sm">{visibleTitle}</p>
                      <p className="mt-1 truncate text-muted-foreground text-xs">
                        {sidebarTimeFormatter.format(new Date(conversation.updatedAt))}
                      </p>
                    </Link>

                    <button
                      aria-label="删除聊天记录"
                      className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDelete(conversation.id);
                      }}
                      type="button"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
