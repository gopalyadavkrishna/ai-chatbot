import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ children, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {children}
    </svg>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3Z" />
      <path d="m19 16-.7 2.3L16 19l2.3.7L19 22l.7-2.3L22 19l-2.3-.7L19 16Z" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 5v14M5 12h14" /></Icon>;
}

export function MenuIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>;
}

export function CloseIcon(props: IconProps) {
  return <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}

export function SearchIcon(props: IconProps) {
  return <Icon {...props}><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></Icon>;
}

export function MessageIcon(props: IconProps) {
  return <Icon {...props}><path d="M20 11.5a7.5 7.5 0 0 1-8 7.48 8.9 8.9 0 0 1-3.4-.73L4 20l1.16-3.46A7.5 7.5 0 1 1 20 11.5Z" /></Icon>;
}

export function PencilIcon(props: IconProps) {
  return <Icon {...props}><path d="m14.5 5.5 4 4M4 20l3.25-.75L19.5 7a2.83 2.83 0 0 0-4-4L3.25 15.25 2.5 19.5 4 20Z" /></Icon>;
}

export function TrashIcon(props: IconProps) {
  return <Icon {...props}><path d="M4 7h16M10 11v5M14 11v5M9 7l1-3h4l1 3m-9 0 1 13h10l1-13" /></Icon>;
}

export function SettingsIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.5 2.5-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.55V21h-3.54v-.08A1.7 1.7 0 0 0 9.76 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.5-2.5.06-.06A1.7 1.7 0 0 0 5.72 15a1.7 1.7 0 0 0-1.55-1.03H4v-3.54h.17A1.7 1.7 0 0 0 5.72 9.4a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.5-2.5.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10.8 3.8V3.7h3.54v.1a1.7 1.7 0 0 0 1.03 1.55 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.5 2.5-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.55 1.03h.08v3.54h-.08A1.7 1.7 0 0 0 19.4 15Z" /></Icon>;
}

export function DocumentIcon(props: IconProps) {
  return <Icon {...props}><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></Icon>;
}

export function UploadIcon(props: IconProps) {
  return <Icon {...props}><path d="M12 16V4M8 8l4-4 4 4M5 20h14" /></Icon>;
}

export function SendIcon(props: IconProps) {
  return <Icon {...props}><path d="m21 3-8.5 18-2.7-7.8L2 10.5 21 3Z" /><path d="m9.8 13.2 4.7-4.7" /></Icon>;
}

export function CopyIcon(props: IconProps) {
  return <Icon {...props}><rect height="13" rx="2" width="11" x="9" y="8" /><path d="M5 16H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Icon>;
}

export function ChevronIcon({ direction = "right", ...props }: IconProps & { direction?: "left" | "right" }) {
  return <Icon {...props}><path d={direction === "right" ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"} /></Icon>;
}

export function MoonIcon(props: IconProps) {
  return <Icon {...props}><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" /></Icon>;
}

export function SunIcon(props: IconProps) {
  return <Icon {...props}><circle cx="12" cy="12" r="3.5" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Icon>;
}
