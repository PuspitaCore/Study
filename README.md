# RipiDoc Studio

Next.js (JavaScript) wrapper for `ripidoc_multiview_v2.html` with Prisma 7 and SQLite persistence.

## Run

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

Open http://localhost:3000. The existing Save button stores the current source in SQLite through `/api/documents`.
