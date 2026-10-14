"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type ConfirmDialogProps = {
  confirmLabel?: string;
  description: string;
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
};

export default function ConfirmDialog({
  confirmLabel = "Delete",
  description,
  isOpen,
  onCancel,
  onConfirm,
  title,
}: ConfirmDialogProps) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          onMouseDown={onCancel}
          role="presentation"
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
        >
          <motion.section
            animate={{ opacity: 1, scale: 1, y: 0 }}
            aria-describedby="dialog-description"
            aria-labelledby="dialog-title"
            className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-2xl"
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            transition={{ duration: reduceMotion ? 0 : 0.16 }}
          >
            <h2 className="text-lg font-semibold text-[var(--text)]" id="dialog-title">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]" id="dialog-description">{description}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button className="rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]" onClick={onCancel} type="button">Cancel</button>
              <button className="rounded-xl bg-[#F87171] px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-red-300" onClick={onConfirm} type="button">{confirmLabel}</button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
