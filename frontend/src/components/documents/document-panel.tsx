"use client";

import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import IconButton from "@/components/ui/icon-button";
import { ChevronIcon, DocumentIcon, TrashIcon, UploadIcon } from "@/components/ui/icons";
import type { KnowledgeDocument } from "@/lib/types";

type DocumentPanelProps = {
  documents: KnowledgeDocument[];
  isUploading: boolean;
  onDelete: (document: KnowledgeDocument) => void;
  onUpload: (file: File) => void;
};

export default function DocumentPanel({ documents, isUploading, onDelete, onUpload }: DocumentPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  function selectFile(file: File | undefined) {
    if (file) onUpload(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  return (
    <aside className="h-auto border-t border-[var(--border)] bg-[var(--sidebar)] xl:h-full xl:w-80 xl:shrink-0 xl:border-l xl:border-t-0">
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text)]">Knowledge base</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">PDF or UTF-8 TXT · up to 5 MB</p>
        </div>
        <IconButton label={expanded ? "Collapse documents" : "Show documents"} onClick={() => setExpanded((value) => !value)}>
          <ChevronIcon direction={expanded ? "right" : "left"} size={17} />
        </IconButton>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden border-t border-[var(--border)]"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
          >
            <div className="p-4">
              <div
                className={`rounded-2xl border border-dashed p-4 text-center transition ${isDragging ? "border-[#A78BFA] bg-[#A78BFA]/10" : "border-[var(--border)] bg-[var(--surface)]"}`}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
              >
                <div className="mx-auto grid size-9 place-items-center rounded-xl bg-[#22D3EE]/10 text-[#67E8F9]"><UploadIcon size={18} /></div>
                <p className="mt-3 text-sm font-medium text-[var(--text)]">Drop a document here</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Files are indexed only after the backend confirms the upload.</p>
                <input accept=".pdf,.txt,application/pdf,text/plain" className="sr-only" id="knowledge-file" onChange={handleChange} ref={inputRef} type="file" />
                <button
                  className="mt-3 rounded-lg border border-[#A78BFA]/40 px-3 py-1.5 text-xs font-semibold text-[#C4B5FD] transition hover:bg-[#A78BFA]/10 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isUploading}
                  onClick={() => inputRef.current?.click()}
                  type="button"
                >
                  {isUploading ? "Indexing document…" : "Browse files"}
                </button>
              </div>
              <div className="mt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Documents</p>
                {documents.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
                    <DocumentIcon className="mx-auto text-[var(--muted)]" size={20} />
                    <p className="mt-2 text-xs leading-5 text-[var(--muted)]">Add documents to ground answers in your own information.</p>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {documents.map((document) => (
                      <li className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3" key={document.id}>
                        <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#A78BFA]/10 text-[#C4B5FD]"><DocumentIcon size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--text)]" title={document.filename}>{document.filename}</p>
                          <p className="mt-1 text-[11px] text-[var(--muted)]">{fileExtension(document.filename)} · {formatBytes(document.file_size)} · {document.chunk_count} chunks</p>
                          <p className="mt-1 text-[11px] text-[#34D399]">Indexed</p>
                        </div>
                        <IconButton className="size-7 hover:text-[#F87171]" label={`Remove ${document.filename}`} onClick={() => onDelete(document)}><TrashIcon size={14} /></IconButton>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

function fileExtension(filename: string) {
  const extension = filename.split(".").pop();
  return extension ? extension.toUpperCase() : "FILE";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`;
}
