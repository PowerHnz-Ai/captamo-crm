"use client";

import { getAuthToken } from "./auth-token";
import { getImpersonation, IMPERSONATION_HEADER } from "./impersonation";

export async function apiFetch(
  input: string,
  init: RequestInit = {},
  retried = false
): Promise<Response> {
  const headers = new Headers(init.headers);

  if (
    !headers.has("Content-Type") &&
    init.body &&
    !(init.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getAuthToken(retried);
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
  headers.set("Authorization", `Bearer ${token}`);

  // Platform admin atuando como uma clínica: o server só honra o header
  // para platform admins; para os demais é ignorado.
  const impersonation = getImpersonation();
  if (impersonation && !headers.has(IMPERSONATION_HEADER)) {
    headers.set(IMPERSONATION_HEADER, impersonation.companyId);
  }

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401 && !retried) {
    const refreshed = await getAuthToken(true);
    if (refreshed) {
      return apiFetch(input, init, true);
    }
  }

  return res;
}

export async function parseApiJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(
      res.ok
        ? "Resposta vazia do servidor."
        : `Erro ${res.status}: resposta vazia do servidor.`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      res.ok
        ? "Resposta inválida do servidor."
        : `Erro ${res.status}: resposta inválida do servidor.`
    );
  }
}
