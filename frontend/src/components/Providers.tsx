"use client";

import { AuthProvider } from "@/lib/AuthContext";
import { ToastProvider } from "@/components/ui/Toast";
import { RealtimeProvider } from "@/components/RealtimeProvider";
import { SWRConfig } from "swr";
import { LocaleProvider } from "@/lib/LocaleContext";
import { NavPanelProvider } from "@/lib/NavPanelContext";
import { ImageEditorProvider } from "@/components/media/ImageEditorProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false, shouldRetryOnError: false }}>
      <LocaleProvider>
        <NavPanelProvider>
          <ImageEditorProvider>
            <AuthProvider>
              <RealtimeProvider>
                <ToastProvider>{children}</ToastProvider>
              </RealtimeProvider>
            </AuthProvider>
          </ImageEditorProvider>
        </NavPanelProvider>
      </LocaleProvider>
    </SWRConfig>
  );
}
