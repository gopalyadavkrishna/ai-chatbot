"use client";

import { useMemo, useState } from "react";

import IconButton from "@/components/ui/icon-button";
import {
  ChevronIcon,
  CloseIcon,
  MenuIcon,
  MessageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SparkleIcon,
  TrashIcon,
} from "@/components/ui/icons";
import type { Conversation } from "@/lib/types";

type AppSidebarProps = {
  activeConversationId: number | undefined;
  chatbotName: string;
  collapsed?: boolean;
  conversations: Conversation[];
  mobile?: boolean;
  onClose?: () => void;
  onCollapse?: () => void;
  onDelete: (conversation: Conversation) => void;
  onNewConversation: () => void;
  onOpen: (conversationId: number) => void;
  onRename: (conversation: Conversation) => void;
  onSettings: () => void;
  userEmail: string;
};

export default function AppSidebar({
  activeConversationId,
  chatbotName,
  collapsed = false,
  conversations,
  mobile = false,
  onClose,
  onCollapse,
  onDelete,
  onNewConversation,
  onOpen,
  onRename,
  onSettings,
  userEmail,
}: AppSidebarProps) {
  const [search, setSearch] = useState("");
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => conversation.title.toLowerCase().includes(search.toLowerCase())),
    [conversations, search],
  );
  const groups = useMemo(() => groupConversations(visibleConversations), [visibleConversations]);
  const showLabels = !collapsed || mobile;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-3 text-[var(--text)]">
      <div className="flex items-center gap-3 px-1.5 py-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#A78BFA] to-[#22D3EE] text-zinc-950 shadow-[0_0_24px_rgba(167,139,250,0.22)]">
          <SparkleIcon size={18} strokeWidth="2.4" />
        </div>
        {showLabels && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold tracking-tight">CustomAI</p>
            <p className="truncate text-xs text-[var(--muted)]">{chatbotName}</p>
          </div>
        )}
        {mobile ? (
          <IconButton label="Close menu" onClick={onClose}><CloseIcon size={18} /></IconButton>
        ) : (
          <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onCollapse}>
            {collapsed ? <MenuIcon size={18} /> : <ChevronIcon direction="left" size={18} />}
          </IconButton>
        )}
      </div>

      <button
        className={`mt-5 flex items-center justify-center gap-2 rounded-xl bg-[#A78BFA] px-3 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_8px_30px_rgba(167,139,250,0.16)] transition hover:bg-[#C4B5FD] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] ${collapsed && !mobile ? "aspect-square px-0" : ""}`}
        onClick={onNewConversation}
        title="New chat"
        type="button"
      >
        <PlusIcon size={18} strokeWidth="2.4" />
        {showLabels && "New chat"}
      </button>

      {showLabels && (
        <label className="relative mt-4 block">
          <span className="sr-only">Search conversations</span>
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
          <input
            className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted)] focus:border-[#A78BFA] focus:ring-2 focus:ring-[#A78BFA]/25"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            value={search}
          />
        </label>
      )}

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        {showLabels ? (
          groups.length ? groups.map(([label, items]) => (
            <section className="mb-5" key={label}>
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
              <div className="space-y-0.5">
                {items.map((conversation) => (
                  <ConversationRow
                    active={activeConversationId === conversation.id}
                    conversation={conversation}
                    key={conversation.id}
                    onDelete={onDelete}
                    onOpen={onOpen}
                    onRename={onRename}
                  />
                ))}
              </div>
            </section>
          )) : (
            <p className="px-2 py-4 text-sm leading-6 text-[var(--muted)]">
              {search ? "No conversations match your search." : "Your saved conversations will appear here."}
            </p>
          )
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => (
              <IconButton
                className={activeConversationId === conversation.id ? "bg-[var(--surface-hover)] text-[#C4B5FD]" : ""}
                key={conversation.id}
                label={conversation.title}
                onClick={() => onOpen(conversation.id)}
              >
                <MessageIcon size={18} />
              </IconButton>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-[var(--border)] pt-3">
        <button
          className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sm text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] ${collapsed && !mobile ? "justify-center" : ""}`}
          onClick={onSettings}
          title="Settings"
          type="button"
        >
          <SettingsIcon size={18} />
          {showLabels && <span>Settings</span>}
        </button>
        <div className={`mt-2 flex items-center gap-3 px-2 py-1.5 ${collapsed && !mobile ? "justify-center" : ""}`}>
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--surface-elevated)] text-xs font-semibold text-[#C4B5FD]">
            {userEmail.slice(0, 1).toUpperCase()}
          </div>
          {showLabels && <p className="min-w-0 truncate text-sm text-[var(--muted)]">{userEmail}</p>}
        </div>
      </div>
    </aside>
  );
}

function ConversationRow({
  active,
  conversation,
  onDelete,
  onOpen,
  onRename,
}: {
  active: boolean;
  conversation: Conversation;
  onDelete: (conversation: Conversation) => void;
  onOpen: (id: number) => void;
  onRename: (conversation: Conversation) => void;
}) {
  return (
    <div className={`group flex items-center rounded-lg ${active ? "bg-[#A78BFA]/15 text-[#E9D5FF]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]"}`}>
      <button
        className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-sm outline-none focus:ring-2 focus:ring-inset focus:ring-[#A78BFA]"
        onClick={() => onOpen(conversation.id)}
        title={conversation.title}
        type="button"
      >
        {conversation.title}
      </button>
      <div className="mr-1 hidden items-center group-hover:flex group-focus-within:flex">
        <IconButton className="size-7" label="Rename conversation" onClick={() => onRename(conversation)}><PencilIcon size={14} /></IconButton>
        <IconButton className="size-7 hover:text-[#F87171]" label="Delete conversation" onClick={() => onDelete(conversation)}><TrashIcon size={14} /></IconButton>
      </div>
    </div>
  );
}

function groupConversations(conversations: Conversation[]): Array<[string, Conversation[]]> {
  const groups = new Map<string, Conversation[]>();
  for (const conversation of conversations) {
    const label = dateGroup(conversation.updated_at);
    groups.set(label, [...(groups.get(label) ?? []), conversation]);
  }
  return Array.from(groups.entries());
}

function dateGroup(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo <= 7) return "Previous 7 days";
  return "Earlier";
}
