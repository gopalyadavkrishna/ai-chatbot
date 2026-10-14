import type { ButtonHTMLAttributes, ReactNode } from "react";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
};

export default function IconButton({ children, className = "", label, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={`group relative inline-flex size-9 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[#A78BFA] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      title={label}
      type="button"
      {...props}
    >
      {children}
      <span className="pointer-events-none absolute top-full z-50 mt-2 hidden whitespace-nowrap rounded-md border border-[var(--border)] bg-[var(--surface-elevated)] px-2 py-1 text-xs text-[var(--text)] shadow-xl group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}
