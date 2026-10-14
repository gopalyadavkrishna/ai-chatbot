"use client";

import { FormEvent, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type ChatResponse = {
  reply: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = draft.trim();
    if (!message || isLoading) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: message,
    };

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setDraft("");
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data: unknown = await response.json().catch(() => null);

      if (!response.ok || !isChatResponse(data)) {
        const detail = getErrorDetail(data);
        throw new Error(detail ?? "The AI service is unavailable. Please try again.");
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data.reply,
        },
      ]);
    } catch (caughtError) {
      if (caughtError instanceof TypeError) {
        setError("Could not reach the API. Make sure the backend is running.");
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("The AI service is unavailable. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6">
      <div
        aria-live="polite"
        className="min-h-72 space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
      >
        {messages.length === 0 ? (
          <p className="pt-24 text-center text-slate-500">
            Your conversation will appear here.
          </p>
        ) : (
          messages.map((message) => (
            <article
              className={`max-w-[92%] rounded-2xl px-4 py-3 leading-6 sm:max-w-[85%] ${
                message.role === "user"
                  ? "ml-auto bg-blue-700 text-white"
                  : "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200"
              }`}
              key={message.id}
            >
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">
                {message.role === "user" ? "You" : "CustomAI"}
              </p>
              <p className="whitespace-pre-wrap">{message.text}</p>
            </article>
          ))
        )}
        {isLoading && (
          <p className="text-sm font-medium text-slate-500" role="status">
            CustomAI is thinking…
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <form className="mt-5 flex flex-col gap-3 sm:flex-row" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="message">
          Your message
        </label>
        <textarea
          className="min-h-12 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-600 placeholder:text-slate-400 focus:ring-2 disabled:bg-slate-100"
          disabled={isLoading}
          id="message"
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message…"
          rows={2}
          value={draft}
        />
        <button
          className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:self-end"
          disabled={isLoading || !draft.trim()}
          type="submit"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function isChatResponse(value: unknown): value is ChatResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "reply" in value &&
    typeof value.reply === "string"
  );
}

function getErrorDetail(value: unknown): string | undefined {
  if (
    typeof value === "object" &&
    value !== null &&
    "detail" in value &&
    typeof value.detail === "string"
  ) {
    return value.detail;
  }

  return undefined;
}
