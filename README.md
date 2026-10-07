# Academic Paper Studio

Editor makalah akademik berbasis XML, dibangun dengan Next.js (JavaScript), Prisma ORM 7, dan SQLite. Aplikasi mempertahankan editor blok, preview A4, pengaturan tipografi, impor/ekspor XML, serta print ke PDF.

## Menjalankan aplikasi

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev -- -p 3006
```

Buka [http://localhost:3006](http://localhost:3006). Server aktif menggunakan port `3006`.

## Database SQLite

Prisma 7 menyimpan URL koneksi di [prisma7.config.ts](./prisma7.config.ts), sedangkan [prisma/schema.prisma](./prisma/schema.prisma) menyimpan model `Document`. Runtime menggunakan `@prisma/adapter-better-sqlite3` melalui [lib/prisma.js](./lib/prisma.js).

Tombol **Save to SQLite** pada studio mengirim source XML ke `POST /api/documents`. Untuk mengambil seluruh dokumen tersimpan, gunakan `GET /api/documents`.

## Template XML

Klik **Muat Contoh** di panel impor untuk memuat template resmi pada [public/template_makalah_import.xml](./public/template_makalah_import.xml).

## Catatan

Jangan commit `.env` atau file database lokal. Keduanya telah dikecualikan melalui `.gitignore`.
