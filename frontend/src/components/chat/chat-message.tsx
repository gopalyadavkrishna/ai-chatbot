"use client";

import { type ReactElement, type ReactNode, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import IconButton from "@/components/ui/icon-button";
import { CopyIcon, SparkleIcon } from "@/components/ui/icons";
import type { ChatMessage as ChatMessageType } from "@/lib/types";

type ChatMessageProps = {
  chatbotName: string;
  message: ChatMessageType;
  onCopied: () => void;
};

export default function ChatMessage({ chatbotName, message, onCopied }: ChatMessageProps) {
  const reduceMotion = useReducedMotion();
  const isUser = message.role === "user";
  return (
    <motion.article
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl gap-3 px-4 py-5 sm:px-8"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.18 }}
    >
      <div className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-semibold ${isUser ? "bg-[#22D3EE]/15 text-[#67E8F9]" : "bg-[#A78BFA]/15 text-[#C4B5FD]"}`}>
        {isUser ? "You" : <SparkleIcon size={15} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-[var(--text)]">{isUser ? "You" : chatbotName}</p>
          <time className="text-xs text-[var(--muted)]" dateTime={message.created_at}>{formatTime(message.created_at)}</time>
        </div>
        {isUser ? (
          <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-[var(--text)]">{message.content}</p>
        ) : (
          <div className="markdown-content mt-2 text-[15px] leading-7 text-[var(--text)]">
            <ReactMarkdown
              components={{
                a: ({ children, href }) => <a href={href} rel="noreferrer" target="_blank">{children}</a>,
                pre: ({ children }) => <CodeBlock onCopied={onCopied}>{children}</CodeBlock>,
              }}
              rehypePlugins={[rehypeHighlight]}
              remarkPlugins={[remarkGfm]}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.sources.length > 0 && (
          <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
            Sources: {message.sources.map((source) => `${source.document_name}${source.page_number ? ` · page ${source.page_number}` : ""}`).join(", ")}
          </p>
        )}
        {!isUser && (
          <div className="mt-3 flex gap-1">
            <IconButton className="size-8" label="Copy response" onClick={() => void copyMessage(message.content, onCopied)}><CopyIcon size={15} /></IconButton>
          </div>
        )}
      </div>
    </motion.article>
  );
}

function CodeBlock({ children, onCopied }: { children?: ReactNode; onCopied: () => void }) {
  const [copied, setCopied] = useState(false);
  const codeElement = children as ReactElement<{ children?: ReactNode }>;
  const code = String(codeElement?.props?.children ?? "").replace(/\n$/, "");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopied();
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access may be blocked by an older browser or an insecure context.
    }
  }

  return (
    <div className="code-block relative my-4 overflow-hidden rounded-xl border border-[var(--border)] bg-[#111114]">
      <button className="absolute right-2 top-2 z-10 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-zinc-300 transition hover:bg-white/10" onClick={() => void copyCode()} type="button">
        {copied ? "Copied" : "Copy"}
      </button>
      <pre>{children}</pre>
    </div>
  );
}

async function copyMessage(content: string, onCopied: () => void) {
  try {
    await navigator.clipboard.writeText(content);
    onCopied();
  } catch {
    // The message remains selectable if clipboard access is unavailable.
  }
}

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}
