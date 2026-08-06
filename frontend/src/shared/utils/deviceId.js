const KEY = 'rb_device_id';

/**
 * Identifiant persistant par navigateur/installation — utilisé pour lier les
 * push_tokens à un device physique plutôt qu'à un compte (voir NotificationRouter
 * côté backend : au plus un token actif par device_id, ce qui empêche un ancien
 * compte de continuer à recevoir les push après un changement d'utilisateur).
 */
export function getDeviceId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'unknown-device';
  }
}
