"use client";

import Link from "next/link";

export function CaptionText({ text }: { text: string }) {
  const parts = text.split(/(@[\w.]+|#[\w\u0400-\u04FF]+)/g);
  return (
    <p className="text-[14px] text-ink-70 leading-relaxed">
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const username = part.slice(1);
          return (
            <Link key={i} href={`/profile/${username}`} className="text-magenta no-underline hover:underline">
              {part}
            </Link>
          );
        }
        if (part.startsWith("#")) {
          return (
            <span key={i} className="text-magenta font-mono text-[13px]">
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}
