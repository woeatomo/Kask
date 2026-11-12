# Panduan Deploy Kask: dari Server sampai Live di Play Store & App Store

Panduan ini berurutan: ikuti dari atas ke bawah. Setiap tahap diakhiri dengan **✅ Cek**, sehingga kalau ada yang salah, ketahuan di tahap itu dan tidak menumpuk.

> Menu di dashboard Supabase, Expo, Google Play, dan Apple sering berganti nama atau posisi. Kalau ada menu yang tidak persis sama, cari dengan nama yang mirip. Alurnya tetap sama.

**Daftar isi**

0. [Gambaran besar & biaya](#0-gambaran-besar--biaya)
1. [Siapkan akun & tools](#1-siapkan-akun--tools)
2. [Server: Supabase](#2-server-supabase)
3. [Situs publik: FAQ & Kebijakan Privasi](#3-situs-publik-faq--kebijakan-privasi)
4. [Login WhatsApp: OTP lewat WhatsApp](#4-login-whatsapp-otp-lewat-whatsapp)
5. [Push notification: Edge Function & webhook](#5-push-notification-edge-function--webhook)
6. [Identitas aplikasi & EAS](#6-identitas-aplikasi--eas)
7. [Firebase (push Android) & AdMob (iklan)](#7-firebase-push-android--admob-iklan)
8. [Environment variable di EAS](#8-environment-variable-di-eas)
9. [Uji coba di HP (development build)](#9-uji-coba-di-hp-development-build)
10. [Akun super admin & akun demo reviewer](#10-akun-super-admin--akun-demo-reviewer)
11. [Rilis Android (Google Play)](#11-rilis-android-google-play)
12. [Rilis iOS (App Store)](#12-rilis-ios-app-store)
13. [Checklist go-live](#13-checklist-go-live)
14. [Operasional setelah live](#14-operasional-setelah-live)
15. [Troubleshooting](#15-troubleshooting)

---

## 0. Gambaran besar & biaya

```
 HP warga (Android / iOS)                  Situs publik (GitHub Pages)
 ┌───────────────────────┐                 ┌──────────────────────────────┐
 │ Aplikasi Kask (Expo)   │                 │ FAQ · Kebijakan Privasi      │
 │  - login nomor WA      │                 └──────────────────────────────┘
 │  - iuran, kas, berita  │
 │  - iklan AdMob (Gratis)│◄──── kode OTP via WhatsApp ────┐
 └─────────┬─────────────┘                                 │
           │ HTTPS (supabase-js)                           │
 ┌─────────▼──────────────────────────────────────────────┐ │
 │ Supabase                                                │ │
 │  Postgres + RLS (data per komunitas)                    │ │
 │  Auth (nomor HP) ──► Send SMS Hook ──► Edge Function ───┼─┘ WhatsApp Cloud API
 │                                       "send-whatsapp-otp"│   (Meta) / Fonnte
 │  Storage (bukti transfer, gambar berita)                │
 │  Edge Function "push" ◄── Database Webhook (notifikasi) │
 └─────────┬───────────────────────────────────────────────┘
           │ Expo Push API → FCM (Android) / APNs (iOS)
```

| Kebutuhan | Biaya (perkiraan, cek harga terbaru) | Wajib? |
|---|---|---|
| Supabase Free | $0 (proyek dijeda setelah 1 minggu tanpa aktivitas, tanpa backup harian) | untuk uji coba |
| Supabase Pro | ±$25/bulan (tidak dijeda, ada backup harian) | **disarankan saat live** |
| Google Play Console | $25 sekali bayar | ya (Android) |
| Apple Developer Program | $99/tahun | ya (iOS) |
| Expo / EAS | Free tier cukup untuk mulai (kuota build per bulan terbatas, antrean lebih lama) | ya |
| Pengiriman OTP WhatsApp | **Meta WhatsApp Cloud API**: bayar per pesan autentikasi (murah, cek tarif Indonesia di Meta) · **Fonnte**: paket bulanan | **ya**, lihat tahap 4 |
| GitHub Pages | gratis (repo publik) | ya, atau Netlify/Cloudflare Pages |
| AdMob, Firebase | gratis | ya |

**Waktu**: setup teknis sekitar 1 hari. Yang lama justru antrean toko:
- **Akun Google Play pribadi yang baru** wajib menjalankan *closed testing* dengan **minimal 12 penguji selama 14 hari** sebelum bisa rilis ke produksi. Mulai tahap 11 sedini mungkin.
- Review App Store biasanya 1–3 hari.

---

## 1. Siapkan akun & tools

### Akun
- [ ] **GitHub**: repo `Kask` (sudah ada)
- [ ] **Supabase**: https://supabase.com
- [ ] **Expo**: https://expo.dev (untuk EAS Build & push)
- [ ] **Google Play Console**: https://play.google.com/console
- [ ] **Apple Developer Program**: https://developer.apple.com/programs (pilih *Individual*, atau *Organization* yang butuh nomor D-U-N-S)
- [ ] **Firebase**: https://console.firebase.google.com (pakai akun Google yang sama)
- [ ] **AdMob**: https://admob.google.com
- [ ] **Pengirim OTP WhatsApp**: **Meta for Developers** (WhatsApp Cloud API, resmi), *atau* akun **Fonnte** (fonnte.com). Butuh satu **nomor HP khusus pengirim** yang belum dipakai di aplikasi WhatsApp biasa (untuk Meta)

### Tools di komputer
```bash
node -v          # Node.js 20 atau lebih baru (proyek dites dengan Node 22)
git --version
npm install -g supabase       # Supabase CLI (atau: brew install supabase/tap/supabase)
npx eas-cli@latest --version  # EAS CLI, cukup dipanggil lewat npx
```

### Ambil kode
```bash
git clone https://github.com/<akun-anda>/Kask.git
cd Kask
git checkout main   # pastikan perubahan dari branch kerja sudah di-merge ke main
cd mobile && npm install && cd ..
```

✅ **Cek**: `cd mobile && npx tsc --noEmit` selesai tanpa error.

---

## 2. Server: Supabase

### 2.1 Buat proyek
1. Supabase Dashboard → **New project**.
2. **Region**: pilih **Southeast Asia (Singapore)** karena paling dekat dengan Indonesia.
3. Simpan **Database password** di password manager.

### 2.2 Jalankan migrasi database
Ada 6 file migrasi di `supabase/migrations/` yang **harus dijalankan berurutan**:

| File | Isi |
|---|---|
| `…0001_init.sql` | tabel inti, RLS, trigger, RPC |
| `…0002_storage.sql` | bucket `payment-proofs` & `news-images` + kebijakannya |
| `…0003_rt_scope_notifications.sql` | wewenang per RT, notifikasi, antrean push |
| `…0004_plans.sql` | paket Gratis/Premium |
| `…0005_limits_account_deletion.sql` | batas anggota, pengaturan, hapus akun |
| `…0006_phone_auth.sql` | login nomor WhatsApp (nomor login tersinkron ke profil) |

**Cara A: Supabase CLI (disarankan)**
```bash
# dari folder root repo
supabase init                 # hanya sekali; membuat supabase/config.toml (jawab "N" untuk setting VS Code)
supabase login
supabase link --project-ref <project-ref>   # project-ref ada di URL dashboard: supabase.com/dashboard/project/<ref>
supabase db push              # menjalankan semua migrasi yang belum ada di server
```

**Cara B: SQL Editor**
Dashboard → **SQL Editor** → New query. Salin isi file `0001`, Run, lalu lanjutkan ke `0002` dan seterusnya sampai `0006`.

### 2.3 Verifikasi
Jalankan di SQL Editor:
```sql
-- 1) tabel utama
select table_name from information_schema.tables
where table_schema = 'public' order by 1;
-- harus ada: app_settings, bills, cash_transactions, communities, dues, memberships,
-- news, notifications, payments, plan_changes, profiles, push_tokens, rt_units

-- 2) bucket storage
select id, public from storage.buckets;   -- payment-proofs (false), news-images (false)

-- 3) fitur "hapus akun" butuh izin menghapus auth.users
select has_table_privilege('postgres', 'auth.users', 'DELETE');  -- harus true

-- 4) batas anggota paket Gratis
select * from public.app_settings;        -- free_member_limit = 50
```

### 2.4 Catat kunci API
Dashboard → **Project Settings → API** (atau **API Keys**):
- **Project URL**, misalnya `https://abcd1234.supabase.co`
- **anon / publishable key**. Kunci ini memang publik dan dipakai di aplikasi serta halaman web.
- ⚠️ **service_role / secret key** jangan pernah dimasukkan ke aplikasi atau repo. Kunci ini hanya dipakai otomatis oleh Edge Function.

### 2.5 (Saat live) Upgrade ke Pro
Free plan **menjeda proyek** setelah 1 minggu tanpa aktivitas dan tidak menyimpan backup harian. Untuk data keuangan warga, gunakan **Pro** begitu aplikasi dipakai sungguhan.

✅ **Cek**: keempat query verifikasi di atas sesuai harapan.

---

## 3. Situs publik: FAQ & Kebijakan Privasi

Play Store dan App Store mewajibkan **URL Kebijakan Privasi** dan URL penghapusan akun. Keduanya dibuat otomatis ke folder `docs/`. (Konfirmasi akun dan lupa password memakai OTP WhatsApp **di dalam aplikasi**, jadi tidak butuh halaman web.)

### 3.1 Isi identitas & build
Buat `mobile/.env` dari contoh:
```bash
cp mobile/.env.example mobile/.env
```
Isi minimal:
```env
EXPO_PUBLIC_SUPABASE_URL=https://abcd1234.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
EXPO_PUBLIC_DEVELOPER_NAME=Nama Anda / Nama Usaha
EXPO_PUBLIC_SUPPORT_EMAIL=dukungan@domainanda.com
```
Lalu:
```bash
cd mobile && npm run site:build
```
Hasilnya: `docs/index.html`, `docs/privacy-policy.html`, `docs/faq.html`. Commit dan push ke `main`.

> Kebijakan Privasi di `mobile/src/content/legal.ts` masih **draf**. Sebaiknya ditinjau konsultan hukum sebelum rilis, terutama bagian hak pengguna dan janji waktu tanggap 3×24 jam.

### 3.2 Aktifkan GitHub Pages
Repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch `main`, folder **`/docs`** → Save.

- GitHub Pages gratis hanya untuk **repo publik**. Kalau repo-nya privat, unggah folder `docs/` ke **Cloudflare Pages** atau **Netlify** (drag & drop), lalu pakai URL dari sana.

✅ **Cek**: buka `https://<akun>.github.io/Kask/privacy-policy.html`. Nama dan email Anda tampil, dan tidak ada teks "[email dukungan belum diisi]".

---

## 4. Login WhatsApp: OTP lewat WhatsApp

Warga **daftar dan masuk dengan nomor WhatsApp + password**:
- **Daftar**: kode 6 digit dikirim ke WhatsApp, lalu dimasukkan di aplikasi.
- **Lupa password**: kode 6 digit via WhatsApp, lalu warga langsung membuat password baru di aplikasi.

Cara kerjanya: Supabase Auth membuat kode OTP, lalu memanggil **Send SMS Hook**, yaitu Edge Function `send-whatsapp-otp`. Function inilah yang mengirim kode ke WhatsApp lewat gateway pilihan Anda. Selama hook aktif, Supabase **tidak memakai provider SMS bawaan**.

### 4.1 Pilih gateway WhatsApp

| | **Meta WhatsApp Cloud API** (disarankan untuk live) | **Fonnte** |
|---|---|---|
| Status | Resmi dari Meta | Tidak resmi (memakai WhatsApp biasa yang dihubungkan via QR) |
| Biaya | Bayar per pesan *authentication* | Paket bulanan |
| Risiko | Kecil | Nomor pengirim **bisa diblokir WhatsApp** bila dianggap spam |
| Setup | Lebih panjang (Meta Business, template) | 10 menit |

Saran: pakai **Fonnte** untuk uji coba atau pilot di 1–2 RT, lalu **Meta** sebelum rilis besar.

**A. Meta WhatsApp Cloud API**
1. https://developers.facebook.com → **My Apps → Create App** → jenis **Business** → tambahkan produk **WhatsApp**. Ikuti pembuatan/penautan **Meta Business Account**.
2. **WhatsApp → API Setup**: tambahkan **nomor pengirim** (nomor yang *tidak* sedang dipakai di aplikasi WhatsApp/WA Business biasa) dan verifikasi. Catat **Phone number ID**.
3. **WhatsApp Manager → Message templates → Create template**:
   - Category **Authentication**, nama **`kask_otp`**, bahasa **Indonesian (`id`)**
   - Tipe tombol **Copy code**, lalu kirim untuk persetujuan (biasanya cepat)
4. **Token permanen**: Business Settings → **System users** → buat system user (Admin) → **Add assets** (aplikasi & akun WhatsApp) → **Generate token** dengan izin `whatsapp_business_messaging` dan `whatsapp_business_management`, tanpa kedaluwarsa.
5. Tambahkan metode pembayaran di WhatsApp Manager. Untuk batas kirim yang lebih besar, selesaikan **Business Verification**.

**B. Fonnte**
1. Daftar di https://fonnte.com → **Add device** → scan QR dari HP dengan nomor pengirim khusus (jangan nomor pribadi).
2. Salin **token device**.

### 4.2 Aktifkan login nomor HP di Supabase
Dashboard → **Authentication → Sign In / Providers**:
- **Phone**: **Enable** → **Enable phone confirmations**: on.
  - Bila dashboard meminta memilih provider SMS beserta kredensialnya, pilih **Twilio** dan isi nilai sembarang. Kredensial itu **tidak dipakai** selama Send SMS Hook aktif (lihat 4.3).
  - **SMS OTP Expiry**: `300` detik (5 menit), karena pesan WhatsApp kadang terlambat. **OTP length**: `6`.
- **Email**: boleh **dimatikan**, karena aplikasi tidak memakai email.

Dashboard → **Authentication → Rate Limits** → naikkan batas **SMS/OTP per jam** (bawaannya kecil, mis. 30) sesuai jumlah warga yang mendaftar bersamaan.

### 4.3 Deploy Edge Function & pasang hook
1. Dashboard → **Authentication → Auth Hooks** → **Add hook** → **Send SMS hook** → tipe **HTTPS**:
   - URL: `https://<project-ref>.supabase.co/functions/v1/send-whatsapp-otp`
   - Tekan **Generate secret** lalu salin rahasianya (format `v1,whsec_...`). **Belum** perlu disimpan/diaktifkan bila function belum ter-deploy.
2. Di komputer (root repo, setelah `supabase link`):
   ```bash
   supabase secrets set SEND_SMS_HOOK_SECRET='v1,whsec_...'

   # --- jika memakai Meta ---
   supabase secrets set WA_PROVIDER=meta \
     WA_META_TOKEN='<token permanen>' \
     WA_META_PHONE_ID='<phone number id>' \
     WA_META_TEMPLATE=kask_otp WA_META_LANG=id

   # --- jika memakai Fonnte ---
   supabase secrets set WA_PROVIDER=fonnte WA_FONNTE_TOKEN='<token device>'

   supabase functions deploy send-whatsapp-otp --no-verify-jwt
   ```
   `--no-verify-jwt` diperlukan karena pemanggilnya Supabase Auth. Keamanannya dijaga tanda tangan Standard Webhooks yang diperiksa function.
3. Kembali ke halaman hook → **Enable** → **Create/Save**.

Bila versi Graph API bawaan (`v23.0`) sudah tidak berlaku, set `WA_META_API_VERSION` ke versi terbaru dari dokumentasi Meta.

### 4.4 Nomor uji (tanpa kirim WhatsApp)
Untuk simulasi dan akun **reviewer toko**, Supabase punya **Test OTP**:
Authentication → Sign In / Providers → **Phone** → **Test Phone Numbers and OTPs**, isi misalnya:
```
6281200000001=123456, 6281200000002=123456
```
Nomor ini tidak dikirimi pesan; kodenya selalu `123456`. Isi juga tanggal kedaluwarsanya.

✅ **Cek**: setelah tahap 9, daftar akun dari HP dengan nomor WhatsApp asli. Kode harus masuk ke WhatsApp dalam beberapa detik. Uji juga **Lupa password?**: kode masuk, lalu muncul layar "Password Baru", dan password baru bisa dipakai login. Bila gagal, buka Edge Functions → `send-whatsapp-otp` → **Logs**.

---

## 5. Push notification: Edge Function & webhook

Notifikasi selalu tersimpan di kotak masuk aplikasi (ikon lonceng). Tahap ini membuatnya **juga muncul sebagai push di HP**.

### 5.1 Deploy Edge Function
```bash
# dari root repo, setelah supabase link (tahap 2.2)
openssl rand -hex 32          # buat rahasia acak, simpan hasilnya
supabase secrets set PUSH_WEBHOOK_SECRET=<hasil-openssl>
supabase functions deploy push --no-verify-jwt
```
`--no-verify-jwt` diperlukan karena pemanggilnya webhook database, bukan user. Keamanannya dijaga oleh header `x-webhook-secret`.

Jika di akun Expo Anda mengaktifkan *Enhanced push security*, buat Access Token di expo.dev → Account settings → Access tokens, lalu:
```bash
supabase secrets set EXPO_ACCESS_TOKEN=<token>
```

### 5.2 Database Webhook
Dashboard → **Integrations → Database Webhooks** (di dashboard versi lama: **Database → Webhooks**) → Enable bila diminta → **Create a new hook**:

| Field | Isi |
|---|---|
| Name | `push_notifications` |
| Table | `public.notifications` |
| Events | ✔ Insert |
| Type | HTTP Request (atau Supabase Edge Functions → `push`) |
| Method | POST |
| URL | `https://<project-ref>.supabase.co/functions/v1/push` |
| HTTP Headers | `x-webhook-secret` = `<hasil-openssl>` (harus sama dengan 5.1) |

✅ **Cek**: Dashboard → Edge Functions → `push` → **Logs**. Setelah ada notifikasi baru (tahap 9), muncul request dengan respons `{"sent":…}`. Respons `401` berarti header rahasia di webhook tidak cocok.

---

## 6. Identitas aplikasi & EAS

### 6.1 Ubah identitas (lakukan SEBELUM build pertama)
Edit `mobile/app.json`:
```json
"name": "Kask",
"slug": "kask",
"ios":     { "bundleIdentifier": "com.namaanda.kask", ... },
"android": { "package":          "com.namaanda.kask", ... }
```
- `bundleIdentifier`/`package` harus **unik di seluruh toko** dan **tidak bisa diganti** setelah rilis. Hindari `com.kask.app`, yang sangat mungkin sudah dipakai orang lain.
- Pakai huruf kecil, titik, dan tanpa tanda minus untuk Android.

### 6.2 Ikon & splash
Ganti file di `mobile/assets/` dengan ukuran yang sama:

| File | Ukuran | Keterangan |
|---|---|---|
| `icon.png` | 1024×1024 | ikon iOS & toko, tanpa transparansi |
| `android-icon-foreground.png` | 512×512 | logo di tengah, area aman ±66% |
| `android-icon-background.png` | 512×512 | latar ikon Android |
| `android-icon-monochrome.png` | 432×432 | ikon tema Android 13+ |
| `splash-icon.png` | 1024×1024 | logo layar pembuka |

### 6.3 Hubungkan ke EAS
```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init      # membuat proyek di expo.dev & menulis extra.eas.projectId ke app.json
```
`projectId` ini **wajib** untuk push token. Commit perubahan `app.json`.

✅ **Cek**: `app.json` sekarang berisi `"extra": { "eas": { "projectId": "…" } }`.

---

## 7. Firebase (push Android) & AdMob (iklan)

### 7.1 Firebase untuk push Android (FCM V1)
1. Firebase Console → **Add project** (Google Analytics boleh dimatikan).
2. **Add app → Android**. Isi *package name* yang sama persis dengan `android.package` di tahap 6.1.
3. Unduh **`google-services.json`**. Jangan di-commit, karena file ini sudah ada di `.gitignore`. Simpan file ini, nanti dipakai di tahap 8.
4. Project settings → **Service accounts** → **Generate new private key** → unduh file JSON service account.
5. Unggah ke EAS:
   ```bash
   npx eas-cli@latest credentials
   # pilih: Android → production → Google Service Account
   #        → Manage your Google Service Account Key for Push Notifications (FCM V1)
   #        → upload file JSON dari langkah 4
   ```

Untuk **iOS** tidak ada langkah manual: kunci APNs dibuat otomatis oleh EAS saat build iOS pertama (jawab **Yes** saat ditanya soal push key).

### 7.2 AdMob
1. AdMob → **Apps → Add app**, buat **dua aplikasi**: Android dan iOS. Pilih "belum dipublikasikan" bila belum ada di toko.
2. Catat **App ID** masing-masing (`ca-app-pub-XXXX~YYYY`).
3. Di setiap aplikasi: **Ad units → Add → Banner**. Catat **Ad unit ID** (`ca-app-pub-XXXX/ZZZZ`).
4. **Privacy & messaging**: buat pesan persetujuan GDPR (*European regulations*). Aplikasi sudah memanggil formulir ini otomatis bila pengguna berada di wilayah yang memerlukannya.
5. **app-ads.txt**: AdMob meminta file `app-ads.txt` di **akar domain** website pengembang yang tercantum di listing toko. Dengan GitHub Pages proyek (`akun.github.io/Kask`), akar domainnya adalah `akun.github.io`. Taruh `app-ads.txt` di repo bernama `<akun>.github.io`, atau pakai domain sendiri.

Selama App ID dan Ad unit ID belum diisi, aplikasi memakai **iklan tes Google**. Iklan tes tidak menghasilkan uang, tapi aman untuk uji coba. Jangan mengklik iklan sungguhan di HP sendiri, karena akun AdMob bisa ditangguhkan.

---

## 8. Environment variable di EAS

`mobile/.env` hanya dipakai di komputer lokal. Build di server EAS membaca variabel dari **expo.dev → proyek Kask → Environment variables**. Isi untuk environment **development**, **preview**, dan **production** (eas.json sudah memetakan setiap profil build ke environment-nya).

| Nama | Nilai | Tipe / visibilitas |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL proyek Supabase | Plain text |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | Plain text |
| `EXPO_PUBLIC_DEVELOPER_NAME` | nama Anda/usaha | Plain text |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | email dukungan | Plain text |
| `EXPO_PUBLIC_UPGRADE_WHATSAPP` | `628xxxxxxxxxx` (kontak upgrade Premium) | Plain text |
| `EXPO_PUBLIC_PREMIUM_PRICE_LABEL` | mis. `Rp50.000 / bulan per komunitas` | Plain text |
| `ADMOB_ANDROID_APP_ID` | App ID Android (`…~…`) | Plain text |
| `ADMOB_IOS_APP_ID` | App ID iOS (`…~…`) | Plain text |
| `EXPO_PUBLIC_ADMOB_BANNER_ANDROID` | Ad unit ID banner Android (`…/…`) | Plain text |
| `EXPO_PUBLIC_ADMOB_BANNER_IOS` | Ad unit ID banner iOS (`…/…`) | Plain text |
| `GOOGLE_SERVICES_JSON` | unggah file `google-services.json` | **File**, Secret |

- Variabel `EXPO_PUBLIC_*` ikut tertanam di aplikasi, jadi **jangan pernah** taruh rahasia (service_role key, password) di variabel berawalan `EXPO_PUBLIC_`.
- Untuk build lokal, salin juga `google-services.json` ke folder `mobile/`.

---

## 9. Uji coba di HP (development build)

Push notification, iklan, dan pemblokiran screenshot **tidak berjalan di Expo Go**. Karena itu uji coba memakai *development build*.

```bash
cd mobile
npx eas-cli@latest build --profile development --platform android
# selesai ±10–20 menit → buka link/QR dari EAS di HP Android → install APK
npx expo start --dev-client     # lalu buka aplikasi Kask (dev) di HP & scan QR
```
Untuk iPhone, `--platform ios` butuh akun Apple Developer, dan perangkat harus didaftarkan lebih dulu lewat `npx eas-cli@latest device:create`.

**Skenario uji minimal** (pakai 2 HP / 2 akun):
- [ ] Daftar akun A dengan nomor WhatsApp → kode masuk ke WhatsApp → masukkan kode → langsung masuk ke aplikasi
- [ ] Akun A: *Buat komunitas* (RW) → tambah RT 01 & RT 02 di Pengaturan komunitas
- [ ] Akun B: daftar → *Gabung dengan kode* (RT 01) → **akun A menerima push "Permintaan bergabung"**
- [ ] A menyetujui B → B menerima push → B masuk ke Beranda
- [ ] A: Kelola iuran → buat iuran wajib → *Buat tagihan* → B menerima push "Tagihan baru"
- [ ] B: bayar + unggah foto bukti → A menerima push → A *Terima* → kas bertambah, B menerima push "diterima"
- [ ] Buka tab **Kas** lalu coba screenshot → hasilnya hitam/diblokir
- [ ] Banner iklan **tes** muncul di Beranda/Berita
- [ ] "Lupa password?" → kode WhatsApp masuk → buat password baru → keluar → login dengan password baru
- [ ] Akun → Hapus akun (pakai akun uji coba ketiga) berhasil

✅ **Cek**: semua kotak di atas tercentang.

---

## 10. Akun super admin & akun demo reviewer

### 10.1 Jadikan diri Anda super admin
Daftar lewat aplikasi, lalu di SQL Editor:
```sql
update public.profiles set is_super_admin = true
where id = (select id from auth.users where phone = '6281234567890');  -- nomor WA Anda, tanpa "+" dan tanpa 0 di depan
```
Tutup dan buka lagi aplikasi. Menu **Panel admin (developer)** muncul di tab Akun.

### 10.2 Akun demo untuk reviewer Google & Apple
Reviewer wajib bisa login, padahal mereka tidak bisa menerima WhatsApp Anda. Solusinya: **nomor uji** (tahap 4.4).
1. Daftarkan nomor uji, mis. `6281200000001=123456`, dengan kedaluwarsa cukup panjang (mis. 1 tahun).
2. Daftar di aplikasi dengan nomor `081200000001` dan password kuat. Masukkan kode `123456`.
3. Akun itu membuat komunitas **"Demo RT 01 / RW 01"**, beserta 1–2 iuran, beberapa transaksi kas, dan 1 berita.
4. Akun kedua (nomor uji `081200000002`) bergabung sebagai warga, dengan 1 pembayaran menunggu verifikasi.
5. Dari Panel Admin, aktifkan **Premium tanpa batas** untuk komunitas demo, supaya reviewer bisa mencoba export PDF.

Simpan nomor dan password akun demo, lalu tulis di Play Console (*App access*) dan App Store Connect (*App Review Information*). Tambahkan catatan: *"Login with phone 081200000001 and password …. If an OTP is requested, use 123456."*

---

## 11. Rilis Android (Google Play)

### 11.1 Build production
```bash
cd mobile
npx eas-cli@latest build --profile production --platform android
```
Hasilnya file **.aab**. Nomor build naik otomatis (`autoIncrement`), dan kunci upload dikelola EAS.

### 11.2 Buat aplikasi di Play Console
**Create app** → nama "Kask", bahasa Indonesia, *App*, *Free*. Centang deklarasi.

### 11.3 Lengkapi "App content" / "Policy"
| Bagian | Isi |
|---|---|
| Privacy policy | `https://<akun>.github.io/Kask/privacy-policy.html` |
| App access | *All or some functionality is restricted* → isi akun demo (10.2) |
| Ads | **Yes, my app contains ads** |
| Content rating | isi kuesioner IARC (aplikasi utilitas, tanpa konten sensitif) |
| Target audience | **18+** |
| Data safety | lihat tabel di bawah |
| Data deletion | URL: `https://<akun>.github.io/Kask/index.html` (berisi cara hapus akun) |
| Financial features | aplikasi ini **bukan** layanan keuangan (tidak ada pinjaman/rekening). Pilih "tidak menyediakan fitur keuangan" kecuali reviewer meminta lain |
| News app | **No**. Berita di Kask adalah pengumuman komunitas |

**Data safety** (sesuaikan dengan Kebijakan Privasi):
- **Dikumpulkan**: Name, Phone number (wajib, untuk login & OTP WhatsApp), Address (alamat rumah), Photos (bukti pembayaran, dari pilihan pengguna), *Financial info → Other* (riwayat pembayaran iuran), Device or other IDs (push token, ID iklan via AdMob), App interactions/diagnostics (oleh SDK iklan).
- **Dibagikan ke pihak ketiga**: Device or other IDs → AdMob (Advertising).
- **Dienkripsi saat transit**: Yes. **Pengguna bisa meminta penghapusan**: Yes.

### 11.4 Store listing
- Ikon 512×512, *feature graphic* 1024×500, minimal 2 screenshot HP.
- Halaman **Kas** dan **Rekap tagihan** sengaja memblokir screenshot. Ambil screenshot dari halaman lain (Beranda, Iuran, Berita, Anggota), atau buat mockup.
- Deskripsi singkat, misalnya: *"Iuran, kas, dan pengumuman warga RT/RW dalam satu aplikasi."*

### 11.5 Testing → Produksi
1. **Internal testing**: upload `.aab` **manual** untuk pertama kali (unduh dari halaman build EAS). Tambahkan email Anda sebagai tester.
2. **Closed testing**: untuk akun developer pribadi yang baru, wajib **≥12 tester aktif selama 14 hari berturut-turut**. Ajak pengurus RT/RW yang akan memakai aplikasinya.
3. Setelah syarat terpenuhi: **Production → Create release** → upload build terbaru → **Send for review**.

Upload berikutnya bisa otomatis:
```bash
npx eas-cli@latest submit --platform android --latest
```
Perintah ini butuh *Google service account* dengan akses Play Console API. Ikuti petunjuk yang muncul saat pertama kali menjalankannya.

---

## 12. Rilis iOS (App Store)

### 12.1 Buat app di App Store Connect
https://appstoreconnect.apple.com → **Apps → +** → New App:
- Platform iOS, nama "Kask" (harus unik di App Store), bahasa Indonesian
- **Bundle ID**: sama dengan `ios.bundleIdentifier` (tahap 6.1). Bila belum muncul, EAS akan mendaftarkannya saat build.

### 12.2 Build & upload
```bash
cd mobile
npx eas-cli@latest build --profile production --platform ios
# login Apple bila diminta; izinkan EAS membuat certificate, provisioning profile,
# dan Apple Push Notifications key (jawab Yes)
npx eas-cli@latest submit --platform ios --latest   # mengunggah ke TestFlight
```

### 12.3 TestFlight
Uji ulang skenario tahap 9 di iPhone lewat aplikasi TestFlight. Pastikan push muncul.

### 12.4 Lengkapi halaman App Store
| Bagian | Isi |
|---|---|
| Privacy Policy URL | `https://<akun>.github.io/Kask/privacy-policy.html` |
| Support URL | `https://<akun>.github.io/Kask/faq.html` |
| App Privacy | Contact Info (nama, nomor telepon), User Content (foto bukti), Financial Info (riwayat pembayaran), Identifiers (Device ID untuk iklan pihak ketiga), Usage/Diagnostics. Semuanya *linked to user*, dan **tidak** dipakai untuk tracking lintas aplikasi |
| Age rating | 4+ / 9+ sesuai kuesioner. Ada iklan, tanpa konten dewasa |
| App Review Information | akun demo (10.2) + catatan singkat cara mencoba |
| Screenshots | iPhone 6.7"/6.9". Kas & Rekap memblokir screenshot, jadi pakai halaman lain |

**Catatan review yang disarankan** (tempel di *Notes*):
> Kask helps neighbourhood associations (RT/RW) in Indonesia manage dues and community cash books. Demo login: reviewer@… / …. The demo community has Premium enabled. Premium is a plan purchased by the organisation (the neighbourhood association), activated by us after an offline agreement; there is no in-app purchase or external purchase link in the iOS app. Account deletion: Akun → Hapus akun.

⚠️ **Risiko kebijakan pembayaran**: Apple bisa meminta fitur Premium dijual lewat In-App Purchase. Aplikasi iOS sudah tidak menampilkan harga maupun tautan pembayaran. Kalau tetap ditolak, opsinya adalah memasang IAP (mis. RevenueCat) yang memanggil `admin_set_plan` dari server.

### 12.5 Submit
Pilih build dari TestFlight → **Add for Review** → **Submit**.

---

## 13. Checklist go-live

**Server**
- [ ] Supabase **Pro** (tidak dijeda, ada backup harian)
- [ ] 5 migrasi sudah jalan, dan query verifikasi 2.3 OK
- [ ] Login Phone aktif, Send SMS Hook aktif, dan OTP WhatsApp sampai untuk daftar & lupa password
- [ ] Rate limit OTP sudah dinaikkan, OTP expiry 300 detik
- [ ] Site URL & Redirect URLs mengarah ke situs publik
- [ ] Edge Function `push` deployed + secret + webhook, dan log menunjukkan `sent`

**Situs publik**
- [ ] `privacy-policy.html` & `faq.html` menampilkan nama dan email asli
- [ ] (AdMob) `app-ads.txt` di akar domain

**Aplikasi**
- [ ] `bundleIdentifier` / `package` final, ikon & splash sudah diganti
- [ ] `extra.eas.projectId` ada di app.json
- [ ] Semua env var EAS terisi untuk **production**, termasuk ID AdMob asli
- [ ] FCM V1 key terunggah, dan push Android & iOS sudah dites di build preview/TestFlight
- [ ] Super admin aktif, dan akun demo reviewer siap

**Toko**
- [ ] Play: Data safety, Ads, Target audience, App access, Data deletion URL, closed testing 14 hari
- [ ] Apple: App Privacy, review notes + akun demo, Support & Privacy URL

---

## 14. Operasional setelah live

### Mengaktifkan Premium (sumber penghasilan)
1. Ketua menghubungi Anda lewat tombol WhatsApp (Android) atau email. Pesannya sudah memuat **ID komunitas**.
2. Setelah pembayaran diterima, buka **Panel admin** → cari komunitas → **Atur paket** → Premium 1/12 bulan.
3. Ketua otomatis mendapat notifikasi, dan riwayatnya tercatat di tabel `plan_changes`.

Rekap pendapatan bisa dilihat dengan SQL:
```sql
select c.name, pc.plan, pc.expires_at, pc.note, pc.created_at
from public.plan_changes pc join public.communities c on c.id = pc.community_id
order by pc.created_at desc;
```
Batas anggota paket Gratis bisa diubah dari Panel admin → *Pengaturan paket Gratis*.

### Memantau
- Supabase → **Logs** (API, Auth, Postgres) dan **Edge Functions → push → Logs**
- Supabase → **Reports** untuk pemakaian database, storage, dan bandwidth
- AdMob → laporan pendapatan
- Play Console / App Store Connect → crash & ulasan

### Rilis versi baru aplikasi
1. Naikkan `"version"` di `mobile/app.json` (mis. `1.0.0` → `1.1.0`). Nomor build naik otomatis.
2. `eas build --profile production --platform all` → `eas submit --platform all --latest`.

Proyek ini belum memakai `expo-updates`, jadi **setiap perubahan aplikasi butuh rilis toko**.

### Perubahan database
Tambahkan file migrasi baru dengan nomor berikutnya (mis. `20261201000007_….sql`), uji dulu lewat `supabase/tests/run_local.sh` di Postgres lokal, lalu jalankan `supabase db push`. **Jangan** mengedit file migrasi yang sudah dijalankan di server.

### Backup
- Pro plan: backup harian otomatis (Dashboard → Database → Backups).
- Tambahan manual sebelum perubahan besar:
  ```bash
  supabase db dump -f backup-$(date +%F).sql --data-only
  ```

---

## 15. Troubleshooting

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| Aplikasi menampilkan "Konfigurasi belum lengkap" | `EXPO_PUBLIC_SUPABASE_*` kosong saat build | Isi env var di EAS (tahap 8) lalu build ulang |
| Kode WhatsApp tidak masuk, Logs `send-whatsapp-otp` kosong | Hook belum aktif / URL hook salah | Periksa Authentication → Auth Hooks (4.3) |
| Logs berisi "Tanda tangan hook tidak valid" | `SEND_SMS_HOOK_SECRET` beda dengan rahasia di dashboard | Salin ulang rahasia `v1,whsec_...`, `supabase secrets set`, deploy ulang |
| Logs berisi "WhatsApp Cloud API gagal" | Token kedaluwarsa, template belum disetujui, nama/bahasa template beda, atau saldo habis | Cek pesan error di log, status template di WhatsApp Manager, metode pembayaran |
| Logs berisi "Fonnte gagal" | Device Fonnte terputus / kuota habis | Scan ulang QR di dashboard Fonnte, cek paket |
| Aplikasi: "Layanan kode WhatsApp belum dikonfigurasi" | Phone provider belum aktif / hook belum aktif | Tahap 4.2 & 4.3 |
| Aplikasi: "Terlalu sering meminta kode" | Rate limit OTP Supabase | Tunggu, atau naikkan batas di Authentication → Rate Limits |
| Aplikasi: "Kode salah atau sudah kedaluwarsa" | Kode lama / lewat batas waktu | Tekan "Kirim ulang kode"; naikkan SMS OTP Expiry ke 300 detik |
| Warga ganti nomor WhatsApp | Nomor = identitas login | Ubah di Dashboard → Authentication → Users → user → nomor telepon; profil ikut berubah otomatis |
| Halaman reset bilang "belum dikonfigurasi" | `site:build` dijalankan tanpa `mobile/.env` | Isi `.env`, jalankan ulang `npm run site:build`, commit `docs/` |
| Push tidak muncul, tapi lonceng ada notifikasi | Webhook/Edge Function belum jalan | Cek Logs Edge Function: `401` berarti secret beda; tidak ada log berarti webhook belum dibuat |
| Push tidak muncul sama sekali di Android | FCM V1 key belum diunggah / `google-services.json` tidak ikut build | Tahap 7.1 & 8, lalu build ulang |
| Push tidak muncul di HP tertentu | Izin notifikasi ditolak / `projectId` belum ada | Aktifkan izin di Pengaturan HP; pastikan `eas init` sudah dijalankan |
| Iklan tidak tampil | Expo Go, komunitas Premium, belum ada fill, atau ID production kosong | Pakai development/production build; cek env `ADMOB_*` & `EXPO_PUBLIC_ADMOB_*` |
| "Batas N anggota paket Gratis tercapai" | Fitur batas paket Gratis | Aktifkan Premium atau naikkan batas di Panel admin |
| "Tidak bisa menghapus akun: masih menjadi ketua" | Disengaja agar komunitas tidak kehilangan ketua | Serahkan jabatan ketua dulu (Anggota → Serahkan jabatan ketua) |
| Hapus akun gagal "permission denied for table users" | Role pemilik fungsi tidak punya izin DELETE ke `auth.users` | Jalankan cek 2.3 no.3. Bila `false`, hubungi support Supabase atau jalankan migrasi sebagai role `postgres` |
| Proyek Supabase tiba-tiba mati | Free plan dijeda karena tidak aktif | Restore dari dashboard; upgrade ke Pro untuk produksi |
