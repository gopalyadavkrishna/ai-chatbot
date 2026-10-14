"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: number;
  email: string;
};

type Session = {
  token: string;
  user: User;
};

type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

type Chatbot = {
  id: number;
  name: string;
  description: string;
  system_instructions: string;
  welcome_message: string;
  temperature: number;
};

type ChatbotDraft = Omit<Chatbot, "id">;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const SESSION_KEY = "customai-session";
const emptyChatbot: ChatbotDraft = {
  name: "",
  description: "",
  system_instructions: "",
  welcome_message: "Hello! How can I help?",
  temperature: 0.7,
};

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export default function StudioDashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [showLogin, setShowLogin] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [dashboardError, setDashboardError] = useState("");
  const [isLoadingChatbots, setIsLoadingChatbots] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingChatbot, setEditingChatbot] = useState<Chatbot | null>(null);
  const [draft, setDraft] = useState<ChatbotDraft>(emptyChatbot);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const savedSession = window.localStorage.getItem(SESSION_KEY);
    if (savedSession) {
      try {
        setSession(JSON.parse(savedSession) as Session);
      } catch {
        window.localStorage.removeItem(SESSION_KEY);
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (session) {
      void loadChatbots(session.token);
    } else {
      setChatbots([]);
    }
  }, [session]);

  function clearSession() {
    window.localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setShowBuilder(false);
    setEditingChatbot(null);
  }

  async function loadChatbots(token: string) {
    setIsLoadingChatbots(true);
    setDashboardError("");

    try {
      const bots = await requestApi<Chatbot[]>("/api/chatbots", token);
      setChatbots(bots);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        setDashboardError("Your session expired. Please sign in again.");
      } else {
        setDashboardError(getMessage(error));
      }
    } finally {
      setIsLoadingChatbots(false);
    }
  }

  async function handleAuthentication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAuthError("");
    setIsAuthenticating(true);

    try {
      const endpoint = showLogin ? "/api/auth/login" : "/api/auth/register";
      const response = await requestApi<AuthResponse>(endpoint, undefined, {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const nextSession = { token: response.access_token, user: response.user };
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setAuthPassword("");
    } catch (error) {
      setAuthError(getMessage(error));
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    if (!session) {
      return;
    }

    try {
      await requestApi<void>("/api/auth/logout", session.token, { method: "POST" });
    } catch {
      // Clearing a local session is still the safe option if the network fails.
    } finally {
      clearSession();
    }
  }

  function startCreating() {
    setEditingChatbot(null);
    setDraft(emptyChatbot);
    setDashboardError("");
    setShowBuilder(true);
  }

  function startEditing(chatbot: Chatbot) {
    setEditingChatbot(chatbot);
    setDraft({
      name: chatbot.name,
      description: chatbot.description,
      system_instructions: chatbot.system_instructions,
      welcome_message: chatbot.welcome_message,
      temperature: chatbot.temperature,
    });
    setDashboardError("");
    setShowBuilder(true);
  }

  function closeBuilder() {
    setShowBuilder(false);
    setEditingChatbot(null);
    setDraft(emptyChatbot);
  }

  async function handleSaveChatbot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }

    setIsSaving(true);
    setDashboardError("");
    const path = editingChatbot
      ? `/api/chatbots/${editingChatbot.id}`
      : "/api/chatbots";

    try {
      await requestApi<Chatbot>(path, session.token, {
        method: editingChatbot ? "PUT" : "POST",
        body: JSON.stringify({ ...draft, name: draft.name.trim() }),
      });
      closeBuilder();
      await loadChatbots(session.token);
    } catch (error) {
      setDashboardError(getMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteChatbot(chatbot: Chatbot) {
    if (!session || !window.confirm(`Delete “${chatbot.name}”?`)) {
      return;
    }

    setDashboardError("");
    try {
      await requestApi<void>(`/api/chatbots/${chatbot.id}`, session.token, {
        method: "DELETE",
      });
      await loadChatbots(session.token);
    } catch (error) {
      setDashboardError(getMessage(error));
    }
  }

  if (!ready) {
    return <p className="text-slate-500">Loading your studio…</p>;
  }

  if (!session) {
    return (
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-2xl font-bold text-slate-900">
          {showLogin ? "Welcome back" : "Create your account"}
        </h2>
        <p className="mt-2 text-slate-600">
          {showLogin
            ? "Sign in to manage your chatbots."
            : "Start building your first custom chatbot."}
        </p>
        <form className="mt-6 space-y-4" onSubmit={handleAuthentication}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
              onChange={(event) => setAuthEmail(event.target.value)}
              required
              type="email"
              value={authEmail}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              autoComplete={showLogin ? "current-password" : "new-password"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600"
              minLength={8}
              onChange={(event) => setAuthPassword(event.target.value)}
              required
              type="password"
              value={authPassword}
            />
          </label>
          {authError && <ErrorMessage message={authError} />}
          <button
            className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
            disabled={isAuthenticating}
            type="submit"
          >
            {isAuthenticating
              ? "Please wait…"
              : showLogin
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        <button
          className="mt-5 w-full text-sm font-semibold text-blue-700 hover:text-blue-900"
          onClick={() => {
            setShowLogin((current) => !current);
            setAuthError("");
          }}
          type="button"
        >
          {showLogin ? "Need an account? Register" : "Already have an account? Sign in"}
        </button>
      </section>
    );
  }

  return (
    <section>
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="font-semibold text-slate-900">{session.user.email}</p>
        </div>
        <div className="flex gap-3">
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
            onClick={startCreating}
            type="button"
          >
            Create chatbot
          </button>
          <button
            className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            onClick={handleLogout}
            type="button"
          >
            Log out
          </button>
        </div>
      </div>

      {dashboardError && <ErrorMessage message={dashboardError} />}

      {showBuilder && (
        <ChatbotBuilder
          draft={draft}
          editing={Boolean(editingChatbot)}
          isSaving={isSaving}
          onCancel={closeBuilder}
          onChange={setDraft}
          onSubmit={handleSaveChatbot}
        />
      )}

      <div className="mt-6">
        <h2 className="text-2xl font-bold text-slate-900">My chatbots</h2>
        {isLoadingChatbots ? (
          <p className="mt-4 text-slate-500">Loading your chatbots…</p>
        ) : chatbots.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
            You have not created a chatbot yet.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {chatbots.map((chatbot) => (
              <article
                className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
                key={chatbot.id}
              >
                <h3 className="text-lg font-bold text-slate-900">{chatbot.name}</h3>
                <p className="mt-2 min-h-12 text-slate-600">
                  {chatbot.description || "No description yet."}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  Temperature: {chatbot.temperature}
                </p>
                <div className="mt-5 flex gap-3">
                  <button
                    className="font-semibold text-blue-700 hover:text-blue-900"
                    onClick={() => startEditing(chatbot)}
                    type="button"
                  >
                    Edit
                  </button>
                  <Link
                    className="font-semibold text-blue-700 hover:text-blue-900"
                    href={`/chatbots/${chatbot.id}`}
                  >
                    Chat
                  </Link>
                  <button
                    className="font-semibold text-red-700 hover:text-red-900"
                    onClick={() => void handleDeleteChatbot(chatbot)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type ChatbotBuilderProps = {
  draft: ChatbotDraft;
  editing: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onChange: (draft: ChatbotDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ChatbotBuilder({
  draft,
  editing,
  isSaving,
  onCancel,
  onChange,
  onSubmit,
}: ChatbotBuilderProps) {
  return (
    <form
      className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
      onSubmit={onSubmit}
    >
      <h2 className="text-2xl font-bold text-slate-900">
        {editing ? "Edit chatbot" : "Create chatbot"}
      </h2>
      <div className="mt-5 grid gap-4">
        <Field label="Name">
          <input
            className={fieldClassName}
            maxLength={100}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            required
            value={draft.name}
          />
        </Field>
        <Field label="Description">
          <textarea
            className={fieldClassName}
            maxLength={1000}
            onChange={(event) =>
              onChange({ ...draft, description: event.target.value })
            }
            rows={2}
            value={draft.description}
          />
        </Field>
        <Field label="System instructions / personality">
          <textarea
            className={fieldClassName}
            maxLength={4000}
            onChange={(event) =>
              onChange({ ...draft, system_instructions: event.target.value })
            }
            placeholder="Example: Be a friendly study helper who explains ideas simply."
            rows={4}
            value={draft.system_instructions}
          />
        </Field>
        <Field label="Welcome message">
          <input
            className={fieldClassName}
            maxLength={500}
            onChange={(event) =>
              onChange({ ...draft, welcome_message: event.target.value })
            }
            required
            value={draft.welcome_message}
          />
        </Field>
        <Field label="Temperature (0 = focused, 2 = creative)">
          <input
            className={fieldClassName}
            max="2"
            min="0"
            onChange={(event) =>
              onChange({ ...draft, temperature: Number(event.target.value) })
            }
            step="0.1"
            type="number"
            value={draft.temperature}
          />
        </Field>
      </div>
      <div className="mt-6 flex gap-3">
        <button
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 disabled:bg-slate-400"
          disabled={isSaving}
          type="submit"
        >
          {isSaving ? "Saving…" : editing ? "Save changes" : "Create chatbot"}
        </button>
        <button
          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
      {message}
    </p>
  );
}

async function requestApi<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(getErrorDetail(payload), response.status);
  }

  return payload as T;
}

function getErrorDetail(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "detail" in payload &&
    typeof payload.detail === "string"
  ) {
    return payload.detail;
  }

  return "Something went wrong. Please try again.";
}

function getMessage(error: unknown): string {
  if (error instanceof TypeError) {
    return "Could not reach the API. Make sure the backend is running.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

const fieldClassName =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-600";
