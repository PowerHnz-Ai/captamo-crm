"use client";

import { useEffect, useRef } from "react";

export function useChatScroll(deps: unknown[]) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldStickRef = useRef(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function onScroll() {
      const distance =
        container!.scrollHeight - container!.scrollTop - container!.clientHeight;
      shouldStickRef.current = distance < 120;
    }

    container.addEventListener("scroll", onScroll);
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!shouldStickRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { bottomRef, containerRef };
}
