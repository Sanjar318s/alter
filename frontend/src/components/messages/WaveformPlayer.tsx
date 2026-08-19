"use client";

import { useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function pad(n: number) {
  return String(Math.max(0, Math.floor(n))).padStart(2, "0");
}

export function WaveformPlayer({
  src,
  duration = 7,
}: {
  src?: string;
  duration?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rate, setRate] = useState(1);
  const bars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => 6 + ((i * 13) % 16)),
    []
  );

  function toggle() {
    const el = audioRef.current;
    if (!el) {
      setPlaying((p) => !p);
      return;
    }
    if (playing) el.pause();
    else void el.play();
    setPlaying(!playing);
  }

  return (
    <div className="flex items-center gap-2 w-full min-w-0 max-w-[260px]">
      <button
        type="button"
        aria-label={playing ? "Пауза" : "Воспроизвести"}
        onClick={toggle}
        className="w-8 h-8 shrink-0 rounded-full bg-magenta/20 border border-magenta/50 text-paper flex items-center justify-center hover:bg-magenta/30"
      >
        {playing ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
      </button>
      <div
        className="flex items-end gap-[2px] h-7 flex-1 min-w-0 overflow-hidden cursor-pointer"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const p = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
          setProgress(p);
          if (audioRef.current?.duration) {
            audioRef.current.currentTime = p * audioRef.current.duration;
          }
        }}
      >
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-[3px] shrink-0 rounded-full"
            style={{
              height: h,
              background: i / bars.length < progress ? "#E5487A" : "#3A3550",
            }}
          />
        ))}
      </div>
      <div className="shrink-0 flex flex-col items-end leading-none gap-1">
        <button
          type="button"
          className="font-mono text-[9px] text-magenta bg-magenta/10 border border-magenta/30 rounded-[3px] px-1 py-0.5"
          onClick={() => {
            const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
            setRate(next);
            if (audioRef.current) audioRef.current.playbackRate = next;
          }}
        >
          {rate}x
        </button>
        <span className="font-mono text-[10px] text-ink-45 tabular-nums">
          {pad(duration / 60)}:{pad(duration % 60)}
        </span>
      </div>
      {src && (
        <audio
          ref={audioRef}
          src={src}
          className="hidden"
          onTimeUpdate={(e) => {
            const a = e.currentTarget;
            if (a.duration) setProgress(a.currentTime / a.duration);
          }}
          onEnded={() => setPlaying(false)}
        />
      )}
    </div>
  );
}
