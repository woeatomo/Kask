# Kask

Aplikasi Android & iOS untuk pengelolaan **iuran wajib & sukarela**, **laporan kas**, dan **berita/pengumuman** warga. Satu aplikasi bisa dipakai banyak komunitas sekaligus, baik **satu RT** maupun **satu RW**, dan data tiap komunitas terpisah total.

| Bagian | Teknologi |
|---|---|
| Aplikasi mobile | Expo SDK 58 (React Native + TypeScript), Expo Router |
| Backend | Supabase: Postgres, Auth, Storage, Row Level Security |

```
mobile/                 Aplikasi Expo (Android & iOS dari satu kode)
supabase/migrations/    Skema database, RLS, trigger, fungsi RPC
supabase/tests/         Tes otomatis alur & isolasi data (Postgres lokal)
```

## Fitur

**Warga**
- Daftar/masuk, lalu bergabung ke komunitas memakai **kode undangan** (perlu disetujui pengurus)
- Melihat tagihan iuran wajib dan membayar dengan unggah bukti transfer/QRIS, atau tunai
- Ikut menyumbang ke iuran sukarela (donasi) dengan progres target dana
- Melihat **laporan kas** bulanan/tahunan (saldo awal, pemasukan, pengeluaran, per kategori) agar transparan
- Membaca berita & pengumuman
- Satu akun bisa ikut beberapa komunitas dan berpindah di tab Akun

**Pengurus** (ketua + pengurus lain seperti bendahara, sekretaris, ketua RT di dalam RW)
- Menyetujui/menolak warga yang ingin bergabung
- Membuat jenis iuran: **wajib** (bulanan atau sekali bayar, bisa dibatasi per RT) dan **sukarela**
- Membuat tagihan per bulan untuk semua warga dengan satu tombol (aman diulang, tidak dobel)
- Memverifikasi pembayaran (melihat foto bukti, terima/tolak dengan alasan)
- Mencatat pembayaran tunai langsung
- Mencatat pengeluaran dan pemasukan lain di buku kas
- Menulis, menyematkan, dan menghapus berita bergambar

**Ketua** (Ketua RW untuk komunitas RW, Ketua RT untuk komunitas RT)
- Semua hak pengurus, ditambah:
- Mengangkat/menurunkan pengurus dan menentukan jabatannya
- **Serah terima jabatan ketua** (ketua lama otomatis menjadi pengurus)
- Mengubah data komunitas, info rekening, daftar RT, dan mengganti kode undangan

**Super admin (developer)**
- Melihat semua komunitas beserta jumlah anggota, ketua, dan saldonya
- Menonaktifkan/mengaktifkan komunitas
- Dapat membaca data di semua komunitas untuk keperluan dukungan

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
| Approve warga, kelola iuran/tagihan, verifikasi, kas, berita | | ✓ | ✓ | ✓ |
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

### 3. Build & rilis (EAS)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build --profile preview --platform android   # APK untuk uji coba
npx eas-cli@latest build --profile production --platform all    # Play Store & App Store
npx eas-cli@latest submit --platform all
```

Sebelum rilis, ganti `ios.bundleIdentifier` / `android.package` di `mobile/app.json` (saat ini `com.kask.app`) dan ikon di `mobile/assets/`. Isi juga environment variable `EXPO_PUBLIC_SUPABASE_*` di EAS (`eas env:create`) supaya build cloud mendapat nilainya.

## Tes

Tes database menjalankan 44 skenario terhadap Postgres biasa, memakai stub skema `auth`/`storage` Supabase. Skenario yang dites antara lain: alur bergabung → approve → buat tagihan → bayar → verifikasi → kas, laporan kas, perubahan peran, serah terima ketua, panel admin, dan **isolasi data antar komunitas**.

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

- Push notification (tagihan baru, pembayaran diverifikasi, berita baru) via `expo-notifications`
- Ekspor laporan kas ke PDF/Excel
- Pembayaran otomatis via payment gateway (Midtrans/Xendit), dengan webhook menandai lunas
- Pengurus RT di dalam RW hanya mengelola warga RT-nya sendiri
- Pengingat jatuh tempo otomatis (cron Supabase + Edge Function)
