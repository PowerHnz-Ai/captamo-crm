export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth-server";
import { getDb } from "@/lib/firebase-admin";
import { sanitizePreferences, DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { UserPreferences } from "@/lib/types";

export async function GET(request: NextRequest) {
  const auth = await verifyAuthToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const doc = await getDb().collection("users").doc(auth.uid).get();
    const data = doc.data() as { preferences?: Partial<UserPreferences> } | undefined;
    const preferences = data?.preferences
      ? sanitizePreferences(data.preferences)
      : DEFAULT_PREFERENCES;
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json({ preferences: DEFAULT_PREFERENCES });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAuthToken(request.headers.get("authorization"));
  if (!auth) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Partial<UserPreferences>;
  try {
    body = (await request.json()) as Partial<UserPreferences>;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const preferences = sanitizePreferences(body);

  try {
    await getDb()
      .collection("users")
      .doc(auth.uid)
      .set({ preferences }, { merge: true });
    return NextResponse.json({ preferences });
  } catch {
    return NextResponse.json(
      { error: "Erro ao salvar preferências." },
      { status: 500 }
    );
  }
}
