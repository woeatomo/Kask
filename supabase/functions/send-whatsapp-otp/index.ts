// Supabase Auth "Send SMS Hook": kirim kode OTP lewat WhatsApp.
//
// Dipanggil oleh Supabase Auth setiap kali ada OTP nomor HP (daftar, lupa
// password, login OTP). Saat hook aktif, Supabase TIDAK memakai provider SMS
// bawaan, jadi gateway WhatsApp-nya bebas dipilih di sini.
//
// Payload dari Supabase (lihat supabase/auth internal/hooks/v0hooks):
//   { metadata: {...}, user: {...}, sms: { otp: "123456", phone: "6281234567890" } }
// Balasan: 200 + {} bila sukses, atau 200 + { error: { http_code, message } }
// (pesan error diteruskan ke aplikasi apa adanya).
//
// Env (supabase secrets set ...):
//   SEND_SMS_HOOK_SECRET   rahasia hook dari dashboard, format "v1,whsec_..."
//   WA_PROVIDER            "meta" (WhatsApp Cloud API resmi) | "fonnte"
//   -- meta --
//   WA_META_TOKEN          access token permanen (System User) WhatsApp Business
//   WA_META_PHONE_ID       Phone number ID pengirim
//   WA_META_TEMPLATE       nama template kategori AUTHENTICATION (default "kasmee_otp")
//   WA_META_LANG           kode bahasa template (default "id")
//   WA_META_API_VERSION    versi Graph API (default "v23.0")
//   -- fonnte --
//   WA_FONNTE_TOKEN        token device Fonnte
//
// Deploy: supabase functions deploy send-whatsapp-otp --no-verify-jwt

import { Webhook } from 'npm:standardwebhooks@1.1.1';

const APP_NAME = 'Kasmee';

function ok() {
  return Response.json({});
}

function fail(message: string, httpCode = 500) {
  // tetap 200 agar Supabase membaca pesan error kita (bukan "Unexpected status code")
  return Response.json({ error: { http_code: httpCode, message } });
}

async function sendViaMeta(phone: string, otp: string): Promise<string | null> {
  const token = Deno.env.get('WA_META_TOKEN');
  const phoneId = Deno.env.get('WA_META_PHONE_ID');
  if (!token || !phoneId) return 'Konfigurasi WhatsApp (Meta) belum lengkap';
  const version = Deno.env.get('WA_META_API_VERSION') ?? 'v23.0';
  const res = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: Deno.env.get('WA_META_TEMPLATE') ?? 'kasmee_otp',
        language: { code: Deno.env.get('WA_META_LANG') ?? 'id' },
        // Template autentikasi: kode di body + tombol "Salin kode"
        components: [
          { type: 'body', parameters: [{ type: 'text', text: otp }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: otp }] },
        ],
      },
    }),
  });
  if (res.ok) return null;
  const detail = await res.text();
  console.error('WhatsApp Cloud API gagal', res.status, detail);
  return 'Gagal mengirim kode lewat WhatsApp. Pastikan nomor aktif di WhatsApp lalu coba lagi.';
}

async function sendViaFonnte(phone: string, otp: string): Promise<string | null> {
  const token = Deno.env.get('WA_FONNTE_TOKEN');
  if (!token) return 'Konfigurasi WhatsApp (Fonnte) belum lengkap';
  const form = new FormData();
  form.append('target', phone);
  form.append(
    'message',
    `Kode verifikasi ${APP_NAME}: *${otp}*\n\nJangan berikan kode ini kepada siapa pun, termasuk pengurus RT/RW.`,
  );
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: { Authorization: token },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body?.status !== false) return null;
  console.error('Fonnte gagal', res.status, JSON.stringify(body));
  return 'Gagal mengirim kode lewat WhatsApp. Pastikan nomor aktif di WhatsApp lalu coba lagi.';
}

Deno.serve(async (req) => {
  const secret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (!secret) return fail('Hook belum dikonfigurasi');

  const payload = await req.text();
  let data: { sms?: { otp?: string; phone?: string }; user?: { phone?: string } };
  try {
    // Supabase menandatangani dengan Standard Webhooks; rahasia berformat "v1,whsec_..."
    const wh = new Webhook(secret.replace(/^v1,/, ''));
    data = wh.verify(payload, Object.fromEntries(req.headers)) as typeof data;
  } catch (e) {
    console.error('Tanda tangan hook tidak valid', e);
    return new Response(JSON.stringify({ error: { http_code: 401, message: 'Invalid signature' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const otp = data.sms?.otp;
  const phone = (data.sms?.phone || data.user?.phone || '').replace(/\D/g, '');
  if (!otp || !phone) return fail('Data OTP tidak lengkap', 400);

  const provider = (Deno.env.get('WA_PROVIDER') ?? 'meta').toLowerCase();
  const error =
    provider === 'fonnte' ? await sendViaFonnte(phone, otp)
    : provider === 'meta' ? await sendViaMeta(phone, otp)
    : `WA_PROVIDER tidak dikenal: ${provider}`;

  return error ? fail(error) : ok();
});
