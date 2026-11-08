import type { BillStatus, Community, MemberRole, PaymentMethod, PaymentStatus } from './types';

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function rupiah(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  const s = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}Rp${s}`;
}

/** "2026-11-01" -> Date lokal tanpa geser zona waktu */
export function parseDate(d: string): Date {
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, day);
}

/** Date -> "YYYY-MM-DD" (zona lokal) */
export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function tanggal(d: string | null | undefined): string {
  if (!d) return '-';
  const dt = d.length <= 10 ? parseDate(d) : new Date(d);
  return `${dt.getDate()} ${BULAN[dt.getMonth()].slice(0, 3)} ${dt.getFullYear()}`;
}

export function bulanTahun(d: string | Date): string {
  const dt = typeof d === 'string' ? parseDate(d) : d;
  return `${BULAN[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function monthEnd(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

/** Parse input angka "25.000" / "25000" -> 25000 */
export function parseAmount(s: string): number {
  return Number(s.replace(/[^\d]/g, '')) || 0;
}

export function communityLabel(c: Pick<Community, 'type' | 'rw_number' | 'rt_number'>): string {
  return c.type === 'RW' ? `RW ${c.rw_number}` : `RT ${c.rt_number} / RW ${c.rw_number}`;
}

export const ROLE_LABEL: Record<MemberRole, string> = {
  ketua: 'Ketua',
  pengurus: 'Pengurus',
  warga: 'Warga',
};

export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  belum_bayar: 'Belum bayar',
  menunggu_verifikasi: 'Menunggu verifikasi',
  lunas: 'Lunas',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  menunggu: 'Menunggu',
  diterima: 'Diterima',
  ditolak: 'Ditolak',
};

export const METHOD_LABEL: Record<PaymentMethod, string> = {
  tunai: 'Tunai',
  transfer: 'Transfer bank',
  qris: 'QRIS / e-wallet',
  lainnya: 'Lainnya',
};

export function billPeriodLabel(b: { period: string; dues: { frequency: string } | null }): string {
  return b.dues?.frequency === 'bulanan' ? bulanTahun(b.period) : tanggal(b.period);
}
