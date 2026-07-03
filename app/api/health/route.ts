export const dynamic = "force-dynamic";

import { execFile } from "child_process";
import { access } from "fs";
import { promisify } from "util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);
const accessAsync = promisify(access);

async function resolveFfmpegPath(): Promise<string> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require("ffmpeg-static") as string | null;
    if (ffmpegStatic && typeof ffmpegStatic === "string") {
      return ffmpegStatic;
    }
  } catch {
    // fallback
  }
  return "ffmpeg";
}

export async function GET() {
  const ffmpegPath = await resolveFfmpegPath();
  let ffmpegOk = false;

  try {
    await accessAsync(ffmpegPath);
    const { stdout } = await execFileAsync(ffmpegPath, ["-version"], {
      timeout: 8_000,
    });
    ffmpegOk = stdout.includes("ffmpeg version");
  } catch {
    try {
      const { stdout } = await execFileAsync("ffmpeg", ["-version"], {
        timeout: 8_000,
      });
      ffmpegOk = stdout.includes("ffmpeg version");
    } catch {
      ffmpegOk = false;
    }
  }

  return NextResponse.json({
    ok: true,
    service: "ultra-api",
    timestamp: new Date().toISOString(),
    ffmpeg: { ok: ffmpegOk, path: ffmpegPath },
  });
}
