// Versi web: push notification tidak didukung.
export interface PushData {
  url?: string | null;
  community_id?: string | null;
  notification_id?: string | null;
}

export async function registerForPush(): Promise<string | null> {
  return null;
}

export async function unregisterPush(): Promise<void> {}
