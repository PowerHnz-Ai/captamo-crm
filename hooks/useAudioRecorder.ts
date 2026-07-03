"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface AudioRecordingResult {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export type AudioRecorderPhase = "idle" | "recording" | "paused" | "preview";

const WAVEFORM_BARS = 44;

function pickMimeType(): string {
  const candidates = [
    "audio/ogg;codecs=opus",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "audio/webm";
}

function averageLevel(data: Uint8Array, start: number, end: number): number {
  let sum = 0;
  const from = Math.max(0, start);
  const to = Math.min(data.length, end);
  if (to <= from) return 0;
  for (let i = from; i < to; i++) sum += data[i]!;
  return sum / (to - from) / 255;
}

function levelFromAnalyser(analyser: AnalyserNode): number {
  const freq = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freq);
  const slice = Math.floor(freq.length / 4);
  let level =
    averageLevel(freq, 0, slice) * 2.2 + averageLevel(freq, slice, slice * 2) * 1.4;

  if (level < 0.05) {
    const time = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < time.length; i++) {
      const v = (time[i]! - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / time.length);
    level = Math.max(level, rms * 3.5);
  }

  return Math.max(0.08, Math.min(1, level));
}

export function useAudioRecorder() {
  const [phase, setPhase] = useState<AudioRecorderPhase>("idle");
  const [preview, setPreview] = useState<AudioRecordingResult | null>(null);
  const [error, setError] = useState("");
  const [durationMs, setDurationMs] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() =>
    Array.from({ length: WAVEFORM_BARS }, () => 0.08)
  );
  const [canPause, setCanPause] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mimeTypeRef = useRef("audio/webm");
  const rafRef = useRef(0);
  const elapsedRef = useRef(0);
  const segmentStartRef = useRef(0);
  const phaseRef = useRef<AudioRecorderPhase>("idle");
  const waveformHistoryRef = useRef<number[]>(
    Array.from({ length: WAVEFORM_BARS }, () => 0.08)
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const setPhaseSync = useCallback((next: AudioRecorderPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const cleanupMedia = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioContextRef.current?.state !== "closed") {
      void audioContextRef.current?.close();
    }
    audioContextRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => () => cleanupMedia(), [cleanupMedia]);

  const tickVisualizer = useCallback(() => {
    const analyser = analyserRef.current;
    const currentPhase = phaseRef.current;

    if (!analyser || currentPhase === "idle" || currentPhase === "preview") {
      rafRef.current = 0;
      return;
    }

    if (currentPhase === "recording") {
      const level = levelFromAnalyser(analyser);

      const history = waveformHistoryRef.current;
      history.shift();
      history.push(level);
      waveformHistoryRef.current = history;
      setWaveform([...history]);

      setDurationMs(elapsedRef.current + (Date.now() - segmentStartRef.current));
    }

    rafRef.current = requestAnimationFrame(tickVisualizer);
  }, []);

  const startRecording = useCallback(async () => {
    setError("");
    cleanupMedia();
    chunksRef.current = [];
    elapsedRef.current = 0;
    segmentStartRef.current = Date.now();
    waveformHistoryRef.current = Array.from({ length: WAVEFORM_BARS }, () => 0.08);
    setWaveform(waveformHistoryRef.current);
    setDurationMs(0);
    setPreview(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = pickMimeType();
      mimeTypeRef.current = mimeType;
      const recorder = new MediaRecorder(stream, { mimeType });
      setCanPause(typeof recorder.pause === "function");

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const totalMs =
          phaseRef.current === "paused"
            ? elapsedRef.current
            : elapsedRef.current + (Date.now() - segmentStartRef.current);

        cleanupMedia();

        if (blob.size > 0 && totalMs > 300) {
          setPreview({ blob, mimeType: mimeTypeRef.current, durationMs: totalMs });
          setPhaseSync("preview");
        } else {
          setPhaseSync("idle");
          setDurationMs(0);
          setWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.08));
          setError("Gravação muito curta. Segure o microfone por mais de 1 segundo.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setPhaseSync("recording");
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tickVisualizer);
    } catch {
      cleanupMedia();
      setPhaseSync("idle");
      setError("Permissão de microfone negada ou indisponível.");
    }
  }, [cleanupMedia, tickVisualizer, setPhaseSync]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording" || !canPause) return;
    recorder.pause();
    elapsedRef.current += Date.now() - segmentStartRef.current;
    setDurationMs(elapsedRef.current);
    setPhaseSync("paused");
  }, [canPause, setPhaseSync]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    segmentStartRef.current = Date.now();
    setPhaseSync("recording");
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tickVisualizer);
  }, [tickVisualizer, setPhaseSync]);

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    phaseRef.current = "idle";
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => cleanupMedia();
      recorder.stop();
    } else {
      cleanupMedia();
    }
    chunksRef.current = [];
    setPreview(null);
    setPhaseSync("idle");
    setDurationMs(0);
    setWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.08));
  }, [cleanupMedia, setPhaseSync]);

  const finishRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
  }, []);

  const finishAndSend = useCallback(
    (onReady: (result: AudioRecordingResult) => void | Promise<void>) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") return;

      if (typeof recorder.requestData === "function") {
        recorder.requestData();
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        const totalMs =
          phaseRef.current === "paused"
            ? elapsedRef.current
            : elapsedRef.current + (Date.now() - segmentStartRef.current);

        cleanupMedia();
        chunksRef.current = [];
        setPhaseSync("idle");
        setDurationMs(0);
        setWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.08));

        if (blob.size > 0 && totalMs > 300) {
          void onReady({ blob, mimeType: mimeTypeRef.current, durationMs: totalMs });
        } else {
          setError("Gravação muito curta. Segure o microfone por mais de 1 segundo.");
        }
      };

      recorder.stop();
    },
    [cleanupMedia, setPhaseSync]
  );

  const clearPreview = useCallback(() => {
    setPreview(null);
    setPhaseSync("idle");
    setDurationMs(0);
    setWaveform(Array.from({ length: WAVEFORM_BARS }, () => 0.08));
  }, [setPhaseSync]);

  const isActive = phase !== "idle";

  return {
    phase,
    isActive,
    recording: phase === "recording",
    paused: phase === "paused",
    preview,
    error,
    durationMs,
    waveform,
    canPause,
    startRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    finishRecording,
    /** @deprecated Use finishRecording — mantido para compatibilidade. */
    stopRecording: finishRecording,
    finishAndSend,
    clearPreview,
  };
}

export function formatRecordingTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
