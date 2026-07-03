/**
 * Ponte entre AuthProvider (React) e apiFetch.
 * Garante que o token Firebase seja obtido mesmo com authState ainda inicializando.
 */
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: (() => Promise<string | null>) | null) {
  tokenGetter = getter;
}

export async function getAuthToken(forceRefresh = false): Promise<string | null> {
  if (tokenGetter && !forceRefresh) {
    const token = await tokenGetter();
    if (token) return token;
  }

  const { getFirebaseAuth } = await import("./firebase-client");
  const auth = getFirebaseAuth();
  await auth.authStateReady();

  const user = auth.currentUser;
  if (!user) return null;

  return user.getIdToken(forceRefresh);
}
