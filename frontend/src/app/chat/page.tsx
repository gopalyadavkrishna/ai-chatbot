import ChatInterface from "../chat-interface";
import ThemeToggle from "../theme-toggle";

export default function ChatPage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-4xl items-center p-3 sm:p-6">
      <section className="w-full overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <header className="border-b border-slate-200 bg-slate-50 px-4 py-5 sm:px-6">
          <a className="text-sm font-semibold text-blue-700" href="/">
            ← Back to my chatbots
          </a>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            Chat with Gemini
          </h1>
          <p className="mt-2 text-slate-600">
            Ask a question to test your AI assistant.
          </p>
        </header>
        <ChatInterface />
      </section>
      <div className="absolute right-5 top-5"><ThemeToggle /></div>
    </main>
  );
}
