"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { useAuthenticatedMediaSrc } from "@/hooks/useAuthenticatedMediaSrc";

interface AudioMessageContentProps {
  src: string;
  outbound?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioMessageContent({ src, outbound }: AudioMessageContentProps) {
  const { src: resolvedSrc, loading, error } = useAuthenticatedMediaSrc(src);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(false);
    setPlaying(false);
    setProgress(0);
    setDuration(0);

    function onTimeUpdate() {
      if (!audio) return;
      setProgress(audio.currentTime);
    }
    function onLoaded() {
      if (!audio) return;
      setDuration(audio.duration || 0);
    }
    function onEnded() {
      setPlaying(false);
      setProgress(0);
    }
    function onError() {
      setPlaying(false);
      setPlaybackError(true);
    }

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [resolvedSrc]);

  if (loading) {
    return <p className="message-bubble-meta">Carregando áudio...</p>;
  }
  if (error || playbackError || !resolvedSrc) {
    return <p className="message-bubble-meta italic">Áudio indisponível</p>;
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      await audio.play();
      setPlaying(true);
    }
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <div className="flex min-w-[200px] items-center gap-3">
      <button
        type="button"
        onClick={togglePlay}
        className="chat-audio-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors"
        aria-label={playing ? "Pausar" : "Reproduzir"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="chat-audio-track h-1.5 overflow-hidden rounded-full">
          <div
            className="chat-audio-fill h-full rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`mt-1 text-[0.625rem] ${outbound ? "message-bubble-meta" : "text-app-muted"}`}>
          {formatDuration(progress || 0)}
          {duration > 0 ? ` / ${formatDuration(duration)}` : ""}
        </p>
      </div>
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" className="hidden" />
    </div>
  );
}
