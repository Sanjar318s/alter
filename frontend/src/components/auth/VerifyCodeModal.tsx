"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Frame } from "@/components/Frame";

export function VerifyCodeModal({
  channel,
  maskedTarget,
  resendIn: resendInProp,
  error,
  pending,
  onVerify,
  onResend,
  onClose,
}: {
  channel: "email" | "phone";
  maskedTarget: string;
  resendIn: number;
  error: string;
  pending: boolean;
  onVerify: (code: string) => void;
  onResend: () => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [wait, setWait] = useState(resendInProp);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setWait(resendInProp);
  }, [resendInProp]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setInterval(() => setWait((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [wait]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setAt(i: number, value: string) {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
    const code = next.join("");
    if (code.length === 6) onVerify(code);
  }

  function onPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const raw = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!raw) return;
    const next = raw.split("");
    while (next.length < 6) next.push("");
    setDigits(next);
    refs.current[Math.min(raw.length, 5)]?.focus();
    if (raw.length === 6) onVerify(raw);
  }

  const isSms = channel === "phone";

  return (
    <div className="fixed inset-0 z-[80] bg-ink/85 backdrop-blur-sm flex items-center justify-center p-4">
      <Frame className="bg-stage w-full max-w-[440px] p-6 sm:p-8 relative">
        <button
          type="button"
          aria-label="Закрыть"
          className="absolute top-3 right-3 w-9 h-9 bg-transparent border-0 text-ink-45 hover:text-paper"
          onClick={onClose}
        >
          <X size={18} />
        </button>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-magenta">
          Подтверждение
        </span>
        <h2 className="font-display font-extrabold text-[22px] mt-1">
          {isSms ? "Код из SMS" : "Код из письма"}
        </h2>
        <p className="text-[13px] text-ink-70 mt-2">
          Отправили 6-значный код на{" "}
          <span className="text-paper">{maskedTarget}</span>
          {isSms ? ". Откройте сообщения на телефоне." : ". Проверьте входящие и папку «Спам»."}
        </p>

        <div className="flex justify-center gap-2 mt-6" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              maxLength={1}
              value={d}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Backspace" && !digits[i] && i > 0) {
                  refs.current[i - 1]?.focus();
                }
              }}
              className="w-11 h-12 sm:w-12 sm:h-14 text-center font-mono text-[22px] bg-ink border border-line rounded-[4px] text-paper focus:border-magenta focus:outline-none"
            />
          ))}
        </div>

        {error && <p className="font-mono text-[12px] text-amber text-center mt-3">{error}</p>}

        <Button
          className="w-full mt-5"
          disabled={pending || digits.join("").length < 6}
          onClick={() => onVerify(digits.join(""))}
        >
          {pending ? "Проверяем…" : "Подтвердить"}
        </Button>

        <div className="text-center mt-4 text-[13px] text-ink-45">
          {wait > 0 ? (
            <span>Отправить ещё раз через {wait} с</span>
          ) : (
            <button type="button" className="bg-transparent border-0 text-magenta hover:text-paper" onClick={onResend}>
              Отправить код снова
            </button>
          )}
        </div>
      </Frame>
    </div>
  );
}
