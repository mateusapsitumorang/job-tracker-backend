# Job Tracker - Backend

REST API untuk aplikasi pelacak lamaran kerja (job application tracker). Dibangun dengan Express.js dan Prisma ORM di atas PostgreSQL, dengan autentikasi berbasis JWT (access + refresh token).

Frontend terkait: [job-tracker-frontend](https://github.com/mateusapsitumorang/job-tracker-frontend)

## Fitur

- Registrasi & login dengan email/password (hash via bcrypt)
- Autentikasi JWT dengan access token (short-lived) dan refresh token (disimpan di database, rotasi otomatis)
- Lupa password & reset password via email (Nodemailer)
- CRUD data lamaran kerja (company, posisi, status, tanggal melamar, tanggal interview, catatan, sumber lowongan)
- Activity log per lamaran
- Ringkasan/statistik dashboard (`/api/applications/summary`)
- Rate limiting pada endpoint login & register
- Proteksi header HTTP dengan Helmet, serta validasi input dengan express-validator

## Tech Stack

| Layer          | Teknologi                          |
|----------------|-------------------------------------|
| Runtime        | Node.js (ES Modules)                |
| Framework      | Express.js                          |
| Database       | PostgreSQL (mis. Supabase)          |
| ORM            | Prisma                              |
| Auth           | JSON Web Token (`jsonwebtoken`), `bcryptjs` |
| Email          | Nodemailer                          |
| Keamanan       | Helmet, express-rate-limit, cookie-parser, cors |
| Deployment     | Vercel                              |

## Struktur Proyek

```
job-tracker-backend/
├── auth/
│   └── forgot-password.js       # Serverless function (Vercel) untuk lupa password
├── prisma/
│   ├── schema.prisma            # Skema database (User, Application, RefreshToken, ActivityLog)
│   └── migrations/              # Riwayat migrasi database
├── src/
│   ├── config/                  # Konfigurasi (mis. Prisma client, env)
│   ├── controllers/
│   │   ├── authController.js
│   │   └── applicationController.js
│   ├── middleware/
│   │   ├── auth.js              # Verifikasi JWT (requireAuth)
│   │   └── validate.js          # Penanganan hasil validasi express-validator
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── applicationRoutes.js
│   ├── utils/                   # Helper JWT, dsb.
│   └── index.js                 # Entry point Express app
├── supabase.js                  # Konfigurasi koneksi Supabase
├── vercel.json                  # Konfigurasi deployment Vercel
└── package.json
```

## Model Data (Prisma)

- **User** - akun pengguna, menyimpan `passwordHash`, relasi ke `applications` dan `refreshTokens`, serta field reset password.
- **RefreshToken** - token refresh yang tersimpan di DB untuk mendukung revoke/rotasi.
- **Application** - data lamaran kerja: `companyName`, `position`, `status` (enum), `appliedDate`, `interviewDate`, `notes`, `source`.
- **ActivityLog** - riwayat aktivitas/perubahan pada sebuah `Application`.

Status lamaran (`ApplicationStatus`) mendukung: `WISHLIST`, `APPLIED`, `WAITING_REVIEW`, `ASSESSMENT`, `INTERVIEW_HR`, `INTERVIEW_USER`, `INTERVIEW_FINAL`, `OFFER`, `REJECTED`, `ACCEPTED`, `WITHDRAWN`.

## Instalasi & Menjalankan Secara Lokal

### Prasyarat
- Node.js 18+
- Database PostgreSQL (lokal atau layanan seperti Supabase/Neon)

### Langkah-langkah

1. Clone repository dan masuk ke folder proyek:
   ```bash
   git clone https://github.com/mateusapsitumorang/job-tracker-backend.git
   cd job-tracker-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Buat file `.env` di root proyek (lihat bagian [Environment Variables](#environment-variables) di bawah).

4. Generate Prisma client dan jalankan migrasi:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

5. Jalankan server dalam mode development (dengan nodemon):
   ```bash
   npm run dev
   ```

   Server berjalan secara default di `http://localhost:4000`.

### Mode Produksi

```bash
npm start
```

## Environment Variables

Buat file `.env` dengan variabel berikut:

```env
# Database (Prisma)
DATABASE_URL=postgresql://user:password@host:5432/dbname
DIRECT_URL=postgresql://user:password@host:5432/dbname

# Server
PORT=4000
CLIENT_URL=http://localhost:5173

# JWT
JWT_ACCESS_SECRET=ganti_dengan_secret_acak
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES_DAYS=30

# Email (Nodemailer) — untuk fitur lupa password
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=

# Supabase (opsional, jika digunakan sebagai provider database/storage)
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

> Sesuaikan nama variabel email/Supabase dengan implementasi pada `supabase.js` dan `src/utils/` sesuai kebutuhan environment masing-masing.

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint                  | Deskripsi                              | Auth |
|--------|----------------------------|-----------------------------------------|------|
| POST   | `/api/auth/register`       | Registrasi pengguna baru                | ❌ |
| POST   | `/api/auth/login`          | Login, mengembalikan access token       | ❌ |
| POST   | `/api/auth/refresh`        | Refresh access token via refresh token  | ❌ (cookie) |
| POST   | `/api/auth/logout`         | Logout dan invalidasi refresh token     | ❌ |
| GET    | `/api/auth/me`             | Mendapatkan data pengguna saat ini      |  ✔ |
| POST   | `/api/auth/forgot-password`| Mengirim email reset password           | ❌ |
| POST   | `/api/auth/reset-password` | Reset password dengan token             | ❌ |

### Applications (`/api/applications`)

Semua endpoint berikut memerlukan autentikasi (`requireAuth`).

| Method | Endpoint                     | Deskripsi                              |
|--------|-------------------------------|------------------------------------------|
| GET    | `/api/applications/summary`   | Ringkasan/statistik untuk dashboard      |
| GET    | `/api/applications`           | Daftar semua lamaran milik pengguna      |
| POST   | `/api/applications`           | Membuat lamaran baru                     |
| GET    | `/api/applications/:id`       | Detail satu lamaran                      |
| PUT    | `/api/applications/:id`       | Update penuh data lamaran                |
| PATCH  | `/api/applications/:id`       | Update sebagian data lamaran             |
| DELETE | `/api/applications/:id`       | Hapus lamaran                            |

### Health Check

| Method | Endpoint        | Deskripsi          |
|--------|------------------|---------------------|
| GET    | `/api/health`    | Status server (`{ status: 'ok' }`) |

## Keamanan

- Password di-hash menggunakan `bcryptjs`.
- Access token JWT bersifat short-lived; refresh token disimpan di database dan dikirim via HTTP-only cookie.
- Helmet digunakan untuk mengatur HTTP header keamanan.
- Rate limiting diterapkan khusus pada endpoint `login` dan `register` untuk mencegah brute-force.
- CORS dikonfigurasi untuk hanya mengizinkan origin sesuai `CLIENT_URL`.

## Deployment

Proyek ini dikonfigurasi untuk deploy ke **Vercel** (lihat `vercel.json`). Script `vercel-build` akan menjalankan `prisma generate` secara otomatis saat build. Pastikan environment variables di atas sudah diatur pada dashboard Vercel sebelum deploy.

# Lisensi

Copyright (c) 2026 Mateus Appuwan Situmorang

Seluruh hak cipta atas proyek ini dimiliki oleh Mateus Appuwan Situmorang.

Proyek ini dibuat untuk keperluan pembelajaran dan portofolio pribadi. Anda diperbolehkan melihat, mempelajari, dan menggunakan kode sebagai referensi untuk tujuan pendidikan.

Tanpa izin tertulis dari pemilik hak cipta, Anda tidak diperbolehkan:

* Menyalin dan mendistribusikan proyek ini secara utuh maupun sebagian untuk tujuan komersial.
* Mengklaim proyek ini sebagai karya sendiri.
* Menjual kembali atau menggunakan proyek ini sebagai bagian dari produk komersial.

Apabila Anda ingin menggunakan proyek ini untuk tujuan di luar pembelajaran atau portofolio, silakan meminta izin terlebih dahulu kepada pemilik hak cipta.

Dengan menggunakan proyek ini, Anda dianggap memahami dan menyetujui ketentuan lisensi ini.
