// Edge Function: kirim push notification (Expo) untuk baris baru di public.notifications.
//
// Dipicu oleh Database Webhook (INSERT pada tabel notifications) atau cron.
// Setiap pemanggilan "mengklaim" antrean secara atomik lewat RPC claim_push_batch,
// jadi aman meski dipanggil berkali-kali/paralel (mis. 200 tagihan dibuat sekaligus).
//
// Env yang dibutuhkan:
//   PUSH_WEBHOOK_SECRET  rahasia bersama; kirim di header `x-webhook-secret`
//   EXPO_ACCESS_TOKEN    (opsional) jika "Enhanced push security" aktif di akun Expo
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (otomatis tersedia di Supabase)
//
// Deploy: supabase functions deploy push --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MAX_ROUNDS = 10;

interface QueueRow {
  notification_id: string;
  token: string;
  title: string;
  body: string;
  url: string | null;
  community_id: string | null;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret || req.headers.get('x-webhook-secret') !== secret) {
    return new Response('unauthorized', { status: 401 });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');

  let sent = 0;
  const invalidTokens = new Set<string>();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const { data, error } = await supabase.rpc('claim_push_batch', { p_limit: 500 });
    if (error) return new Response(error.message, { status: 500 });
    const rows = (data ?? []) as QueueRow[];
    if (rows.length === 0) break;

    // Expo menerima maksimal 100 pesan per request
    for (const batch of chunk(rows, 100)) {
      const messages = batch.map((r) => ({
        to: r.token,
        title: r.title,
        body: r.body,
        sound: 'default',
        channelId: 'default',
        data: { url: r.url, community_id: r.community_id, notification_id: r.notification_id },
      }));
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        console.error('Expo push gagal', res.status, await res.text());
        continue;
      }
      const tickets = ((await res.json()).data ?? []) as ExpoTicket[];
      tickets.forEach((t, i) => {
        if (t.status === 'ok') sent++;
        else if (t.details?.error === 'DeviceNotRegistered') invalidTokens.add(batch[i].token);
        else console.warn('Tiket push error', t.message);
      });
    }
  }

  // Hapus token perangkat yang sudah uninstall / tidak valid
  if (invalidTokens.size > 0) {
    await supabase.from('push_tokens').delete().in('token', [...invalidTokens]);
  }

  return Response.json({ sent, removed_tokens: invalidTokens.size });
});
