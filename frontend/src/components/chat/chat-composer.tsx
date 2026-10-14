"use client";

import { type FormEvent, type KeyboardEvent, useEffect, useRef } from "react";

import { SendIcon } from "@/components/ui/icons";

type ChatComposerProps = {
  disabled: boolean;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export default function ChatComposer({ disabled, draft, onChange, onSubmit }: ChatComposerProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const element = textAreaRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`;
  }, [draft]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--chat)] px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-5 sm:pt-4">
      <form className="mx-auto max-w-3xl" onSubmit={onSubmit}>
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-2 shadow-[0_10px_35px_rgba(0,0,0,0.2)] transition focus-within:border-[#A78BFA]/70 focus-within:ring-2 focus-within:ring-[#A78BFA]/20">
          <label className="sr-only" htmlFor="conversation-message">Message your AI assistant</label>
          <textarea
            className="max-h-44 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
            disabled={disabled}
            id="conversation-message"
            maxLength={4000}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your AI assistant..."
            ref={textAreaRef}
            rows={1}
            value={draft}
          />
          <button
            aria-label="Send message"
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#A78BFA] text-zinc-950 transition hover:bg-[#C4B5FD] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] disabled:cursor-not-allowed disabled:bg-[var(--surface-hover)] disabled:text-[var(--muted)]"
            disabled={disabled || !draft.trim()}
            type="submit"
          >
            <SendIcon size={18} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--muted)]">AI can make mistakes. Verify important information.</p>
      </form>
    </div>
  );
}
