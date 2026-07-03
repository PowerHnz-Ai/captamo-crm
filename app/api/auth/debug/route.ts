export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getAdminAuth, getAdminProjectId, normalizePrivateKey } from "@/lib/firebase-admin";

/** Diagnóstico local — só em development */
export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

  try {
    const auth = getAdminAuth();
    await auth.listUsers(1);
    return NextResponse.json({
      ok: true,
      adminProjectId: getAdminProjectId(),
      envProjectId: projectId,
      clientEmail: clientEmail ? `${clientEmail.slice(0, 8)}...` : null,
      privateKeyOk: Boolean(privateKey?.includes("BEGIN PRIVATE KEY")),
      clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        envProjectId: projectId,
        privateKeyOk: Boolean(privateKey?.includes("BEGIN PRIVATE KEY")),
      },
      { status: 500 }
    );
  }
}
