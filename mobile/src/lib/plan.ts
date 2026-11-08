import type { Community } from './types';

/** Sama dengan public.is_premium() di database */
export function isPremiumCommunity(c: Pick<Community, 'plan' | 'plan_expires_at'>): boolean {
  return c.plan === 'premium' && (!c.plan_expires_at || new Date(c.plan_expires_at).getTime() > Date.now());
}

export const PREMIUM_BENEFITS = [
  { icon: 'document-text-outline', title: 'Export PDF laporan kas', desc: 'Bulanan/tahunan, siap dibagikan ke grup atau dicetak' },
  { icon: 'people-outline', title: 'Export PDF rekap tagihan', desc: 'Daftar warga lunas & belum lunas per iuran' },
  { icon: 'eye-off-outline', title: 'Tanpa iklan', desc: 'Untuk seluruh pengurus dan warga di komunitas' },
] as const;

/**
 * Kontak developer untuk upgrade (nomor WhatsApp, format 628xxx).
 * Diisi lewat EXPO_PUBLIC_UPGRADE_WHATSAPP; kosong = tombol kontak disembunyikan.
 */
export const UPGRADE_WHATSAPP = process.env.EXPO_PUBLIC_UPGRADE_WHATSAPP ?? '';
export const PREMIUM_PRICE_LABEL = process.env.EXPO_PUBLIC_PREMIUM_PRICE_LABEL ?? '';
