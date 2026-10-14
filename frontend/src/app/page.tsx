import StudioDashboard from "./studio-dashboard";
import ThemeToggle from "./theme-toggle";

export default function HomePage() {
  return (
    <main className="relative mx-auto min-h-screen max-w-6xl p-4 sm:p-10">
      <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 pr-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold tracking-wide text-blue-700">
            CUSTOMAI STUDIO
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-slate-900">
            Build your own chatbot
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Create an assistant, choose its personality, and keep all of your
            chatbots in one place.
          </p>
        </div>
        <a
          className="font-semibold text-blue-700 hover:text-blue-900"
          href="/chat"
        >
          Try the basic chat →
        </a>
      </header>
      <div className="absolute right-4 top-4 sm:right-10 sm:top-10"><ThemeToggle /></div>
      <StudioDashboard />
    </main>
  );
}
