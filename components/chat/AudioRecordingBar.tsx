"use client";

import { Mic, Pause, Play, Send, Trash2 } from "lucide-react";
import { AudioWaveform } from "@/components/chat/AudioWaveform";
import { formatRecordingTime, type useAudioRecorder } from "@/hooks/useAudioRecorder";

type Recorder = ReturnType<typeof useAudioRecorder>;

interface AudioRecordingBarProps {
  disabled?: boolean;
  hasText: boolean;
  recorder: Recorder;
  onSendText: () => void;
  onSendAudio: (blob: Blob, mimeType: string) => Promise<void>;
}

export function AudioRecordingBar({
  disabled,
  hasText,
  recorder,
  onSendText,
  onSendAudio,
}: AudioRecordingBarProps) {
  if (!recorder.isActive) {
    if (hasText) {
      return (
        <button
          type="button"
          disabled={disabled}
          onClick={onSendText}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      );
    }

    return (
      <div className="flex shrink-0 flex-col items-center">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void recorder.startRecording()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-app-subtle hover:bg-white/5 disabled:opacity-40"
          aria-label="Gravar áudio"
        >
          <Mic className="h-5 w-5" />
        </button>
        {recorder.error && (
          <span className="mt-1 max-w-[140px] text-center text-[0.625rem] text-red-300">
            {recorder.error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <button
        type="button"
        onClick={recorder.cancelRecording}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-red-300 hover:bg-red-500/10"
        aria-label="Cancelar gravação"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      <div
        className={`relative flex min-w-0 flex-1 items-center rounded-xl px-2 py-1.5 chat-audio-track ${
          recorder.recording ? "chat-recording-active" : ""
        }`}
      >
        <AudioWaveform levels={recorder.waveform} active={recorder.recording} />
        {recorder.recording && (
          <span className="absolute left-2 top-1">
            <span className="block h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
          </span>
        )}
      </div>

      <span className="shrink-0 min-w-[2.5rem] text-sm tabular-nums text-emerald-300">
        {formatRecordingTime(recorder.durationMs)}
      </span>

      {recorder.canPause && (
        <button
          type="button"
          onClick={
            recorder.paused ? recorder.resumeRecording : recorder.pauseRecording
          }
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-app-border text-app-subtle hover:bg-white/5"
          aria-label={recorder.paused ? "Continuar gravação" : "Pausar gravação"}
        >
          {recorder.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          recorder.finishAndSend(async (result) => {
            try {
              await onSendAudio(result.blob, result.mimeType);
            } catch {
              // erro exibido pelo ChatPanel
            }
          });
        }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 disabled:opacity-40"
        aria-label="Enviar áudio"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}
