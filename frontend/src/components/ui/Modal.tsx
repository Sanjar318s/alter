"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./IconButton";

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-[70] bg-ink/80 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`bg-stage border border-line w-full sm:max-h-[90vh] max-h-[92vh] overflow-y-auto p-5 sm:p-6 rounded-t-[12px] sm:rounded-[8px] ${
          wide ? "sm:max-w-[640px]" : "sm:max-w-[440px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5 gap-3">
          <h2 className="font-display font-extrabold text-[18px] sm:text-[20px]">{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}
