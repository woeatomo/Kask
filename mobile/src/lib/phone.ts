/**
 * Normalisasi nomor WhatsApp Indonesia ke format E.164 (+62...).
 * Menerima: 0812-3456-7890, 812 3456 7890, 62812..., +62 812...
 * Mengembalikan null bila tidak valid.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  if (!d.startsWith('62')) return null;
  const local = d.slice(2);
  // nomor seluler Indonesia: 8xx, total 9–13 digit setelah kode negara
  if (!/^8\d{8,12}$/.test(local)) return null;
  return '+' + d;
}

/** +6281234567890 -> 0812-3456-7890 (untuk ditampilkan) */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '-';
  const d = phone.replace(/\D/g, '');
  const local = d.startsWith('62') ? '0' + d.slice(2) : d;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
