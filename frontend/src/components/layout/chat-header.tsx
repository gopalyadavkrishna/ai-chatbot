"use client";

import IconButton from "@/components/ui/icon-button";
import { MenuIcon, PlusIcon, SettingsIcon } from "@/components/ui/icons";

type ChatHeaderProps = {
  chatbotName: string;
  connected: boolean;
  onMenu: () => void;
  onNewConversation: () => void;
  onSettings: () => void;
};

export default function ChatHeader({ chatbotName, connected, onMenu, onNewConversation, onSettings }: ChatHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border)] px-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <IconButton className="lg:hidden" label="Open menu" onClick={onMenu}><MenuIcon size={20} /></IconButton>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-[var(--text)] sm:text-base">{chatbotName}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <span className={`size-1.5 rounded-full ${connected ? "bg-[#34D399] shadow-[0_0_10px_rgba(52,211,153,0.8)]" : "bg-[#F87171]"}`} />
            {connected ? "Connected" : "Connection unavailable"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <IconButton label="New conversation" onClick={onNewConversation}><PlusIcon size={19} /></IconButton>
        <IconButton label="Chat settings" onClick={onSettings}><SettingsIcon size={19} /></IconButton>
      </div>
    </header>
  );
}
