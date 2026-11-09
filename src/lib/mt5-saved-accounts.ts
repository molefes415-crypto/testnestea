// Saved MT5 logins (like the MT5 app's account list). Passwords are NEVER stored —
// only the personal gateway token, login and server needed to resume a session.
export type SavedMT5Account = { token: string; login: number; server: string; currency?: string };

export const SAVED_KEY = "mt5_saved_accounts";
export const ACTIVE_KEY = "mt_accountId_mt5";

export function firstFourLoginDigits(login: number): string {
  return String(login).slice(0, 4);
}

export function parseSaved(raw: string | null): SavedMT5Account[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter(a => a && typeof a.token === "string" && a.token && Number.isSafeInteger(a.login) && typeof a.server === "string")
      .map(a => ({ token: a.token, login: a.login, server: a.server, currency: typeof a.currency === "string" ? a.currency : undefined }));
  } catch {
    return [];
  }
}

/** Add or replace an account (same login + server). Only whitelisted fields are kept. */
export function upsertSaved(list: SavedMT5Account[], entry: SavedMT5Account & Record<string, unknown>): SavedMT5Account[] {
  const clean: SavedMT5Account = { token: entry.token, login: entry.login, server: entry.server, currency: entry.currency };
  return [...list.filter(a => !(a.login === clean.login && a.server.toLowerCase() === clean.server.toLowerCase())), clean];
}

export function removeSaved(list: SavedMT5Account[], token: string): SavedMT5Account[] {
  return list.filter(a => a.token !== token);
}
