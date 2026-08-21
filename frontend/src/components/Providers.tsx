"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { SWRConfig } from "swr";
import { LocaleProvider } from "@/lib/LocaleContext";
import { PlatformModeProvider } from "@/lib/PlatformModeContext";
import { ImageEditorProvider } from "@/components/media/ImageEditorProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
      <LocaleProvider>
        <PlatformModeProvider>
          <ImageEditorProvider>
            <AuthProvider>
              <RealtimeProvider>
                <ToastProvider>{children}</ToastProvider>
              </RealtimeProvider>
            </AuthProvider>
          </ImageEditorProvider>
        </PlatformModeProvider>
      </LocaleProvider>
    </SWRConfig>
  );
}
