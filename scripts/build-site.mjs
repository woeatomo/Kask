// Membuat situs publik Kask di folder docs/ (untuk GitHub Pages):
//   index.html            beranda + info hapus akun
//   privacy-policy.html   Kebijakan Privasi   } isi sama dengan di aplikasi
//   faq.html              Bantuan & FAQ       } (mobile/src/content/legal.ts)
//
// Konfirmasi akun & lupa password memakai OTP WhatsApp di dalam aplikasi,
// jadi tidak perlu halaman web untuk itu.
//
// Pemakaian (dari folder mobile/):
//   DEVELOPER_NAME="Nama Anda" SUPPORT_EMAIL="dukungan@domain.com" npm run site:build
// Nama & email boleh juga diambil dari mobile/.env (EXPO_PUBLIC_DEVELOPER_NAME / _SUPPORT_EMAIL).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'mobile', 'package.json'));
const ts = require('typescript');

const src = readFileSync(join(root, 'mobile/src/content/legal.ts'), 'utf8');
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const { PRIVACY_POLICY, FAQ, LEGAL_UPDATED, fillVars } = mod.exports;

// Baca mobile/.env sederhana (KEY=VALUE) bila ada
const dotenv = {};
try {
  for (const line of readFileSync(join(root, 'mobile/.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) dotenv[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
const env = (k) => process.env[k] || dotenv[k] || '';

const vars = {
  developer: env('DEVELOPER_NAME') || env('EXPO_PUBLIC_DEVELOPER_NAME') || 'Pengelola Kask',
  email: env('SUPPORT_EMAIL') || env('EXPO_PUBLIC_SUPPORT_EMAIL') || '[email dukungan belum diisi]',
  limit: process.env.FREE_MEMBER_LIMIT || 50,
};
if (vars.developer === 'Pengelola Kask' || vars.email.startsWith('[')) {
  console.warn('⚠️  DEVELOPER_NAME / SUPPORT_EMAIL belum diisi: halaman berisi placeholder.');
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const text = (s) => esc(fillVars(s, vars)).replace(/(https?:\/\/[^\s<]+[^\s<.,])/g, '<a href="$1">$1</a>');

const page = (title, body) => `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Kask</title>
<style>
  :root { --primary: #0f766e; --text: #0f172a; --muted: #64748b; --border: #e2e8f0; --bg: #f5f7f6; --card: #fff; }
  @media (prefers-color-scheme: dark) { :root { --primary: #5eead4; --text: #e2e8f0; --muted: #94a3b8; --border: #334155; --bg: #0b1220; --card: #111a2b; } }
  * { box-sizing: border-box; }
  body { margin: 0; font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: var(--text); background: var(--bg); }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
  header a { color: var(--primary); font-weight: 800; font-size: 22px; text-decoration: none; }
  nav { margin: 8px 0 24px; display: flex; gap: 16px; flex-wrap: wrap; }
  nav a { color: var(--muted); }
  h1 { font-size: 28px; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 28px 0 8px; }
  .muted { color: var(--muted); font-size: 14px; }
  a { color: var(--primary); }
  ul { padding-left: 22px; } li { margin-bottom: 6px; }
  details { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 12px 16px; margin-bottom: 8px; }
  summary { cursor: pointer; font-weight: 600; }
  details p { margin: 10px 0 0; }
</style>
</head>
<body><main>
<header><a href="index.html">Kask</a></header>
<nav><a href="faq.html">Bantuan &amp; FAQ</a><a href="privacy-policy.html">Kebijakan Privasi</a></nav>
${body}
</main></body></html>
`;

const privacy = page(
  'Kebijakan Privasi',
  `<h1>Kebijakan Privasi</h1><p class="muted">Terakhir diperbarui: ${esc(LEGAL_UPDATED)}</p>` +
    PRIVACY_POLICY.map(
      (s) =>
        `<h2>${esc(s.title)}</h2>` +
        (s.intro ? `<p>${text(s.intro)}</p>` : '') +
        (s.bullets ? `<ul>${s.bullets.map((b) => `<li>${text(b)}</li>`).join('')}</ul>` : '') +
        (s.paragraphs ?? []).map((p) => `<p>${text(p)}</p>`).join(''),
    ).join(''),
);

const faq = page(
  'Bantuan & FAQ',
  `<h1>Bantuan &amp; FAQ</h1>` +
    FAQ.map(
      (c) =>
        `<h2>${esc(c.title)}</h2>` +
        c.items.map((i) => `<details><summary>${text(i.q)}</summary><p>${text(i.a)}</p></details>`).join(''),
    ).join('') +
    `<h2>Masih ada pertanyaan?</h2><p>Hubungi kami di ${text(vars.email)}.</p>`,
);

const index = page(
  'Iuran, kas, dan berita warga RT/RW',
  `<h1>Kask</h1><p>Aplikasi Android &amp; iOS untuk mengelola iuran wajib dan sukarela, laporan kas, dan pengumuman warga RT/RW.</p>
   <ul><li><a href="faq.html">Bantuan &amp; FAQ</a></li><li><a href="privacy-policy.html">Kebijakan Privasi</a></li></ul>
   <p class="muted">Penghapusan akun: buka aplikasi → Akun → Hapus akun, atau kirim permintaan ke ${text(vars.email)}.</p>`,
);

const out = join(root, 'docs');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'privacy-policy.html'), privacy);
writeFileSync(join(out, 'faq.html'), faq);
writeFileSync(join(out, 'index.html'), index);
console.log('Ditulis ke', out);
