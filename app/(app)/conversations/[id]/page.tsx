"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function ConversationDetailRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/conversations?id=${params.id}`);
  }, [params.id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-app-subtle">
      Redirecionando...
    </div>
  );
}
