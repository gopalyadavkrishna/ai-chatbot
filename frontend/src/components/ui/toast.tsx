"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ToastProps = { message: string; onDismiss: () => void };

export default function Toast({ message, onDismiss }: ToastProps) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-5 left-1/2 z-[80] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm text-[var(--text)] shadow-2xl"
          exit={{ opacity: 0, y: 10 }}
          initial={{ opacity: 0, y: 10 }}
          role="status"
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <span>{message}</span>
          <button aria-label="Dismiss notification" className="text-[var(--muted)] hover:text-[var(--text)]" onClick={onDismiss} type="button">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
