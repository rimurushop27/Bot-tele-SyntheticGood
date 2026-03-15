# SyntheticGood Bot v4

Versi yang dibangun ulang agar lebih rapi, mudah dirawat, dan lebih aman dipakai untuk gonta-ganti system instruction.

## Fitur utama

### User
- Kirim foto
- Pilih bahasa: Indonesia / English
- Pilih mode: PROMPT / CAPTION
- Bot memproses gambar memakai:
  - Core system instruction
  - Sistem instruction aktif sesuai mode

### Admin
Saat admin dengan Telegram user id yang sesuai mengirim `/admin`, akan muncul menu:
- API Key
- SI PROMPT
- SI CAPTION
- Status

## Struktur penyimpanan

Semua data runtime disimpan di `bot_data.json`:
- API key
- Daftar profile SI PROMPT
- Daftar profile SI CAPTION
- Profile aktif untuk PROMPT
- Profile aktif untuk CAPTION

## Cara kerja sistem instruction

Setiap request selalu digabung seperti ini:

- Core system instruction
- Active custom system instruction

Jadi sistem utama tetap menjadi petunjuk inti, lalu profile aktif menjadi tambahan instruksi khusus.

## Perintah penting

### Admin
- `/admin` → buka panel admin
- `/cancel` → batalkan input admin yang sedang berjalan
- `/myid` → cek Telegram user id

### User
- `/start` → mulai
- kirim foto → pilih bahasa → pilih mode

## Manajemen profile

Admin bisa:
- menambah beberapa SI PROMPT
- menambah beberapa SI CAPTION
- melihat detail profile
- mengganti profile aktif kapan saja
- menghapus profile tambahan

Profile default tidak bisa dihapus agar sistem tetap punya fallback.

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
7. Tambah atau pilih SI PROMPT dan SI CAPTION yang ingin aktif
