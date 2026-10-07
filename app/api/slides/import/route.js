import { assetsForDeck, parsePresentationXml, slideRules, validateDeck } from '../../../../lib/slides';

export const runtime = 'nodejs';

const string = { type: 'string' };
const card = { type: 'object', additionalProperties: false, required: ['title', 'body'], properties: { title: string, body: string } };
const column = { type: 'object', additionalProperties: false, required: ['title', 'body', 'points'], properties: { title: string, body: string, points: { type: 'array', items: string } } };
const slide = {
  type: 'object', additionalProperties: false,
  required: ['type', 'asset', 'kicker', 'number', 'title', 'subtitle', 'body', 'context', 'quote', 'cards', 'items', 'steps', 'columns', 'insights', 'table'],
  properties: {
    type: { type: 'string', enum: Object.keys(slideRules) }, asset: string, kicker: string, number: string, title: string, subtitle: string, body: string, context: string, quote: string,
    cards: { type: 'array', items: card }, items: { type: 'array', items: card }, steps: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'body'], properties: { label: string, body: string } } }, columns: { type: 'array', items: column }, insights: { type: 'array', items: card },
    table: { type: 'object', additionalProperties: false, required: ['head', 'rows'], properties: { head: { type: 'array', items: string }, rows: { type: 'array', items: { type: 'array', items: string } } } },
  },
};

const deckSchema = {
  type: 'object', additionalProperties: false, required: ['meta', 'slides'],
  properties: { meta: { type: 'object', additionalProperties: false, required: ['title', 'course', 'author'], properties: { title: string, course: string, author: string } }, slides: { type: 'array', items: slide } },
};

function responseText(response) {
  for (const item of response.output || []) for (const content of item.content || []) if (content.type === 'output_text') return content.text;
  return '';
}

async function summarize(deck, overages) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY belum diatur. XML sudah sesuai dapat tetap diimpor; untuk ringkasan otomatis, tambahkan kunci API di .env.');
  const prompt = [
    'Ringkas hanya field yang melebihi batas, tanpa mengubah jumlah slide, jenis slide, makna inti, nama aset, atau struktur XML asal.',
    'Gunakan bahasa sumber. Patuhi setiap batas karakter dan jumlah item pada aturan berikut:',
    JSON.stringify(slideRules),
    'Bagian yang perlu diperbaiki:', JSON.stringify(overages),
    'Deck sumber:', JSON.stringify(deck),
  ].join('\n');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_SLIDES_MODEL || 'gpt-5-mini',
      input: [{ role: 'system', content: [{ type: 'input_text', text: 'You are a precise Indonesian presentation editor. Return only a deck that conforms to the supplied JSON schema.' }] }, { role: 'user', content: [{ type: 'input_text', text: prompt }] }],
      text: { format: { type: 'json_schema', name: 'standard_slide_deck', strict: true, schema: deckSchema } },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI tidak dapat merangkum konten (${response.status}).`);
  const output = responseText(await response.json());
  if (!output) throw new Error('OpenAI tidak mengembalikan deck terstruktur.');
  return JSON.parse(output);
}

export async function POST(request) {
  try {
    const { source } = await request.json();
    if (!source?.trim()) return Response.json({ error: 'XML presentasi wajib diisi.' }, { status: 400 });
    const deck = parsePresentationXml(source);
    const initial = validateDeck(deck);
    if (initial.structural.length) return Response.json({ error: 'Struktur slide belum memenuhi aturan.', warnings: initial.warnings, structural: initial.structural }, { status: 422 });
    if (!initial.overages.length) return Response.json({ deck: assetsForDeck(deck), adjustments: [], warnings: initial.warnings });
    const summarized = await summarize(deck, initial.overages);
    const final = validateDeck(summarized);
    if (final.overages.length || final.structural.length) return Response.json({ error: 'Hasil ringkasan belum memenuhi aturan slide.', warnings: [...initial.warnings, ...final.warnings], adjustments: initial.overages, structural: final.structural }, { status: 422 });
    return Response.json({ deck: assetsForDeck(summarized), adjustments: initial.overages.map((item) => `${item.path} diringkas agar memenuhi batas ${item.limit}.`), warnings: [...initial.warnings, ...final.warnings] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal mengimpor XML presentasi.';
    const status = /OPENAI_API_KEY|OpenAI/.test(message) ? 503 : 400;
    return Response.json({ error: message }, { status });
  }
}
