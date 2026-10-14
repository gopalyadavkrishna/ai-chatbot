"use client";

import { motion, useReducedMotion } from "framer-motion";

import { DocumentIcon, SparkleIcon } from "@/components/ui/icons";

const suggestions = [
  { title: "Learn something", description: "Explain a complex topic simply.", prompt: "Explain a complex topic simply." },
  { title: "Write & create", description: "Help me write, plan, and brainstorm.", prompt: "Help me write, plan, and brainstorm." },
  { title: "Code assistant", description: "Debug code or build an application.", prompt: "Help me debug code or build an application." },
  { title: "Research assistant", description: "Analyze information and summarize findings.", prompt: "Analyze information and summarize findings." },
];

export default function ChatWelcome({ onSelectSuggestion }: { onSelectSuggestion: (prompt: string) => void }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12 sm:px-8"
      initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
      transition={{ duration: reduceMotion ? 0 : 0.3 }}
    >
      <div className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#A78BFA]/30 bg-[#A78BFA]/10 text-[#C4B5FD] shadow-[0_0_42px_rgba(167,139,250,0.18)]">
        <SparkleIcon size={28} />
      </div>
      <h2 className="mt-6 text-center text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">Your ideas, amplified.</h2>
      <p className="mt-3 text-center text-sm text-[var(--muted)] sm:text-base">Ask anything. Build something extraordinary.</p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        {suggestions.map((suggestion, index) => (
          <motion.button
            className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left shadow-sm transition hover:border-[#A78BFA]/45 hover:bg-[var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[#A78BFA]"
            key={suggestion.title}
            onClick={() => onSelectSuggestion(suggestion.prompt)}
            type="button"
            whileHover={reduceMotion ? undefined : { y: -2 }}
            transition={{ duration: 0.16, delay: reduceMotion ? 0 : index * 0.02 }}
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-[#22D3EE]/10 text-[#67E8F9]"><DocumentIcon size={17} /></span>
            <span className="mt-4 block font-medium text-[var(--text)]">{suggestion.title}</span>
            <span className="mt-1 block text-sm leading-5 text-[var(--muted)]">{suggestion.description}</span>
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
