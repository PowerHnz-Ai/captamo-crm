"use client";

interface InboxPanelResizeHandleProps {
  onResizeStart: (e: React.MouseEvent) => void;
  isResizing?: boolean;
}

export function InboxPanelResizeHandle({
  onResizeStart,
  isResizing = false,
}: InboxPanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar lista de conversas"
      onMouseDown={onResizeStart}
      className={`hidden w-1 shrink-0 cursor-col-resize lg:block ${
        isResizing ? "bg-app-accent/30" : "bg-transparent hover:bg-app-accent/20"
      }`}
    />
  );
}
