# 📅 VibePlanner - Python Web Calendar & Activity Planner

**VibePlanner** adalah aplikasi perencana kegiatan dan kalender bulanan interaktif berbasis web. Aplikasi ini memadukan seluruh materi dasar pemrograman Python menggunakan pustaka bawaan (*Python Standard Library*) dengan antarmuka modern bernuansa *Clean Teal Dashboard* yang siap dideploy langsung ke **Vercel** maupun dijalankan secara lokal.

---

## ✨ Fitur Utama

- **Ringkasan Metrik (*Stat Cards*)**: Menampilkan total kegiatan, kegiatan yang telah selesai (dengan persentase progres), dan kegiatan yang sedang berjalan menggunakan kartu bergaris aksen warna.
- **Formulir Rencana Kegiatan**: Menambahkan rencana kegiatan baru dengan tanggal dan pilihan prioritas (*High, Medium, Low*).
- **Ceklis Status Selesai**: Menandai kegiatan yang sudah rampung dengan tombol ceklis (otomatis memberikan efek coret teks dan memperbarui status kalender).
- **Pembatalan / Hapus Kegiatan**: Menghapus agenda kegiatan yang batal dilaksanakan disertai dialog konfirmasi.
- **Kalender Visual Bulanan**: Grid kalender berbasis Matriks/Array 2D (Minggu × Hari) yang langsung menempelkan label kegiatan pada tanggal yang sesuai.
- **Kompatibel dengan Vercel**: Dilengkapi arsitektur *Serverless Function* sehingga dapat diakses secara publik melalui domain `https://*.vercel.app`.
