# SyntheticGood Bot v5

Versi rebuild dengan alur yang lebih simpel:
- user cukup kirim foto
- bot langsung jalan otomatis
- mode proses diatur dari panel admin
- system instruction bisa ditambah lewat teks biasa atau file `.txt`

## Perubahan utama

### User
- Kirim foto
- Bot langsung memproses otomatis
- Tidak ada lagi pilihan bahasa
- Tidak ada lagi pilihan mode dari sisi user

### Admin
Saat admin dengan Telegram user id yang sesuai mengirim `/admin`, akan muncul menu:
- Fitur proses user
- API Key
- SI PROMPT
- SI CAPTION
- Status

## Mode proses user

Admin bisa memilih salah satu mode berikut:
- `PROMPT saja`
- `CAPTION saja`
- `PROMPT + CAPTION`
- `Nonaktif`

Jadi logikanya sekarang sepenuhnya dikontrol dari admin. User tinggal kirim foto dan bot langsung menjalankan mode yang sedang aktif.

## System instruction via `.txt`

Saat menambah profile SI:
1. Admin pilih tambah profile
2. Admin kirim nama profile
3. Admin bisa lanjut dengan:
   - kirim isi instruction langsung sebagai teks, atau
   - upload file `.txt`

Bot akan membaca isi `.txt`, lalu menyimpannya sebagai isi system instruction.

Catatan:
- bot tidak menyimpan file `.txt` sebagai logika terpisah
- bot tidak menggabungkan gambar + file `.txt` saat inference
- yang disimpan hanya isi teks hasil pembacaan file `.txt`

## Struktur penyimpanan

Semua data runtime disimpan di `bot_data.json`:
- API key
- mode proses user
- daftar profile SI PROMPT
- daftar profile SI CAPTION
- profile aktif untuk PROMPT
- profile aktif untuk CAPTION

## Cara kerja system instruction

Setiap request selalu digabung seperti ini:
- Core system instruction
- Active custom system instruction

## Perintah penting

### Admin
- `/admin` → buka panel admin
- `/cancel` → batalkan input admin yang sedang berjalan
- `/myid` → cek Telegram user id

### User
- `/start` → mulai
- kirim foto → bot langsung proses

## File

- `index.js` → bot utama
- `config.js` → token, owner id, core instruction, default profile
- `storage.js` → load/save data JSON yang lebih aman
- `bot_data.json` → otomatis dibuat

## Deploy

1. Upload project ke Railway / VPS / server Node.js
2. Jalankan `npm install`
3. Jalankan `npm start`
4. Buka bot di Telegram
5. Sebagai admin, kirim `/admin`
6. Set API key
7. Pilih mode proses user
8. Tambah atau pilih SI PROMPT dan/atau SI CAPTION yang ingin aktif
