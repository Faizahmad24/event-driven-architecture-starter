# Portfolio dengan dashboard admin

Frontend React + TypeScript, API Go + Encore, dan database PostgreSQL `portfolio`.

## Menjalankan

1. Jalankan Docker.
2. Atur password admin (minimal 8 karakter) lewat prompt Encore, jangan masukkan password ke kode:

   ```powershell
   encore secret set --type local PortfolioAdminPassword
   ```

3. Jalankan `encore run` dari root project.
4. Buka `http://localhost:4000/` untuk portfolio dan `http://localhost:4000/#admin` untuk dashboard.
5. Login dengan password yang tadi disimpan.

Untuk hot reload, jalankan `npm run dev` dari folder `frontend`, lalu buka `http://localhost:5173/`. Vite meneruskan `/api` ke Encore di port 4000, sehingga cookie dan proteksi origin tetap bekerja pada origin yang sama.

## Mengatur konten

Dashboard menyediakan profil, intro, tentang saya, lokasi, email, status ketersediaan, skill, tautan sosial, project, dan pengalaman. Tambah/hapus item lewat dashboard lalu klik **Publikasikan perubahan**. Konten tersimpan di database dan tetap tersedia setelah server direstart. URL project dan sosial harus lengkap dengan `https://` atau `http://`.

Konten awal adalah placeholder yang bisa diedit; tidak ada project atau pengalaman fiktif. Hero memakai ilustrasi CSS. Gambar project dapat diunggah lewat dashboard. Foto profil dan form pengiriman email belum termasuk; kontak menggunakan tautan email.

Perubahan masih berupa draft di browser sampai dipublikasikan. Jangan tutup dashboard sebelum menyimpan. Publikasi bersamaan dari dua tab ditolak lewat nomor revisi; jika terjadi konflik, catat perubahan lalu muat ulang. Tidak ada autosave draft.

## Konfigurasi dan login

Tidak perlu `.env` untuk konfigurasi default. Encore mengelola koneksi database dan secret backend. Jangan simpan password pada variabel `VITE_*`, karena nilainya akan tersedia di browser.

Cookie login memakai HttpOnly, SameSite Strict, dan Secure pada domain selain localhost. Sesi berlaku 8 jam. Gunakan HTTPS di production, dan atur secret `PortfolioAdminPassword` tersendiri untuk environment deployment. Mengganti secret membatalkan sesi lama. Logout menghapus cookie browser. Pembatasan login 10 percobaan per menit berlaku per proses aplikasi; deployment banyak replica dapat menambahkan rate limiting pada gateway.

## Verifikasi

```powershell
npm --prefix frontend run build
npm --prefix frontend test -- --run
encore check
encore test ./...
```

Build frontend perlu dijalankan setelah mengubah UI, karena `frontend/dist` di-embed oleh Go.

## Kode template asli

Kode Go di `site/`, `monitor/`, dan `slack/` dipertahankan sebagai komentar, termasuk tesnya, sehingga API, cron, Pub/Sub, dan kedua database lama tidak lagi menjadi resource aktif. SQL migrasi lama tetap utuh. Refactor ini tidak menjalankan DROP database atau menghapus data lama. Akses data lama dapat membutuhkan konfigurasi database sebelumnya.

UI lama dipertahankan sebagai komentar di `frontend/src/UptimeTemplate.tsx`; tes lamanya ada di `frontend/src/UptimeTemplate.test.tsx.disabled`. Client Encore lama tetap tersedia sebagai referensi; UI baru memakai API JSON di `frontend/src/lib/portfolio.ts`.

README template asli tetap tersedia di `README.md`. Tidak ada deployment atau commit otomatis.

## Gambar project (opsional)

Di dashboard, buka bagian Project lalu klik **Choose File / Pilih File** pada **Upload gambar (opsional)**. Pilih gambar dari laptop atau HP: JPEG, PNG, atau WebP, maksimal 5 MB. Tunggu upload selesai untuk melihat preview, lalu klik **Publikasikan perubahan** agar gambar terpasang di landing page.

Untuk mengganti gambar, pilih file lain. Tombol **Hapus gambar project** melepas gambar dari draft project; publikasikan agar penghapusan tampil ke pengunjung. Gambar tidak wajib diisi. Jika kosong atau gagal dimuat, ilustrasi bawaan tetap muncul. URL gambar lama tetap kompatibel.

File disimpan di tabel `project_images` pada database PostgreSQL `portfolio`, sehingga tetap tersedia setelah restart dan ikut dicadangkan bersama database. Migrasi tabel berjalan otomatis melalui Encore. Upload hanya tersedia untuk admin yang sudah login. Gambar yang diunggah dapat diakses publik lewat URL gambar tersebut; gunakan gambar yang memang ingin dibagikan. File identik memakai penyimpanan yang sama. Menghapus gambar dari project tidak menghapus file database agar tidak merusak referensi project lain. Upload yang belum dipublikasikan juga tetap tersimpan.

## Foto profil di hero

Di dashboard bagian **Profil & identitas**, gunakan **Upload foto profil (opsional)** untuk memilih foto dari perangkat. Format JPEG, PNG, atau WebP, maksimal 5 MB. Preview ditampilkan bulat. Klik **Publikasikan perubahan** agar foto tampil di hero landing page, di depan bola hijau yang tetap dipertahankan. Untuk mengganti foto, pilih file lain; untuk melepas foto dari halaman, klik **Hapus foto profil** lalu publikasikan.

Foto bersifat opsional. Jika kosong atau gagal dimuat, desain bola tetap tampil. Foto menggunakan tabel penyimpanan gambar yang sudah ada, tanpa migrasi baru. Seperti gambar project, file yang telah diunggah dapat diakses publik melalui URL-nya; menghapus foto dari profil hanya melepas referensinya.
