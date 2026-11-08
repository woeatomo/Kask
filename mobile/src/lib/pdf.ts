import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { BILL_STATUS_LABEL, communityLabel, rupiah, tanggal } from './format';
import type { BillStatus, CashReport, CashTransaction, Community } from './types';

const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 28px; }
  h1 { font-size: 18px; margin: 0; }
  h2 { font-size: 13px; margin: 18px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
  .sub { color: #475569; margin: 2px 0; }
  .head { border-bottom: 2px solid #0f766e; padding-bottom: 10px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .in { color: #15803d; } .out { color: #b91c1c; }
  .summary td { font-size: 12px; } .summary tr.total td { font-weight: 700; border-top: 2px solid #0f172a; }
  .footer { margin-top: 28px; color: #64748b; font-size: 9px; }
  .sign { display: flex; justify-content: space-between; margin-top: 36px; }
  .sign > div { width: 40%; text-align: center; } .sign .line { margin-top: 56px; border-top: 1px solid #0f172a; padding-top: 4px; }
  .lunas { color: #15803d; font-weight: 600; } .belum_bayar { color: #b91c1c; font-weight: 600; } .menunggu_verifikasi { color: #b45309; font-weight: 600; }
`;

function header(c: Community, title: string, subtitle: string) {
  const addr = [c.kelurahan, c.kecamatan, c.kota, c.provinsi].filter(Boolean).join(', ');
  return `
    <div class="head">
      <h1>${esc(title)}</h1>
      <p class="sub"><b>${esc(c.name)}</b> · ${esc(communityLabel(c))}${addr ? ` · ${esc(addr)}` : ''}</p>
      <p class="sub">${esc(subtitle)}</p>
    </div>`;
}

function defaultSigners(c: Community): [string, string] {
  return ['Bendahara', c.type === 'RW' ? `Ketua RW ${c.rw_number}` : `Ketua RT ${c.rt_number ?? ''}`.trim()];
}

function footer(printedBy: string, signers: [string, string]) {
  const now = new Date();
  const jam = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return `
    <div class="sign">
      <div>${esc(signers[0])}<div class="line">&nbsp;</div></div>
      <div>${esc(signers[1])}<div class="line">&nbsp;</div></div>
    </div>
    <p class="footer">Dicetak dari aplikasi Kask pada ${tanggal(now.toISOString())} ${jam} oleh ${esc(printedBy)}.</p>`;
}

export function wrapDocument(html: string, fileTitle: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(fileTitle)}</title><style>${STYLE}</style></head><body>${html}</body></html>`;
}

async function renderAndShare(doc: string, fileTitle: string) {
  if (Platform.OS === 'web') {
    await Print.printAsync({ html: doc });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html: doc });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileTitle });
  } else {
    await Print.printAsync({ uri });
  }
}

export interface CashReportPdfOptions {
  community: Community;
  periodLabel: string;
  kasLabel: string;
  report: CashReport;
  transactions: CashTransaction[];
  rtLabel: (id: string | null) => string | null;
  printedBy: string;
  /** Kolom tanda tangan; default Bendahara & Ketua RW/RT */
  signers?: [string, string];
}

export function buildCashReportHtml(opts: CashReportPdfOptions): string {
  const { community, report, transactions } = opts;
  const rows = [...transactions]
    .sort((a, b) => a.trx_date.localeCompare(b.trx_date) || a.created_at.localeCompare(b.created_at))
    .map(
      (t, i) => `<tr>
        <td>${i + 1}</td>
        <td>${tanggal(t.trx_date)}</td>
        <td>${esc(t.description || t.category)}${t.rt_unit_id ? ` <span class="sub">(${esc(opts.rtLabel(t.rt_unit_id))})</span>` : ''}</td>
        <td>${esc(t.category)}</td>
        <td class="num in">${t.type === 'masuk' ? rupiah(t.amount) : ''}</td>
        <td class="num out">${t.type === 'keluar' ? rupiah(t.amount) : ''}</td>
      </tr>`,
    )
    .join('');
  const cats = report.by_category
    .map(
      (c) => `<tr><td>${c.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</td><td>${esc(c.category)}</td>
        <td class="num ${c.type === 'masuk' ? 'in' : 'out'}">${rupiah(c.total)}</td></tr>`,
    )
    .join('');

  const html = `
    ${header(community, 'Laporan Kas', `${opts.kasLabel} · Periode ${opts.periodLabel}`)}
    <h2>Ringkasan</h2>
    <table class="summary">
      <tr><td>Saldo awal</td><td class="num">${rupiah(report.opening_balance)}</td></tr>
      <tr><td>Total pemasukan</td><td class="num in">+${rupiah(report.income)}</td></tr>
      <tr><td>Total pengeluaran</td><td class="num out">−${rupiah(report.expense)}</td></tr>
      <tr class="total"><td>Saldo akhir</td><td class="num">${rupiah(report.closing_balance)}</td></tr>
    </table>
    ${cats ? `<h2>Rekap per kategori</h2><table><tr><th>Jenis</th><th>Kategori</th><th class="num">Jumlah</th></tr>${cats}</table>` : ''}
    <h2>Rincian transaksi (${transactions.length})</h2>
    ${
      rows
        ? `<table><tr><th>No</th><th>Tanggal</th><th>Keterangan</th><th>Kategori</th><th class="num">Masuk</th><th class="num">Keluar</th></tr>${rows}</table>`
        : '<p class="sub">Tidak ada transaksi pada periode ini.</p>'
    }
    ${footer(opts.printedBy, opts.signers ?? defaultSigners(community))}`;
  return wrapDocument(html, `Laporan Kas ${community.name} ${opts.periodLabel}`);
}

export async function exportCashReportPdf(opts: CashReportPdfOptions) {
  await renderAndShare(buildCashReportHtml(opts), `Laporan Kas ${opts.community.name} ${opts.periodLabel}`);
}

export interface BillsRecapPdfOptions {
  community: Community;
  dueName: string;
  periodLabel: string;
  scopeLabel: string | null;
  bills: { name: string; rt: string | null; address: string | null; amount: number; status: BillStatus; paid_at: string | null }[];
  printedBy: string;
  signers?: [string, string];
}

export function buildBillsRecapHtml(opts: BillsRecapPdfOptions): string {
  const { bills } = opts;
  const lunas = bills.filter((b) => b.status === 'lunas');
  const collected = lunas.reduce((s, b) => s + Number(b.amount), 0);
  const total = bills.reduce((s, b) => s + Number(b.amount), 0);
  const rows = bills
    .map(
      (b, i) => `<tr>
        <td>${i + 1}</td><td>${esc(b.name)}</td><td>${esc(b.rt ?? '-')}</td><td>${esc(b.address ?? '-')}</td>
        <td class="num">${rupiah(b.amount)}</td>
        <td class="${b.status}">${esc(BILL_STATUS_LABEL[b.status])}</td>
        <td>${b.paid_at ? tanggal(b.paid_at) : ''}</td>
      </tr>`,
    )
    .join('');
  const html = `
    ${header(opts.community, `Rekap Tagihan: ${opts.dueName}`, `Periode ${opts.periodLabel}${opts.scopeLabel ? ` · ${opts.scopeLabel}` : ''}`)}
    <table class="summary">
      <tr><td>Jumlah warga ditagih</td><td class="num">${bills.length}</td></tr>
      <tr><td>Sudah lunas</td><td class="num in">${lunas.length} warga · ${rupiah(collected)}</td></tr>
      <tr><td>Belum lunas</td><td class="num out">${bills.length - lunas.length} warga · ${rupiah(total - collected)}</td></tr>
      <tr class="total"><td>Total tagihan</td><td class="num">${rupiah(total)}</td></tr>
    </table>
    <h2>Daftar warga</h2>
    <table><tr><th>No</th><th>Nama</th><th>RT</th><th>Alamat</th><th class="num">Nominal</th><th>Status</th><th>Tgl lunas</th></tr>${rows}</table>
    ${footer(opts.printedBy, opts.signers ?? defaultSigners(opts.community))}`;
  return wrapDocument(html, `Rekap ${opts.dueName} ${opts.periodLabel}`);
}

export async function exportBillsRecapPdf(opts: BillsRecapPdfOptions) {
  await renderAndShare(buildBillsRecapHtml(opts), `Rekap ${opts.dueName} ${opts.periodLabel}`);
}
