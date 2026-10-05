import { PrismaClient } from '../../../generated/prisma/client';

const prisma = globalThis.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;

export async function GET() {
  const documents = await prisma.document.findMany({ orderBy: { updatedAt: 'desc' } });
  return Response.json(documents);
}

export async function POST(request) {
  const body = await request.json();
  if (!body?.source) return Response.json({ error: 'source wajib diisi' }, { status: 400 });
  const title = body.title || 'Untitled RipiDoc';
  const document = await prisma.document.create({ data: { title, source: body.source, settings: body.settings ? JSON.stringify(body.settings) : null } });
  return Response.json(document, { status: 201 });
}
