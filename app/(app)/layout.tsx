import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ImpersonationBanner } from "@/components/platform/ImpersonationBanner";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ImpersonationBanner />
      {children}
    </AuthProvider>
  );
}
