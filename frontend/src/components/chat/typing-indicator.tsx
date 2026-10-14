"use client";

import { motion, useReducedMotion } from "framer-motion";

export default function TypingIndicator({ chatbotName }: { chatbotName: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-5 sm:px-8" role="status">
      <div className="grid size-7 place-items-center rounded-lg bg-[#A78BFA]/15 text-xs font-semibold text-[#C4B5FD]">AI</div>
      <div className="flex items-center gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
        {[0, 1, 2].map((dot) => (
          <motion.span
            animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            className="size-1.5 rounded-full bg-[#A78BFA]"
            key={dot}
            transition={{ duration: 0.85, repeat: Infinity, delay: dot * 0.14 }}
          />
        ))}
        <span className="ml-2 text-xs text-[var(--muted)]">{chatbotName} is thinking</span>
      </div>
    </div>
  );
}
