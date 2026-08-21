"use client";

import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { OnboardingBanner } from "@/components/OnboardingBanner";
import { RoleSelectModal } from "@/components/RoleSelectModal";
import { cn } from "@/lib/cn";
import { isViewportLockRoute } from "@/lib/viewportLock";

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const viewportLock = isViewportLockRoute(pathname);

  if (viewportLock) {
    return (
      <div
        data-viewport-lock=""
        className="flex flex-1 flex-col min-h-0 h-full max-h-full overflow-hidden"
      >
        <div className="shrink-0">
          <Nav />
        </div>
        <main className="flex-1 min-h-0 min-w-0 max-w-full overflow-hidden flex flex-col">
          {children}
        </main>
        <OnboardingBanner />
        <RoleSelectModal />
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main className={cn("flex-1 min-w-0 max-w-full overflow-x-clip pb-16")}>
        {children}
      </main>
      <Footer />
      <OnboardingBanner />
      <RoleSelectModal />
    </>
  );
}
