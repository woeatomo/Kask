/**
 * Konten FAQ & Kebijakan Privasi.
 *
 * Dipakai di dua tempat:
 *   1. Layar /faq dan /privacy di aplikasi
 *   2. scripts/build-legal.mjs -> docs/*.html (URL publik untuk Play Store & App Store)
 *
 * Placeholder {{DEVELOPER}}, {{EMAIL}}, {{LIMIT}} diganti saat ditampilkan.
 * File ini sengaja tidak mengimpor modul React Native agar bisa dibaca skrip Node.
 */

/** Urutan tampil: intro → bullets → paragraphs */
export interface LegalSection {
  title: string;
  intro?: string;
  bullets?: string[];
  paragraphs?: string[];
}

export interface FaqItem {
  q: string;
  a: string;
}

export interface FaqCategory {
  title: string;
  items: FaqItem[];
}

export const LEGAL_UPDATED = '12 November 2026';

export interface LegalVars {
  developer: string;
  email: string;
  limit: number | string;
}

export function fillVars(text: string, v: LegalVars): string {
  return text
    .replace(/\{\{DEVELOPER\}\}/g, v.developer)
    .replace(/\{\{EMAIL\}\}/g, v.email)
    .replace(/\{\{LIMIT\}\}/g, String(v.limit));
}

// -----------------------------------------------------------------------------
// KEBIJAKAN PRIVASI
// -----------------------------------------------------------------------------
export const PRIVACY_POLICY: LegalSection[] = [
  {
    title: '1. Tentang kebijakan ini',
    paragraphs: [
      'Kask adalah aplikasi untuk mengelola iuran, kas, dan pengumuman warga di tingkat RT/RW. Kask dikembangkan dan dikelola oleh {{DEVELOPER}} ("kami").',
      'Kebijakan Privasi ini menjelaskan data pribadi apa yang kami proses, untuk apa, dengan siapa data dibagikan, berapa lama disimpan, dan hak-hak Anda. Kebijakan ini disusun dengan mengacu pada Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).',
      'Dengan mendaftar dan menggunakan Kask, Anda menyatakan telah membaca dan memahami kebijakan ini.',
    ],
  },
  {
    title: '2. Peran kami dan pengurus komunitas',
    paragraphs: [
      'Kami menyediakan dan mengelola platform Kask. Setiap komunitas (RT atau RW) dikelola oleh pengurusnya sendiri. Ketua dan pengurus menentukan iuran apa yang ditagihkan, menyetujui anggota, memverifikasi pembayaran, dan mencatat transaksi kas komunitasnya.',
      'Data satu komunitas dipisahkan secara teknis dari komunitas lain, sehingga pengurus satu komunitas tidak dapat melihat data komunitas lain.',
    ],
  },
  {
    title: '3. Data yang kami kumpulkan',
    bullets: [
      'Data akun: nama lengkap, nomor WhatsApp (dipakai untuk masuk dan menerima kode verifikasi), dan kata sandi. Kata sandi disimpan dalam bentuk hash oleh layanan autentikasi dan tidak dapat kami baca.',
      'Data keanggotaan: komunitas yang Anda ikuti, RT, alamat atau nomor rumah, serta peran dan jabatan Anda (warga, pengurus, ketua).',
      'Data keuangan komunitas: tagihan iuran, pembayaran (nominal, metode, catatan, tanggal), foto bukti pembayaran yang Anda unggah, dan transaksi kas yang dicatat pengurus.',
      'Konten: berita, pengumuman, dan gambar yang dibuat pengurus.',
      'Data perangkat: token notifikasi (push token) dan jenis sistem operasi, untuk mengirim notifikasi ke perangkat Anda.',
      'Data iklan (khusus komunitas berpaket Gratis): penyedia iklan Google AdMob dapat mengumpulkan ID iklan perangkat, alamat IP, dan informasi perangkat untuk menampilkan serta mengukur iklan, sesuai persetujuan Anda.',
    ],
    paragraphs: [
      'Kask tidak mengakses lokasi, kontak, mikrofon, maupun kamera Anda. Akses galeri foto hanya digunakan saat Anda sendiri memilih gambar untuk diunggah.',
    ],
  },
  {
    title: '4. Tujuan penggunaan data',
    bullets: [
      'Membuat dan mengelola akun Anda, termasuk memverifikasi nomor WhatsApp dan mengatur ulang kata sandi melalui kode OTP yang dikirim lewat WhatsApp.',
      'Menjalankan fitur Kask: keanggotaan komunitas, tagihan, pembayaran, verifikasi, laporan kas, dan berita.',
      'Mengirim notifikasi terkait aktivitas komunitas Anda, misalnya tagihan baru, status pembayaran, dan pengumuman.',
      'Mengelola paket langganan komunitas (Gratis/Premium) dan menampilkan iklan pada paket Gratis.',
      'Menjaga keamanan layanan, mencegah penyalahgunaan, dan memberikan dukungan teknis.',
      'Memenuhi kewajiban hukum yang berlaku.',
    ],
    paragraphs: [
      'Dasar pemrosesan data adalah pelaksanaan perjanjian penggunaan layanan dengan Anda, persetujuan Anda (misalnya untuk notifikasi dan iklan yang dipersonalisasi), serta kepentingan yang sah untuk menjaga keamanan layanan.',
      'Kami tidak menjual data pribadi Anda.',
    ],
  },
  {
    title: '5. Siapa yang dapat melihat data Anda',
    bullets: [
      'Sesama anggota aktif komunitas dapat melihat nama, jabatan, dan RT Anda pada daftar anggota.',
      'Ketua dan pengurus komunitas dapat melihat nomor WhatsApp, alamat, tagihan, riwayat pembayaran, dan foto bukti pembayaran Anda. Di komunitas RW, pengurus yang wewenangnya dibatasi ke satu RT hanya dapat melihat data warga RT tersebut.',
      'Buku kas komunitas dapat dilihat oleh semua anggota demi transparansi. Pemasukan dari iuran yang telah diverifikasi dicatat bersama nama pembayar.',
      'Warga biasa tidak dapat melihat tagihan, pembayaran, maupun bukti pembayaran warga lain.',
      'Tim pengelola Kask (kami) dapat mengakses data bila diperlukan untuk dukungan teknis, keamanan, atau kewajiban hukum.',
    ],
  },
  {
    title: '6. Penyedia layanan pihak ketiga',
    intro: 'Kami menggunakan penyedia layanan berikut untuk menjalankan Kask:',
    bullets: [
      'Supabase: basis data, autentikasi, dan penyimpanan file (termasuk foto bukti pembayaran dan gambar berita).',
      'Penyedia layanan WhatsApp (Meta WhatsApp Business Platform atau gateway WhatsApp lain yang kami gunakan): pengiriman kode verifikasi (OTP) ke nomor WhatsApp Anda. Yang dikirim hanya nomor tujuan dan isi pesan kode.',
      'Expo (650 Industries): pengiriman notifikasi push ke perangkat.',
      'Google (Firebase Cloud Messaging) dan Apple (Apple Push Notification service): penyaluran notifikasi ke perangkat Android dan iOS.',
      'Google AdMob: penayangan iklan pada komunitas berpaket Gratis. Lihat kebijakan privasi Google di https://policies.google.com/privacy.',
    ],
  },
  {
    title: '7. Transfer data ke luar negeri',
    paragraphs: [
      'Server penyedia layanan di atas dapat berada di luar wilayah Indonesia. Kami memilih penyedia yang menerapkan standar keamanan dan pelindungan data yang memadai, termasuk enkripsi saat data dikirimkan.',
    ],
  },
  {
    title: '8. Penyimpanan dan penghapusan data',
    bullets: [
      'Data akun disimpan selama akun Anda aktif.',
      'Anda dapat menghapus akun kapan saja melalui menu Akun → Hapus akun. Setelah itu, login Anda dihapus, nama pada profil diganti menjadi "Akun dihapus", nomor WhatsApp dan alamat dihapus, keanggotaan dinonaktifkan, dan token notifikasi serta kotak masuk notifikasi Anda dihapus.',
      'Catatan keuangan komunitas (tagihan, pembayaran, bukti pembayaran, dan transaksi kas) adalah bagian dari pembukuan komunitas, sehingga tetap disimpan secara anonim setelah akun dihapus agar laporan kas tetap akurat. Data tersebut ikut terhapus bila komunitasnya dihapus.',
      'Jika Anda adalah ketua dan satu-satunya anggota sebuah komunitas, komunitas tersebut beserta seluruh datanya ikut terhapus saat akun dihapus. Jika masih ada anggota lain, Anda perlu menyerahkan jabatan ketua terlebih dahulu.',
      'Notifikasi yang belum terkirim lebih dari 1 hari tidak dikirim lagi.',
    ],
  },
  {
    title: '9. Keamanan',
    bullets: [
      'Seluruh komunikasi dengan server menggunakan koneksi terenkripsi (HTTPS).',
      'Hak akses dibatasi di tingkat basis data (Row Level Security), sehingga setiap pengguna hanya dapat mengakses data yang menjadi haknya.',
      'Foto bukti pembayaran dan gambar berita disimpan di penyimpanan privat dan hanya dapat dibuka melalui tautan sementara.',
      'Halaman laporan kas dan rekap tagihan dilindungi dari screenshot dan perekaman layar.',
    ],
    paragraphs: [
      'Tidak ada sistem yang sepenuhnya bebas risiko. Jika terjadi kegagalan pelindungan data pribadi, kami akan memberitahukannya sesuai ketentuan UU PDP.',
    ],
  },
  {
    title: '10. Hak Anda',
    bullets: [
      'Mengakses dan memperoleh salinan data pribadi Anda.',
      'Memperbaiki data yang tidak akurat, misalnya melalui menu Ubah profil.',
      'Menghapus akun dan data pribadi Anda melalui menu Hapus akun.',
      'Menarik persetujuan, misalnya mematikan izin notifikasi di pengaturan perangkat atau mengubah pilihan persetujuan iklan.',
      'Mengajukan keberatan atas pemrosesan data tertentu.',
    ],
    paragraphs: ['Untuk menggunakan hak-hak tersebut, hubungi kami melalui email {{EMAIL}}. Kami akan menanggapi dalam waktu paling lambat 3 x 24 jam sesuai UU PDP.'],
  },
  {
    title: '11. Anak-anak',
    paragraphs: [
      'Kask ditujukan untuk warga dewasa (kepala keluarga atau penghuni rumah) yang mengelola iuran lingkungan. Kami tidak dengan sengaja mengumpulkan data pribadi anak di bawah 18 tahun.',
    ],
  },
  {
    title: '12. Perubahan kebijakan',
    paragraphs: [
      'Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan penting akan diberitahukan melalui aplikasi. Tanggal pembaruan terakhir tercantum di bagian atas kebijakan ini.',
    ],
  },
  {
    title: '13. Kontak',
    paragraphs: ['Pertanyaan atau permintaan terkait data pribadi dapat dikirim ke:', '{{DEVELOPER}} · {{EMAIL}}'],
  },
];

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------
export const FAQ: FaqCategory[] = [
  {
    title: 'Umum',
    items: [
      {
        q: 'Apa itu Kask?',
        a: 'Kask adalah aplikasi untuk mengelola iuran wajib dan sukarela, laporan kas, dan pengumuman di lingkungan RT atau RW. Warga bisa membayar iuran dan melihat laporan kas secara transparan, sementara pengurus bisa menagih, memverifikasi pembayaran, dan mencatat kas dari HP.',
      },
      {
        q: 'Apa bedanya komunitas RT dan RW?',
        a: 'Komunitas RT berisi warga satu RT, dengan Ketua RT sebagai pengurus tertinggi. Komunitas RW bisa berisi beberapa RT, dengan Ketua RW sebagai pengurus tertinggi. Di komunitas RW, warga dikelompokkan per RT, dan setiap RT bisa punya kas, iuran, serta pengumuman sendiri yang dikelola Ketua RT-nya.',
      },
      {
        q: 'Apakah Kask gratis?',
        a: 'Ya. Semua fitur inti (iuran, verifikasi pembayaran, laporan kas di aplikasi, berita, dan notifikasi) gratis untuk komunitas hingga {{LIMIT}} anggota aktif, dengan iklan. Paket Premium menambahkan export PDF, anggota tanpa batas, dan menghilangkan iklan.',
      },
      {
        q: 'Bisakah saya ikut lebih dari satu komunitas?',
        a: 'Bisa. Satu akun bisa bergabung ke beberapa komunitas, misalnya rumah dan kontrakan di lokasi berbeda. Pindah komunitas lewat tab Akun → Komunitas lain.',
      },
    ],
  },
  {
    title: 'Untuk warga',
    items: [
      {
        q: 'Bagaimana cara bergabung ke komunitas RT/RW saya?',
        a: 'Daftar dengan nomor WhatsApp, lalu masukkan kode verifikasi 6 digit yang dikirim lewat WhatsApp. Minta kode undangan 6 karakter dari pengurus RT/RW. Setelah masuk, pilih "Gabung dengan kode", masukkan kodenya, pilih RT (untuk komunitas RW), lalu isi alamat rumah. Permintaan Anda akan disetujui pengurus.',
      },
      {
        q: 'Kenapa saya harus menunggu persetujuan?',
        a: 'Agar hanya warga yang benar-benar tinggal di lingkungan tersebut yang bisa melihat laporan kas dan data komunitas. Anda akan mendapat notifikasi saat permintaan disetujui.',
      },
      {
        q: 'Bagaimana cara membayar iuran?',
        a: 'Buka tab Iuran, pilih tagihan, lalu tekan Bayar. Untuk transfer atau QRIS, kirim ke rekening yang tertera, lalu unggah foto bukti transfer. Untuk tunai, serahkan uang ke bendahara/pengurus. Status tagihan menjadi "Menunggu verifikasi" sampai pengurus memeriksanya.',
      },
      {
        q: 'Pembayaran saya ditolak, apa yang harus dilakukan?',
        a: 'Alasan penolakan tampil di Riwayat pembayaran (mis. bukti tidak jelas atau nominal tidak sesuai). Tagihan kembali berstatus "Belum bayar" dan Anda bisa mengirim ulang pembayaran dengan bukti yang benar.',
      },
      {
        q: 'Siapa yang bisa melihat bukti transfer saya?',
        a: 'Hanya Anda dan pengurus yang berwenang atas RT Anda. Warga lain tidak bisa melihat tagihan maupun bukti pembayaran Anda. Namun, pemasukan iuran yang sudah diverifikasi tercatat di buku kas (yang terbuka untuk semua anggota) bersama nama pembayar.',
      },
      {
        q: 'Kenapa saya tidak bisa screenshot halaman laporan kas?',
        a: 'Laporan kas dan rekap tagihan berisi data keuangan dan data pribadi warga, sehingga dilindungi dari screenshot dan rekam layar agar tidak mudah tersebar keluar komunitas. Laporan resmi bisa dibagikan pengurus lewat fitur Export PDF.',
      },
    ],
  },
  {
    title: 'Untuk pengurus',
    items: [
      {
        q: 'Bagaimana memulai sebagai Ketua RT/RW?',
        a: 'Daftar akun, pilih "Buat komunitas", lalu pilih jenis RT atau RW. Anda otomatis menjadi ketua. Untuk RW, tambahkan daftar RT di Akun → Pengaturan komunitas. Bagikan kode undangan dari tab Akun ke grup WhatsApp warga.',
      },
      {
        q: 'Bagaimana membuat tagihan bulanan?',
        a: 'Buka Kelola iuran, tambahkan iuran wajib (mis. Iuran Kebersihan Rp25.000 per bulan). Setiap bulan, pilih bulannya lalu tekan "Buat tagihan". Tagihan dibuat untuk semua warga aktif dan aman ditekan berulang kali karena tidak akan dobel.',
      },
      {
        q: 'Warga membayar tunai, bagaimana mencatatnya?',
        a: 'Buka Kelola iuran → Lihat tagihan, ketuk nama warga, lalu pilih "Catat bayar tunai". Tagihan langsung lunas dan pemasukan otomatis tercatat di kas.',
      },
      {
        q: 'Bagaimana mengangkat bendahara atau Ketua RT?',
        a: 'Ketua membuka Anggota, mengetuk nama warga, lalu memilih jabatan. Di komunitas RW, jabatan "Ketua RT xx" otomatis hanya berwenang atas warga RT tersebut. Untuk Bendahara/Sekretaris, Anda bisa memilih wewenang seluruh RW atau hanya satu RT.',
      },
      {
        q: 'Apa bedanya kas RW dan kas RT?',
        a: 'Iuran yang berlaku untuk seluruh RW masuk ke kas RW. Iuran khusus satu RT masuk ke kas RT tersebut. Laporan kas bisa ditampilkan untuk semua kas, kas RW saja, atau kas satu RT.',
      },
      {
        q: 'Saya ingin berhenti menjadi ketua, bagaimana caranya?',
        a: 'Buka Anggota, ketuk calon ketua baru, lalu pilih "Serahkan jabatan ketua". Anda otomatis menjadi pengurus biasa.',
      },
    ],
  },
  {
    title: 'Paket Premium',
    items: [
      {
        q: 'Apa saja keuntungan Premium?',
        a: 'Export PDF laporan kas dan rekap tagihan (lengkap dengan kolom tanda tangan), anggota tanpa batas, dan tanpa iklan untuk seluruh anggota komunitas.',
      },
      {
        q: 'Berapa batas anggota paket Gratis?',
        a: 'Saat ini {{LIMIT}} anggota aktif per komunitas (termasuk pengurus). Jika batas tercapai, permintaan bergabung baru tidak bisa disetujui sampai komunitas beralih ke Premium. Anggota yang sudah ada tidak terpengaruh.',
      },
      {
        q: 'Bagaimana cara berlangganan?',
        a: 'Ketua membuka Akun → Upgrade ke Premium untuk melihat cara berlangganan, atau menghubungi pengelola Kask di {{EMAIL}} dengan menyebutkan ID komunitas yang tertera di halaman tersebut.',
      },
      {
        q: 'Apa yang terjadi jika masa Premium berakhir?',
        a: 'Komunitas otomatis kembali ke paket Gratis. Semua data tetap aman, tetapi export PDF terkunci, iklan tampil kembali, dan anggota baru tidak bisa disetujui jika jumlah anggota melebihi batas paket Gratis.',
      },
    ],
  },
  {
    title: 'Akun & privasi',
    items: [
      {
        q: 'Saya lupa kata sandi.',
        a: 'Di halaman masuk, tekan "Lupa password?", lalu masukkan nomor WhatsApp akun Anda. Kode 6 digit dikirim lewat WhatsApp. Setelah kode dimasukkan, Anda bisa langsung membuat password baru.',
      },
      {
        q: 'Kode verifikasi WhatsApp tidak masuk.',
        a: 'Pastikan nomor yang dimasukkan aktif di WhatsApp dan koneksi internet HP lancar. Tunggu 1 menit lalu tekan "Kirim ulang kode". Kode berlaku beberapa menit saja. Jika tetap tidak masuk, hubungi kami di {{EMAIL}}.',
      },
      {
        q: 'Saya ganti nomor WhatsApp, bagaimana?',
        a: 'Nomor WhatsApp adalah identitas masuk akun, jadi tidak bisa diubah sendiri dari aplikasi. Hubungi kami di {{EMAIL}} dari nomor lama (bila masih bisa) untuk dibantu memindahkan akun.',
      },
      {
        q: 'Notifikasi tidak muncul di HP saya.',
        a: 'Pastikan izin notifikasi untuk Kask aktif di pengaturan HP. Semua notifikasi juga tersimpan di ikon lonceng pada halaman Beranda.',
      },
      {
        q: 'Bagaimana cara menghapus akun?',
        a: 'Buka Akun → Hapus akun. Nama, nomor WhatsApp, dan data pribadi lain dihapus atau dianonimkan, sedangkan catatan keuangan komunitas tetap tersimpan tanpa nama agar laporan kas tetap akurat. Jika Anda ketua, serahkan jabatan ketua terlebih dahulu.',
      },
      {
        q: 'Apakah data saya aman?',
        a: 'Data dikirim melalui koneksi terenkripsi, dan hak akses dibatasi di tingkat basis data, sehingga warga hanya bisa melihat data miliknya dan pengurus hanya bisa melihat data sesuai wewenangnya. Selengkapnya dapat dibaca di Kebijakan Privasi.',
      },
    ],
  },
];
