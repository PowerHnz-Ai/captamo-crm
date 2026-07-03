"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { InboxView } from "@/components/chat/InboxView";

function InboxFallback() {
  return (
    <div className="flex h-full items-center justify-center text-app-subtle">
      Carregando conversas...
    </div>
  );
}

export default function ConversationsPage() {
  return (
    <AppShell mode="crm" hideHeader fullBleed>
      <Suspense fallback={<InboxFallback />}>
        <InboxView />
      </Suspense>
    </AppShell>
  );
}
