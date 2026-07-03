"use client";

interface TextMessageContentProps {
  body: string;
}

export function TextMessageContent({ body }: TextMessageContentProps) {
  if (!body) return null;
  return <p className="whitespace-pre-wrap break-words">{body}</p>;
}
