import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh token hanya saat aplikasi aktif (direkomendasikan untuk React Native)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Ambil pesan error yang ramah dari error Supabase / Postgres */
export function errorMessage(e: unknown): string {
  if (!e) return 'Terjadi kesalahan';
  if (typeof e === 'string') return e;
  const msg = (e as { message?: string }).message ?? 'Terjadi kesalahan';
  if (msg.includes('row-level security')) return 'Anda tidak memiliki izin untuk aksi ini';
  if (msg.includes('Invalid login credentials')) return 'Nomor WhatsApp atau password salah';
  if (/already registered|already exists/i.test(msg)) return 'Nomor WhatsApp ini sudah terdaftar. Silakan masuk atau gunakan "Lupa password?".';
  if (/rate limit|only request this after/i.test(msg)) return 'Terlalu sering meminta kode. Tunggu sebentar lalu coba lagi.';
  if (/phone provider|sms provider|Unable to get SMS provider/i.test(msg)) return 'Layanan kode WhatsApp belum dikonfigurasi. Hubungi pengelola Kask.';
  return msg;
}
