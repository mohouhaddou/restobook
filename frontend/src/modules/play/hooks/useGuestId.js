const STORAGE_KEY = 'play_guest_id';

export function getOrCreateGuestId() {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearGuestId() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function peekGuestId() {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
