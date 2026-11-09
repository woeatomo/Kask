import { useEffect, useState } from 'react';
import type { LegalVars } from '@/content/legal';
import { supabase } from './supabase';

/** Identitas pengelola untuk FAQ & Kebijakan Privasi (wajib diisi sebelum rilis) */
export const DEVELOPER_NAME = process.env.EXPO_PUBLIC_DEVELOPER_NAME || 'Pengelola Kask';
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || '[email dukungan belum diisi]';
export const DEFAULT_FREE_MEMBER_LIMIT = 50;

/** URL situs publik (folder docs/ di GitHub Pages), tanpa garis miring di akhir */
export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
/** Tujuan link di email Supabase; undefined = pakai Site URL di pengaturan Supabase */
export const PASSWORD_RESET_URL = SITE_URL ? `${SITE_URL}/reset-password.html` : undefined;
export const EMAIL_CONFIRMED_URL = SITE_URL ? `${SITE_URL}/konfirmasi-email.html` : undefined;

/** Nilai pengganti placeholder; batas anggota diambil dari server jika sudah login */
export function useLegalVars(): LegalVars {
  const [limit, setLimit] = useState<number>(DEFAULT_FREE_MEMBER_LIMIT);
  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'free_member_limit')
      .maybeSingle()
      .then(({ data }) => {
        const v = Number(data?.value);
        if (v > 0) setLimit(v);
      });
  }, []);
  return { developer: DEVELOPER_NAME, email: SUPPORT_EMAIL, limit };
}
