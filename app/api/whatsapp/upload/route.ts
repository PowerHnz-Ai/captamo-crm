export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveCompanyContextOrError } from "@/lib/request-company";
import { requirePermission } from "@/lib/api-guard";
import {
  assertCompanyMediaPath,
  isAllowedMimeType,
  maxBytesForMime,
  uploadCompanyMedia,
} from "@/lib/media-storage";
import { WHATSAPP_AUDIO_MIME, isWhatsAppReadyAudio, prepareOutboundAudio } from "@/lib/audio-transcode";

export async function POST(request: NextRequest) {
  const authResult = await resolveCompanyContextOrError(request);
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }

  const perm = requirePermission(authResult.context.auth, "conversations.reply");
  if (!perm.ok) {
    return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const conversationId = String(formData.get("conversationId") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId é obrigatório." },
        { status: 400 }
      );
    }

    const mimeType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(mimeType)) {
      return NextResponse.json({ error: "Tipo de arquivo não permitido." }, { status: 400 });
    }

    const maxBytes = maxBytesForMime(mimeType);
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Arquivo excede o limite de ${Math.round(maxBytes / 1024 / 1024)}MB.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let uploadBuffer = buffer;
    let uploadMime = mimeType;
    let uploadName = file.name || "upload";

    if (mimeType.startsWith("audio/")) {
      try {
        const prepared = await prepareOutboundAudio(buffer, mimeType);
        uploadBuffer = Buffer.from(prepared.buffer);
        uploadMime = prepared.mimeType;
        uploadName = prepared.filename;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Falha ao converter áudio.";
        return NextResponse.json({ error: message }, { status: 422 });
      }
      if (!isWhatsAppReadyAudio(uploadMime)) {
        return NextResponse.json(
          {
            error:
              "Formato de áudio não suportado pelo WhatsApp. Tente gravar novamente.",
          },
          { status: 422 }
        );
      }
    }

    const uploaded = await uploadCompanyMedia({
      companyId: authResult.context.companyId,
      conversationId,
      buffer: uploadBuffer,
      mimeType: uploadMime,
      filename: uploadName,
    });

    return NextResponse.json({
      storagePath: uploaded.storagePath,
      url: uploaded.signedUrl,
      mimeType: uploadMime,
      filename: uploadName,
    });
  } catch (error) {
    console.error("[whatsapp/upload]", error);
    const message =
      error instanceof Error ? error.message : "Erro ao enviar arquivo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
