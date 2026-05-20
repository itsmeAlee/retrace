type IconName =
  | "add"
  | "arrow-left"
  | "chevron-down"
  | "check"
  | "delete"
  | "document"
  | "download"
  | "eye"
  | "eye-off"
  | "file"
  | "home"
  | "image"
  | "inbox"
  | "link"
  | "move"
  | "mic"
  | "note"
  | "pencil"
  | "pin"
  | "play"
  | "plus-circle"
  | "post-add"
  | "settings"
  | "sign-out"
  | "sparkle"
  | "stop"
  | "sessions"
  | "text"
  | "upload"
  | "user"
  | "video"
  | "x";

const paths: Record<IconName, string[]> = {
  add: ["M12 5v14", "M5 12h14"],
  "arrow-left": ["M19 12H5", "M12 19l-7-7 7-7"],
  "chevron-down": ["M6 9l6 6 6-6"],
  check: ["M20 6 9 17l-5-5"],
  delete: ["M3 6h18", "M8 6V4h8v2", "M19 6l-1 14H6L5 6", "M10 11v6", "M14 11v6"],
  document: ["M7 3h7l5 5v13H7z", "M14 3v6h5", "M10 13h6", "M10 17h4"],
  download: ["M12 3v12", "M7 10l5 5 5-5", "M5 21h14"],
  eye: ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"],
  "eye-off": ["M3 3l18 18", "M10.6 10.6a3 3 0 0 0 4 4", "M9.5 5.4A10.4 10.4 0 0 1 12 5c6 0 10 7 10 7a18 18 0 0 1-2.1 2.9", "M6.2 6.8C3.6 8.7 2 12 2 12s4 7 10 7c1.3 0 2.5-.3 3.6-.8"],
  file: ["M7 3h7l5 5v13H7z", "M14 3v6h5"],
  home: ["M3 11l9-8 9 8", "M5 10v11h14V10", "M9 21v-7h6v7"],
  image: ["M5 5h14v14H5z", "M8 15l3-3 2 2 3-4 3 5", "M8 8h.01"],
  inbox: ["M4 5h16v14H4z", "M4 13h5l2 3h2l2-3h5"],
  link: ["M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1", "M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1"],
  move: ["M4 7h11v10H4z", "M15 10h5v10H9v-3", "M13 10l2 2 2-2"],
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z", "M19 10v2a7 7 0 0 1-14 0v-2", "M12 19v3"],
  note: ["M5 4h14v16H5z", "M8 8h8", "M8 12h5", "M15 16h1"],
  pencil: ["M4 20h4l11-11-4-4L4 16v4z", "M13 7l4 4"],
  pin: ["M12 3l6 6-3 3 3 3-3 3-3-3-5 5 5-5-3-3 3-3z"],
  play: ["M8 5v14l11-7z"],
  "plus-circle": ["M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14z", "M12 9v6", "M9 12h6"],
  "post-add": ["M6 4h10l2 2v14H6z", "M15 4v4h4", "M9 13h6", "M12 10v6"],
  settings: ["M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z", "M3 12h2", "M19 12h2", "M12 3v2", "M12 19v2", "M5.6 5.6 7 7", "M18.4 5.6l-7 7"],
  "sign-out": ["M10 17l5-5-5-5", "M15 12H3", "M21 5v14", "M21 5h-8", "M21 19h-8"],
  sparkle: ["M12 3l1.4 5.2L18 10l-4.6 1.8L12 17l-1.4-5.2L6 10l4.6-1.8z", "M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7z"],
  stop: ["M7 7h10v10H7z"],
  sessions: ["M5 5h10l4 4v10H5z", "M15 5v5h4", "M8 13h8", "M8 16h6"],
  text: ["M5 7h14", "M5 12h14", "M5 17h8"],
  upload: ["M12 21V9", "M7 14l5-5 5 5", "M5 3h14"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4 21a8 8 0 0 1 16 0"],
  video: ["M4 6h11v12H4z", "M15 10l5-3v10l-5-3"],
  x: ["M18 6 6 18", "M6 6l12 12"]
};

export function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
