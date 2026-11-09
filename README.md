# Kask

Aplikasi Android & iOS untuk pengelolaan **iuran wajib & sukarela**, **laporan kas**, dan **berita/pengumuman** warga. Satu aplikasi bisa dipakai banyak komunitas sekaligus, baik **satu RT** maupun **satu RW**, dan data tiap komunitas terpisah total.

| Bagian | Teknologi |
|---|---|
| Aplikasi mobile | Expo SDK 58 (React Native + TypeScript), Expo Router |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |

```
mobile/                 Aplikasi Expo (Android & iOS dari satu kode)
supabase/migrations/    Skema database, RLS, trigger, fungsi RPC
supabase/functions/     Edge Function pengirim push notification
supabase/tests/         Tes otomatis alur & isolasi data (Postgres lokal)
```


> 🚀 **Mau deploy sampai live di Play Store & App Store?** Ikuti [PANDUAN-DEPLOY.md](PANDUAN-DEPLOY.md) langkah demi langkah.

## Fitur

**Warga**
- Daftar/masuk, lalu bergabung ke komunitas memakai **kode undangan** (perlu disetujui pengurus)
- Melihat tagihan iuran wajib dan membayar dengan unggah bukti transfer/QRIS, atau tunai
- Ikut menyumbang ke iuran sukarela (donasi) dengan progres target dana
- Melihat **laporan kas** bulanan/tahunan (saldo awal, pemasukan, pengeluaran, per kategori) agar transparan
- Membaca berita & pengumuman (termasuk pengumuman khusus RT-nya)
- **Notifikasi** (push ke HP + kotak masuk di aplikasi): tagihan baru, pembayaran diterima/ditolak, berita baru, permintaan bergabung disetujui
- **Export PDF** laporan kas untuk dibagikan ke grup WhatsApp atau dicetak (Premium)
- Bantuan & FAQ, Kebijakan Privasi, dan **hapus akun** sendiri
- Satu akun bisa ikut beberapa komunitas dan berpindah di tab Akun

**Pengurus** (ketua + pengurus lain seperti bendahara, sekretaris, ketua RT di dalam RW)
- Menyetujui/menolak warga yang ingin bergabung
- Membuat jenis iuran: **wajib** (bulanan atau sekali bayar, bisa dibatasi per RT) dan **sukarela**
- Membuat tagihan per bulan untuk semua warga dengan satu tombol (aman diulang, tidak dobel)
- Memverifikasi pembayaran (melihat foto bukti, terima/tolak dengan alasan)
- Mencatat pembayaran tunai langsung
- Mencatat pengeluaran dan pemasukan lain di buku kas
- Menulis, menyematkan, dan menghapus berita bergambar
- Notifikasi saat ada pembayaran yang perlu diverifikasi atau warga yang ingin bergabung
- **Export PDF** rekap tagihan per iuran/bulan (lengkap dengan kolom tanda tangan; Premium)

**Ketua** (Ketua RW untuk komunitas RW, Ketua RT untuk komunitas RT)
- Semua hak pengurus, ditambah:
- Mengangkat/menurunkan pengurus, menentukan jabatannya, dan (di komunitas RW) **membatasi wewenangnya ke satu RT**
- **Serah terima jabatan ketua** (ketua lama otomatis menjadi pengurus)
- Mengubah data komunitas, info rekening, daftar RT, dan mengganti kode undangan

**Super admin (developer)**
- Melihat semua komunitas beserta jumlah anggota, ketua, dan saldonya
- Menonaktifkan/mengaktifkan komunitas
- **Mengatur paket langganan** (Gratis/Premium, masa berlaku) dan melihat kontak ketua untuk penagihan
- Dapat membaca data di semua komunitas untuk keperluan dukungan

## Paket & monetisasi

Langganan berlaku **per komunitas**: ketua yang berlangganan, dan semua anggotanya ikut menikmati.

| | Gratis | Premium |
|---|:-:|:-:|
| Iuran, verifikasi, laporan kas di aplikasi, berita, notifikasi | ✓ | ✓ |
| Export PDF laporan kas & rekap tagihan | 🔒 | ✓ |
| Jumlah anggota aktif per komunitas | maks. 50* | tanpa batas |
| Iklan banner (Beranda & Berita) | tampil | tidak ada |

\* Bisa diubah developer di Panel Admin → *Pengaturan paket Gratis* (tersimpan di tabel `app_settings`). Saat batas tercapai, pendaftar baru tetap bisa mengajukan, tetapi baru bisa disetujui setelah komunitas Premium. Anggota yang sudah ada tidak pernah dikeluarkan otomatis.

- **Aktivasi**: developer membuka Panel Admin → *Atur paket* → Premium 1 bulan / 12 bulan / uji coba 14 hari / tanpa batas, setelah komunitas membayar (transfer, invoice, dll.). Setiap perubahan dicatat di tabel `plan_changes`, dan ketua mendapat notifikasi. Premium otomatis kembali ke Gratis setelah tanggal berakhir.
- **Kontak upgrade**: di layar Premium, ketua bisa menekan tombol WhatsApp ke nomor `EXPO_PUBLIC_UPGRADE_WHATSAPP`, dengan ID komunitas otomatis terisi di pesan.
- **Iklan**: Google AdMob (`react-native-google-mobile-ads`) dengan formulir persetujuan UMP. Iklan hanya muncul di development build atau build store, bukan di Expo Go. Build development memakai iklan tes; untuk production isi `ADMOB_*_APP_ID` (dipakai `app.config.js`) dan `EXPO_PUBLIC_ADMOB_BANNER_*`.

> **Perhatian kebijakan toko aplikasi.** Apple dan Google mewajibkan pembayaran *fitur digital* di dalam aplikasi memakai sistem mereka (Apple IAP / Google Play Billing). Karena itu, di iOS layar Premium tidak menampilkan harga maupun tombol kontak, hanya info untuk menghubungi pengelola. Skema langganan yang dijual langsung ke organisasi (RT/RW) umumnya masuk kategori layanan untuk organisasi, tetapi keputusan akhirnya ada di reviewer. Kalau ditolak, langkah berikutnya adalah memasang IAP (mis. RevenueCat) yang memanggil `admin_set_plan` lewat webhook server.

## FAQ, Kebijakan Privasi, dan hapus akun

- Layar **Bantuan & FAQ** (dengan pencarian) dan **Kebijakan Privasi** bisa dibuka tanpa login dari layar masuk, dan juga dari tab Akun. Layar daftar menampilkan persetujuan Kebijakan Privasi.
- Isinya ditulis sekali di `mobile/src/content/legal.ts`. Kebijakan Privasi disusun mengacu UU No. 27/2022 tentang Pelindungan Data Pribadi.
- **Halaman publik** (wajib untuk Play Console & App Store Connect): jalankan
  ```bash
  cd mobile && npm run site:build   # membaca nama, email, dan URL Supabase dari mobile/.env
  ```
  Perintah ini juga membuat halaman `konfirmasi-email.html` dan `reset-password.html` (tujuan tautan email Supabase). Lalu publikasikan folder `docs/`, misalnya lewat GitHub Pages (Settings → Pages → branch, folder `/docs`). Gunakan URL `…/privacy-policy.html` sebagai Privacy Policy URL, dan `…/index.html` sebagai URL penghapusan akun di Play Console.
- Isi juga `EXPO_PUBLIC_DEVELOPER_NAME` dan `EXPO_PUBLIC_SUPPORT_EMAIL` di `.env` / EAS agar versi di aplikasi tidak menampilkan placeholder.
- **Hapus akun** (wajib App Store & Google Play): Akun → Hapus akun. Login dihapus, profil dianonimkan ("Akun dihapus"), HP/alamat/token/notifikasi dihapus, keanggotaan dinonaktifkan. Catatan tagihan, pembayaran, dan kas komunitas **tetap utuh** agar laporan tidak berubah. Ketua harus menyerahkan jabatan dulu; ketua yang sendirian ikut menghapus komunitasnya.

> Kebijakan Privasi ini adalah draf yang disusun dari cara aplikasi benar-benar memproses data. Sebaiknya ditinjau oleh konsultan hukum sebelum rilis publik.

## Perlindungan laporan

Halaman **Laporan Kas** dan **Rekap Tagihan** memakai `expo-screen-capture`. Selama halaman itu terbuka, screenshot dan rekam layar diblokir: di Android (FLAG_SECURE) layar tersimpan hitam, dan di iOS 13+ diblokir oleh sistem. Perlindungan otomatis dilepas saat pindah halaman. Ini tidak bisa mencegah orang memotret layar dengan HP lain, dan pengguna Premium tetap bisa membagikan laporan lewat Export PDF.

## Wewenang per RT (komunitas RW)

Di komunitas RW, Ketua RW bisa mengangkat pengurus yang wewenangnya **dibatasi ke satu RT**. Jabatan "Ketua RT xx" otomatis dibatasi ke RT-nya, sedangkan Bendahara, Sekretaris, dan Pengurus bisa dipilih "Seluruh RW" atau "Hanya RT xx". Pengurus RT hanya bisa:

- Melihat dan menyetujui pendaftar dari RT-nya
- Melihat tagihan dan pembayaran warga RT-nya, memverifikasi, dan mencatat pembayaran tunai
- Membuat iuran khusus RT-nya, yang masuk ke **kas RT**
- Membuat tagihan iuran RW untuk warga RT-nya saja (uangnya tetap masuk kas RW)
- Mencatat transaksi di kas RT-nya
- Menulis pengumuman khusus RT, yang hanya terlihat oleh warga RT tersebut dan pengurusnya

Pengurus RT tidak bisa mengubah iuran/kas/berita tingkat RW, mengubah data komunitas atau daftar RT, memindahkan warga antar RT, maupun melihat data RT lain. Laporan kas bisa ditampilkan untuk semua kas, kas RW saja, atau kas satu RT, dan bisa dilihat semua warga demi transparansi.

Semua batasan ini juga dipaksakan di database (RLS & RPC), tidak hanya disembunyikan di aplikasi.

## Keamanan & pemisahan data

Pemisahan data antar komunitas **dipaksakan di database**, bukan di aplikasi:

- Semua tabel memakai **Row Level Security**. User hanya bisa membaca atau menulis baris dari komunitas tempat dia menjadi anggota **aktif**.
- Foreign key komposit `(id, community_id)` mencegah data dari satu komunitas tertaut ke komunitas lain (misalnya tagihan RT A memakai iuran RT B).
- Warga hanya bisa melihat tagihan dan pembayarannya sendiri. Buku kas bisa dilihat semua anggota (transparansi), tetapi hanya pengurus yang bisa mengubahnya.
- Status pembayaran tidak bisa diubah langsung. Perubahan hanya lewat `verify_payment` oleh pengurus. Saat diterima, tagihan otomatis menjadi lunas dan pemasukan kas otomatis tercatat, dan baris kas otomatis itu tidak bisa diedit manual.
- Kolom sensitif seperti `profiles.is_super_admin`, `communities.is_active`, dan `invite_code` tidak bisa diubah oleh user.
- Bukti transfer disimpan di bucket privat. Yang bisa melihatnya hanya pengunggah dan pengurus komunitas tersebut.

Peran per komunitas:

| Aksi | Warga | Pengurus | Ketua | Super admin |
|---|:-:|:-:|:-:|:-:|
| Lihat berita, kas, iuran | ✓ | ✓ | ✓ | ✓ (semua) |
| Bayar / kirim bukti | ✓ | ✓ | ✓ | |
| Approve warga, kelola iuran/tagihan, verifikasi, kas, berita | | ✓ (pengurus RT: hanya RT-nya) | ✓ | ✓ |
| Atur pengurus, serah terima ketua, edit komunitas | | | ✓ | ✓ |
| Nonaktifkan komunitas | | | | ✓ |

## Setup

### 1. Supabase

1. Buat proyek di [supabase.com](https://supabase.com).
2. Jalankan migrasi, pilih salah satu cara:
   - **SQL Editor**: salin lalu jalankan isi `supabase/migrations/20261108000001_init.sql`, kemudian `20261108000002_storage.sql`, sesuai urutan.
   - **Supabase CLI**: `supabase link --project-ref <ref>` lalu `supabase db push`.
3. Di **Authentication → Providers → Email**, atur apakah perlu konfirmasi email.
4. Daftar akun lewat aplikasi, lalu jadikan akun developer sebagai super admin lewat SQL Editor:
   ```sql
   update public.profiles set is_super_admin = true
   where id = (select id from auth.users where email = 'email-anda@contoh.com');
   ```

### 2. Aplikasi mobile

```bash
cd mobile
cp .env.example .env      # isi EXPO_PUBLIC_SUPABASE_URL & EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo start            # scan QR dengan aplikasi Expo Go (Android/iOS)
```

Nilai URL dan anon/publishable key ada di Supabase Dashboard → Project Settings → API.

### 3. Push notification

Notifikasi selalu tersimpan di kotak masuk aplikasi (ikon lonceng di Beranda). Agar juga muncul sebagai push di HP:

1. **Hubungkan ke EAS**: `cd mobile && npx eas-cli@latest init`. Perintah ini menulis `extra.eas.projectId` ke `app.json`, yang dibutuhkan untuk mendapatkan push token.
2. **Kredensial**: untuk Android, unggah kunci FCM V1 (Firebase) lewat `npx eas-cli@latest credentials`. Untuk iOS, kunci APNs dibuat otomatis saat `eas build`.
3. **Development build**: push **tidak didukung di Expo Go** (Android). Uji dengan `npx eas-cli@latest build --profile development`.
4. **Edge Function** (butuh [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase link --project-ref <ref>
   supabase secrets set PUSH_WEBHOOK_SECRET=<string-acak-panjang>
   supabase functions deploy push --no-verify-jwt
   ```
5. **Database Webhook**: buka Dashboard → Database → Webhooks → *Create a new hook*:
   - Table `notifications`, event **Insert**
   - Type **HTTP Request**, method `POST`, URL `https://<ref>.supabase.co/functions/v1/push`
   - HTTP header `x-webhook-secret: <string-acak-panjang>` (sama dengan langkah 4)

Cara kerjanya: trigger database menulis baris ke `notifications` (satu baris per penerima). Webhook lalu memanggil Edge Function, yang mengklaim antrean secara atomik (`claim_push_batch`) dan mengirimnya ke Expo Push API dalam batch berisi 100 pesan. Token perangkat yang sudah tidak terdaftar otomatis dihapus. Kalau "Enhanced push security" aktif di akun Expo, set juga secret `EXPO_ACCESS_TOKEN`.

### 4. Build & rilis (EAS)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # APK untuk uji coba
npx eas-cli@latest build --profile production --platform all    # Play Store & App Store
npx eas-cli@latest submit --platform all
```

Sebelum rilis, ganti `ios.bundleIdentifier` / `android.package` di `mobile/app.json` (saat ini `com.kask.app`) dan ikon di `mobile/assets/`. Isi juga environment variable `EXPO_PUBLIC_SUPABASE_*` di EAS (`eas env:create`) supaya build cloud mendapat nilainya.

## Tes

Tes database menjalankan 123 skenario terhadap Postgres biasa, memakai stub skema `auth`/`storage` Supabase. Skenario yang dites antara lain: alur bergabung → approve → buat tagihan → bayar → verifikasi → kas, laporan kas (semua kas/RW/RT), perubahan peran, serah terima ketua, panel admin, **isolasi data antar komunitas**, **batas wewenang pengurus RT**, notifikasi (siapa menerima apa), antrean push (tidak terkirim dua kali), paket langganan (hanya admin yang bisa mengubah, kedaluwarsa otomatis), batas anggota paket Gratis, dan hapus akun (data pribadi hilang, catatan kas komunitas tetap utuh).

```bash
DATABASE_URL=postgres://postgres@localhost:5432/kask_test ./supabase/tests/run_local.sh
```

> Skrip ini menghapus skema `public`, `auth`, dan `storage` di database target. Jalankan hanya di database tes yang kosong, **jangan** di proyek Supabase.

Aplikasi mobile:

```bash
cd mobile && npm run typecheck
```

## Alur penggunaan singkat

1. Ketua RT/RW mendaftar, lalu memilih **Buat komunitas** (RT atau RW). Untuk RW, tambahkan daftar RT di Pengaturan komunitas.
2. Ketua membagikan **kode undangan** dari tab Akun ke grup WhatsApp warga.
3. Warga mendaftar → **Gabung dengan kode** → pengurus menyetujui.
4. Ketua mengangkat bendahara/sekretaris (dan ketua RT jika komunitasnya RW) sebagai pengurus.
5. Bendahara membuat iuran wajib, lalu setiap bulan menekan **Buat tagihan**.
6. Warga membayar dan mengunggah bukti → bendahara memverifikasi → kas otomatis bertambah.
7. Pengeluaran dicatat bendahara, dan semua warga bisa melihat laporan kasnya.

## Ide pengembangan berikutnya

- Pembayaran langganan Premium in-app (RevenueCat / Google Play Billing / Apple IAP)
- Pembayaran iuran otomatis via payment gateway (Midtrans/Xendit), dengan webhook menandai lunas
- Pengingat jatuh tempo otomatis (pg_cron yang menulis ke `notifications`)
- Export Excel
- Pengaturan notifikasi per jenis (mis. matikan notifikasi berita)
