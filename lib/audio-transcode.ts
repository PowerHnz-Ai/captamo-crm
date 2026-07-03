import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { constants } from "fs";
import { access, chmod, promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const accessAsync = promisify(access);
const chmodAsync = promisify(chmod);

let cachedFfmpegPath: string | null | undefined;
let ffmpegReady: Promise<string> | null = null;

function extensionForMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("webm")) return "webm";
  if (lower.includes("ogg")) return "ogg";
  if (lower.includes("mp4") || lower.includes("m4a")) return "m4a";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "mp3";
  if (lower.includes("aac")) return "aac";
  if (lower.includes("wav")) return "wav";
  return "audio";
}

async function ensureExecutable(bin: string): Promise<void> {
  if (bin === "ffmpeg") return;
  try {
    await accessAsync(bin, constants.X_OK);
  } catch {
    await chmodAsync(bin, 0o755).catch(() => undefined);
  }
}

async function resolveFfmpegPath(): Promise<string> {
  if (ffmpegReady) return ffmpegReady;

  ffmpegReady = (async () => {
    if (cachedFfmpegPath) return cachedFfmpegPath;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ffmpegStatic = require("ffmpeg-static") as string | null;
      if (ffmpegStatic && typeof ffmpegStatic === "string") {
        await ensureExecutable(ffmpegStatic);
        cachedFfmpegPath = ffmpegStatic;
        return ffmpegStatic;
      }
    } catch {
      // fallback para ffmpeg do sistema
    }

    cachedFfmpegPath = "ffmpeg";
    return "ffmpeg";
  })();

  return ffmpegReady;
}

export function isWebmAudio(mimeType: string): boolean {
  return mimeType.toLowerCase().startsWith("audio/") && mimeType.toLowerCase().includes("webm");
}

export const WHATSAPP_AUDIO_MIME = "audio/mpeg";
export const WHATSAPP_AUDIO_FILENAME = "audio.mp3";

/** @deprecated use WHATSAPP_AUDIO_MIME */
export const WHATSAPP_OGG_MIME = "audio/ogg; codecs=opus";

function audioFilenameForMime(mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (lower.includes("ogg")) return "audio.ogg";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "audio.mp3";
  if (lower.includes("mp4") || lower.includes("m4a")) return "audio.m4a";
  if (lower.includes("webm")) return "audio.webm";
  if (lower.includes("aac")) return "audio.aac";
  return "audio.ogg";
}

/** Converte gravação do navegador para MP3 aceito pelo WhatsApp Cloud API. */
export async function transcodeToWhatsAppMp3(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ultra-audio-"));
  const ext = extensionForMime(mimeType);
  const inputPath = path.join(tmpDir, `${randomUUID()}.${ext}`);
  const outputPath = path.join(tmpDir, `${randomUUID()}.mp3`);
  const ffmpegBin = await resolveFfmpegPath();

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync(
      ffmpegBin,
      [
        "-nostdin",
        "-y",
        "-i",
        inputPath,
        "-c:a",
        "libmp3lame",
        "-b:a",
        "64k",
        "-ar",
        "44100",
        "-ac",
        "1",
        "-f",
        "mp3",
        outputPath,
      ],
      { timeout: 45_000, maxBuffer: 8 * 1024 * 1024 }
    );
    const out = await fs.readFile(outputPath);
    if (out.length < 400) {
      console.error("[audio-transcode] mp3 saída muito pequena:", out.length);
      return null;
    }
    return Buffer.from(out);
  } catch (error) {
    console.error("[audio-transcode] ffmpeg mp3 falhou:", {
      ffmpeg: ffmpegBin,
      mimeType,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Converte qualquer áudio gravado no navegador para OGG/Opus (fallback). */
export async function transcodeToWhatsAppOgg(
  buffer: Buffer,
  mimeType: string
): Promise<Buffer | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ultra-audio-"));
  const ext = extensionForMime(mimeType);
  const inputPath = path.join(tmpDir, `${randomUUID()}.${ext}`);
  const outputPath = path.join(tmpDir, `${randomUUID()}.ogg`);
  const ffmpegBin = await resolveFfmpegPath();

  try {
    await fs.writeFile(inputPath, buffer);
    await execFileAsync(
      ffmpegBin,
      [
        "-nostdin",
        "-y",
        "-i",
        inputPath,
        "-c:a",
        "libopus",
        "-b:a",
        "32k",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-application",
        "voip",
        "-f",
        "ogg",
        outputPath,
      ],
      { timeout: 45_000, maxBuffer: 8 * 1024 * 1024 }
    );
    const out = await fs.readFile(outputPath);
    if (out.length < 400) {
      console.error("[audio-transcode] saída muito pequena:", out.length);
      return null;
    }
    return Buffer.from(out);
  } catch (error) {
    console.error("[audio-transcode] ffmpeg falhou:", {
      ffmpeg: ffmpegBin,
      mimeType,
      error: error instanceof Error ? error.message : error,
    });
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** @deprecated use transcodeToWhatsAppOgg */
export async function transcodeWebmToOgg(buffer: Buffer): Promise<Buffer | null> {
  return transcodeToWhatsAppOgg(buffer, "audio/webm");
}

export function normalizeAudioMime(mimeType: string): string {
  const lower = mimeType.toLowerCase().split(";")[0]!.trim();
  if (lower.includes("ogg")) return "audio/ogg";
  if (lower.includes("webm")) return "audio/webm";
  if (lower.includes("mp4") || lower.includes("m4a")) return "audio/mp4";
  if (lower.includes("mpeg") || lower.includes("mp3")) return "audio/mpeg";
  return lower.startsWith("audio/") ? lower : "audio/ogg";
}

export async function prepareOutboundAudio(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
  const normalizedMime = normalizeAudioMime(mimeType);
  const converted = await transcodeToWhatsAppMp3(buffer, normalizedMime);
  if (converted) {
    return {
      buffer: converted,
      mimeType: WHATSAPP_AUDIO_MIME,
      filename: WHATSAPP_AUDIO_FILENAME,
    };
  }

  const oggFallback = await transcodeToWhatsAppOgg(buffer, normalizedMime);
  if (oggFallback) {
    return {
      buffer: oggFallback,
      mimeType: WHATSAPP_OGG_MIME,
      filename: "audio.ogg",
    };
  }

  if (isWebmAudio(normalizedMime)) {
    throw new Error(
      "Não foi possível converter o áudio para MP3. Verifique ffmpeg no servidor."
    );
  }

  return {
    buffer,
    mimeType: normalizedMime,
    filename: audioFilenameForMime(normalizedMime),
  };
}

export function isWhatsAppReadyAudio(mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  if (lower.includes("webm")) return false;
  return (
    lower.includes("mpeg") ||
    lower.includes("mp3") ||
    lower.includes("ogg") ||
    lower.includes("opus") ||
    lower.includes("mp4") ||
    lower.includes("m4a") ||
    lower.includes("aac")
  );
}
