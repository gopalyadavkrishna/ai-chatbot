"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";

import ChatComposer from "@/components/chat/chat-composer";
import ChatMessage from "@/components/chat/chat-message";
import ChatWelcome from "@/components/chat/chat-welcome";
import TypingIndicator from "@/components/chat/typing-indicator";
import DocumentPanel from "@/components/documents/document-panel";
import AppSidebar from "@/components/layout/app-sidebar";
import ChatHeader from "@/components/layout/chat-header";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { CloseIcon, MoonIcon, SunIcon } from "@/components/ui/icons";
import Toast from "@/components/ui/toast";
import { ApiError, getMessage, requestApi, uploadFile } from "@/lib/api";
import { applyTheme, type Theme } from "@/lib/theme";
import type { Chatbot, ChatTurn, Conversation, ConversationDetail, KnowledgeDocument, Session } from "@/lib/types";

const SESSION_KEY = "customai-session";

type PendingDelete =
  | { kind: "conversation"; value: Conversation }
  | { kind: "document"; value: KnowledgeDocument }
  | null;

export default function ConversationStudio({ chatbotId }: { chatbotId: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [chatbot, setChatbot] = useState<Chatbot | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [retryMessage, setRetryMessage] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_KEY);
    if (!savedSession) {
      router.replace("/");
      return;
    }
    try {
      const parsedSession = JSON.parse(savedSession) as Session;
      if (!parsedSession.token || !parsedSession.user?.email) throw new Error("Invalid session");
      setSession(parsedSession);
      void loadInitialData(parsedSession.token);
    } catch {
      window.localStorage.removeItem(SESSION_KEY);
      router.replace("/");
    }
  }, [chatbotId, router]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
  }, [activeConversation?.messages.length, isSending, reduceMotion]);

  async function loadInitialData(token: string) {
    setIsLoading(true);
    setError("");
    try {
      const [loadedChatbot, loadedConversations, loadedDocuments] = await Promise.all([
        requestApi<Chatbot>(`/api/chatbots/${chatbotId}`, token),
        requestApi<Conversation[]>(`/api/chatbots/${chatbotId}/conversations`, token),
        requestApi<KnowledgeDocument[]>(`/api/chatbots/${chatbotId}/documents`, token),
      ]);
      setChatbot(loadedChatbot);
      setConversations(loadedConversations);
      setDocuments(loadedDocuments);
      setIsOnline(true);
      if (loadedConversations[0]) await openConversation(loadedConversations[0].id, token);
    } catch (caughtError) {
      handleRequestError(caughtError);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversations(token: string) {
    const loadedConversations = await requestApi<Conversation[]>(`/api/chatbots/${chatbotId}/conversations`, token);
    setConversations(loadedConversations);
  }

  async function openConversation(conversationId: number, nextToken = session?.token) {
    if (!nextToken) return;
    setError("");
    try {
      const conversation = await requestApi<ConversationDetail>(`/api/conversations/${conversationId}`, nextToken);
      setActiveConversation(conversation);
      setSidebarOpen(false);
    } catch (caughtError) {
      handleRequestError(caughtError);
    }
  }

  async function startNewConversation() {
    if (!session) return;
    setError("");
    try {
      const conversation = await requestApi<Conversation>(`/api/chatbots/${chatbotId}/conversations`, session.token, {
        method: "POST",
        body: JSON.stringify({ title: "New conversation" }),
      });
      setConversations((current) => [conversation, ...current]);
      setActiveConversation({ ...conversation, messages: [] });
      setDraft("");
      setSidebarOpen(false);
    } catch (caughtError) {
      handleRequestError(caughtError);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!session || !message || isSending) return;
    setError("");
    setRetryMessage("");
    setIsSending(true);
    let conversation = activeConversation;
    try {
      if (!conversation) {
        const createdConversation = await requestApi<Conversation>(`/api/chatbots/${chatbotId}/conversations`, session.token, {
          method: "POST",
          body: JSON.stringify({ title: "New conversation" }),
        });
        conversation = { ...createdConversation, messages: [] };
        setConversations((current) => [createdConversation, ...current]);
        setActiveConversation(conversation);
      }
      const turn = await requestApi<ChatTurn>(`/api/conversations/${conversation.id}/messages`, session.token, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setDraft("");
      setActiveConversation((current) => ({
        ...(current ?? { ...turn.conversation, messages: [] }),
        ...turn.conversation,
        messages: [...(current?.messages ?? []), turn.user_message, turn.assistant_message],
      }));
      await loadConversations(session.token);
    } catch (caughtError) {
      setRetryMessage(message);
      handleRequestError(caughtError);
    } finally {
      setIsSending(false);
    }
  }

  async function retryLastMessage() {
    if (!retryMessage) return;
    setDraft(retryMessage);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    document.getElementById("conversation-message")?.focus();
  }

  async function renameConversation(conversation: Conversation) {
    if (!session) return;
    const title = window.prompt("Conversation name", conversation.title)?.trim();
    if (!title || title === conversation.title) return;
    try {
      const updated = await requestApi<Conversation>(`/api/conversations/${conversation.id}`, session.token, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setConversations((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActiveConversation((current) => current?.id === updated.id ? { ...current, ...updated } : current);
    } catch (caughtError) {
      handleRequestError(caughtError);
    }
  }

  async function confirmDelete() {
    if (!session || !pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      if (target.kind === "conversation") {
        await requestApi<void>(`/api/conversations/${target.value.id}`, session.token, { method: "DELETE" });
        setConversations((current) => current.filter((item) => item.id !== target.value.id));
        if (activeConversation?.id === target.value.id) setActiveConversation(null);
      } else {
        await requestApi<void>(`/api/documents/${target.value.id}`, session.token, { method: "DELETE" });
        setDocuments((current) => current.filter((item) => item.id !== target.value.id));
      }
    } catch (caughtError) {
      handleRequestError(caughtError);
    }
  }

  async function uploadDocument(file: File) {
    if (!session || isUploading) return;
    setError("");
    setIsUploading(true);
    try {
      const document = await uploadFile<KnowledgeDocument>(`/api/chatbots/${chatbotId}/documents`, session.token, file);
      setDocuments((current) => [document, ...current]);
      showToast("Document indexed and ready to use.");
    } catch (caughtError) {
      handleRequestError(caughtError);
    } finally {
      setIsUploading(false);
    }
  }

  function selectSuggestion(prompt: string) {
    setDraft(prompt);
    window.setTimeout(() => document.getElementById("conversation-message")?.focus(), 0);
  }

  function handleRequestError(caughtError: unknown) {
    setIsOnline(false);
    if (caughtError instanceof ApiError && caughtError.status === 401) {
      window.localStorage.removeItem(SESSION_KEY);
      router.replace("/");
      return;
    }
    setError(getMessage(caughtError));
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] text-sm text-[var(--muted)]">Loading your AI workspace…</main>;
  if (!chatbot || !session) {
    return <main className="grid min-h-screen place-items-center bg-[var(--app-bg)] p-6 text-center"><div><p className="text-[#F87171]">{error || "Chatbot not found."}</p><Link className="mt-4 inline-block text-sm font-semibold text-[#C4B5FD]" href="/">Back to my chatbots</Link></div></main>;
  }

  const hasMessages = Boolean(activeConversation?.messages.length);
  const dialogTitle = pendingDelete?.kind === "conversation" ? "Delete conversation?" : "Remove document?";
  const dialogDescription = pendingDelete?.kind === "conversation"
    ? `“${pendingDelete.value.title}” and its messages will be permanently deleted.`
    : pendingDelete ? `“${pendingDelete.value.filename}” and its indexed chunks will be permanently removed.` : "";

  return (
    <main className="h-[100dvh] overflow-hidden bg-[var(--app-bg)] text-[var(--text)]">
      <div className="mx-auto flex h-full max-w-[1800px]">
        <div className={`hidden shrink-0 overflow-hidden transition-[width] duration-200 lg:block ${sidebarCollapsed ? "w-[76px]" : "w-[260px]"}`}>
          <AppSidebar activeConversationId={activeConversation?.id} chatbotName={chatbot.name} collapsed={sidebarCollapsed} conversations={conversations} onCollapse={() => setSidebarCollapsed((value) => !value)} onDelete={(conversation) => setPendingDelete({ kind: "conversation", value: conversation })} onNewConversation={() => void startNewConversation()} onOpen={(id) => void openConversation(id)} onRename={(conversation) => void renameConversation(conversation)} onSettings={() => setSettingsOpen(true)} userEmail={session.user.email} />
        </div>
        <section className="flex min-w-0 flex-1 flex-col bg-[var(--chat)]">
          <ChatHeader chatbotName={chatbot.name} connected={isOnline} onMenu={() => setSidebarOpen(true)} onNewConversation={() => void startNewConversation()} onSettings={() => setSettingsOpen(true)} />
          <div className="min-h-0 flex-1 overflow-y-auto">
            {hasMessages && activeConversation ? activeConversation.messages.map((message) => <ChatMessage chatbotName={chatbot.name} key={message.id} message={message} onCopied={() => showToast("Response copied to clipboard.")} />) : !isSending && <ChatWelcome onSelectSuggestion={selectSuggestion} />}
            {isSending && <TypingIndicator chatbotName={chatbot.name} />}
            <div ref={endOfMessagesRef} />
          </div>
          {error && <div className="mx-auto w-full max-w-3xl px-3 sm:px-6"><div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-[#F87171]/30 bg-[#F87171]/10 px-3 py-2 text-sm text-[#FCA5A5]" role="alert"><span>{error}</span>{retryMessage && <button className="shrink-0 font-semibold underline underline-offset-2" onClick={() => void retryLastMessage()} type="button">Retry</button>}</div></div>}
          <ChatComposer disabled={isSending} draft={draft} onChange={setDraft} onSubmit={handleSend} />
        </section>
        <DocumentPanel documents={documents} isUploading={isUploading} onDelete={(document) => setPendingDelete({ kind: "document", value: document })} onUpload={(file) => void uploadDocument(file)} />
      </div>

      <AnimatePresence>
        {sidebarOpen && (
          <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-50 lg:hidden" exit={{ opacity: 0 }} initial={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.16 }}>
            <button aria-label="Close menu" className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} type="button" />
            <motion.div animate={{ x: 0 }} className="relative h-full w-[min(86vw,320px)] shadow-2xl" exit={{ x: -320 }} initial={{ x: -320 }} transition={{ duration: reduceMotion ? 0 : 0.2 }}>
              <AppSidebar activeConversationId={activeConversation?.id} chatbotName={chatbot.name} conversations={conversations} mobile onClose={() => setSidebarOpen(false)} onDelete={(conversation) => setPendingDelete({ kind: "conversation", value: conversation })} onNewConversation={() => void startNewConversation()} onOpen={(id) => void openConversation(id)} onRename={(conversation) => void renameConversation(conversation)} onSettings={() => { setSidebarOpen(false); setSettingsOpen(true); }} userEmail={session.user.email} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppearancePanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmDialog confirmLabel="Delete" description={dialogDescription} isOpen={Boolean(pendingDelete)} onCancel={() => setPendingDelete(null)} onConfirm={() => void confirmDelete()} title={dialogTitle} />
      <Toast message={toast} onDismiss={() => setToast("")} />
    </main>
  );
}

function AppearancePanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  function setTheme(theme: Theme) {
    window.localStorage.setItem("customai-theme", theme);
    applyTheme(theme);
  }
  return (
    <AnimatePresence>
      {isOpen && <motion.div animate={{ opacity: 1 }} className="fixed inset-0 z-[60] bg-black/50 p-4 backdrop-blur-sm" exit={{ opacity: 0 }} initial={{ opacity: 0 }} onMouseDown={onClose} transition={{ duration: reduceMotion ? 0 : 0.16 }}><motion.section animate={{ opacity: 1, scale: 1 }} className="absolute right-4 top-4 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-5 shadow-2xl" exit={{ opacity: 0, scale: 0.98 }} initial={{ opacity: 0, scale: 0.98 }} onMouseDown={(event) => event.stopPropagation()} role="dialog" transition={{ duration: reduceMotion ? 0 : 0.16 }}><div className="flex items-center justify-between"><h2 className="font-semibold text-[var(--text)]">Appearance</h2><button aria-label="Close settings" className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface-hover)]" onClick={onClose} type="button"><CloseIcon size={18} /></button></div><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Choose the workspace appearance saved in this browser.</p><div className="mt-4 grid grid-cols-2 gap-2"><button className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--text)] hover:border-[#A78BFA]" onClick={() => setTheme("dark")} type="button"><MoonIcon size={16} /> Dark</button><button className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--text)] hover:border-[#A78BFA]" onClick={() => setTheme("light")} type="button"><SunIcon size={16} /> Light</button></div></motion.section></motion.div>}
    </AnimatePresence>
  );
}
