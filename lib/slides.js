export const slideRules = {
  cover: { kicker: 42, title: 72, subtitle: 150 },
  chapter: { number: 8, title: 64, subtitle: 140 },
  statement: { title: 130, body: 180 },
  cards: { title: 96, cardCount: [3, 4], cardTitle: 32, cardBody: 100 },
  framework: { title: 96, itemCount: [3, 6], itemTitle: 24, itemBody: 70, body: 130 },
  process: { title: 96, stepCount: [4, 6], stepLabel: 22, stepBody: 70 },
  comparison: { title: 96, columnCount: [2, 3], columnTitle: 32, columnBody: 110, pointCount: 3 },
  case: { title: 80, context: 180, cardCount: [3, 3], cardTitle: 32, cardBody: 100 },
  table: { title: 96, columnCount: [2, 3], rowCount: [3, 6], head: 20, cell: 45 },
  closing: { insightCount: [3, 3], insightTitle: 36, insightBody: 90, quote: 140 },
};

const supportedTypes = new Set(Object.keys(slideRules));
const supportedAssets = new Set(['udang-batik', 'ikan-biru-melengkung', 'ikan-biru-panjang']);

function decodeXml(value = '') {
  return value.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseAttributes(input = '') {
  const attributes = {};
  for (const match of input.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) attributes[match[1]] = decodeXml(match[3]);
  return attributes;
}

function parseXmlTree(source) {
  const text = String(source || '').replace(/^\s*<\?xml[^>]*\?>/i, '').replace(/<!--[\s\S]*?-->/g, '');
  const tokens = text.match(/<[^>]+>|[^<]+/g) || [];
  const root = { name: '#root', attributes: {}, children: [], text: '' };
  const stack = [root];
  for (const token of tokens) {
    if (!token.startsWith('<')) {
      stack.at(-1).text += decodeXml(token);
      continue;
    }
    if (/^<\//.test(token)) {
      const name = token.slice(2, -1).trim();
      if (stack.length === 1 || stack.at(-1).name !== name) throw new Error(`Tag penutup </${name}> tidak sesuai.`);
      stack.pop();
      continue;
    }
    if (/^<!/.test(token)) continue;
    const selfClosing = /\/>$/.test(token);
    const inner = token.slice(1, selfClosing ? -2 : -1).trim();
    const space = inner.search(/\s/);
    const name = space < 0 ? inner : inner.slice(0, space);
    if (!/^[\w:-]+$/.test(name)) throw new Error('Nama tag XML tidak valid.');
    const node = { name, attributes: parseAttributes(space < 0 ? '' : inner.slice(space + 1)), children: [], text: '' };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`Tag <${stack.at(-1).name}> belum ditutup.`);
  if (root.children.length !== 1) throw new Error('XML harus memiliki satu root element.');
  return root.children[0];
}

const direct = (node, name) => node.children.filter((child) => child.name === name);
const one = (node, name) => direct(node, name)[0];
const textOf = (node, name, fallback = '') => (one(node, name)?.text || fallback).replace(/\s+/g, ' ').trim();
const listOf = (node, container, item, fields) => direct(one(node, container) || { children: [] }, item).map((child) => Object.fromEntries(fields.map((field) => [field, textOf(child, field)])));

function parseSlide(node) {
  const type = node.attributes.type;
  if (!supportedTypes.has(type)) throw new Error(`Jenis slide "${type || 'kosong'}" tidak didukung.`);
  const slide = {
    type,
    asset: node.attributes.asset || '',
    kicker: textOf(node, 'kicker'),
    number: textOf(node, 'number'),
    title: textOf(node, 'title'),
    subtitle: textOf(node, 'subtitle'),
    body: textOf(node, 'body'),
    context: textOf(node, 'context'),
    quote: textOf(node, 'quote'),
    cards: listOf(node, 'cards', 'card', ['title', 'body']),
    items: listOf(node, 'items', 'item', ['title', 'body']),
    steps: listOf(node, 'steps', 'step', ['label', 'body']),
    columns: direct(one(node, 'columns') || { children: [] }, 'column').map((column) => ({ title: textOf(column, 'title'), body: textOf(column, 'body'), points: direct(one(column, 'points') || { children: [] }, 'point').map((point) => point.text.replace(/\s+/g, ' ').trim()) })),
    insights: listOf(node, 'insights', 'insight', ['title', 'body']),
    table: { head: direct(one(one(node, 'table') || { children: [] }, 'head') || { children: [] }, 'cell').map((cell) => cell.text.replace(/\s+/g, ' ').trim()), rows: direct(one(one(node, 'table') || { children: [] }, 'body') || { children: [] }, 'row').map((row) => direct(row, 'cell').map((cell) => cell.text.replace(/\s+/g, ' ').trim())) },
  };
  return slide;
}

export function parsePresentationXml(source) {
  const root = parseXmlTree(source);
  if (root.name !== 'presentation') throw new Error('Root XML harus <presentation version="1">.');
  const slides = direct(one(root, 'slides') || { children: [] }, 'slide').map(parseSlide);
  if (!slides.length) throw new Error('Tambahkan minimal satu <slide>.');
  return { meta: { title: textOf(one(root, 'meta') || { children: [] }, 'title'), course: textOf(one(root, 'meta') || { children: [] }, 'course'), author: textOf(one(root, 'meta') || { children: [] }, 'author') }, slides };
}

const over = (value, limit, path, findings) => { if (String(value || '').length > limit) findings.push({ path, limit, value: String(value) }); };
const count = (value, range, path, findings) => { if (value.length < range[0] || value.length > range[1]) findings.push({ path, limit: `${range[0]}–${range[1]} item`, value: value.length }); };

export function validateDeck(deck) {
  const warnings = [];
  const overages = [];
  const structural = [];
  deck.slides.forEach((slide, index) => {
    const prefix = `Slide ${index + 1}`;
    const rule = slideRules[slide.type];
    if (slide.asset && !supportedAssets.has(slide.asset)) warnings.push(`${prefix}: aset "${slide.asset}" tidak dikenal dan tidak digunakan.`);
    for (const field of ['kicker', 'number', 'title', 'subtitle', 'body', 'context', 'quote']) if (rule[field]) over(slide[field], rule[field], `${prefix} · ${field}`, overages);
    if (rule.cardCount) count(slide.cards, rule.cardCount, `${prefix} · cards`, structural);
    if (rule.itemCount) count(slide.items, rule.itemCount, `${prefix} · items`, structural);
    if (rule.stepCount) count(slide.steps, rule.stepCount, `${prefix} · steps`, structural);
    if (rule.columnCount && slide.type !== 'table') count(slide.columns, rule.columnCount, `${prefix} · columns`, structural);
    if (rule.insightCount) count(slide.insights, rule.insightCount, `${prefix} · insights`, structural);
    if (rule.columnCount && slide.type === 'table') {
      count(slide.table.head, rule.columnCount, `${prefix} · table head`, structural);
      count(slide.table.rows, rule.rowCount, `${prefix} · table rows`, structural);
      slide.table.head.forEach((cell, cellIndex) => over(cell, rule.head, `${prefix} · header ${cellIndex + 1}`, overages));
      slide.table.rows.forEach((row, rowIndex) => row.forEach((cell, cellIndex) => over(cell, rule.cell, `${prefix} · row ${rowIndex + 1}, cell ${cellIndex + 1}`, overages)));
    }
    slide.cards.forEach((card, cardIndex) => { over(card.title, rule.cardTitle || 32, `${prefix} · card ${cardIndex + 1} title`, overages); over(card.body, rule.cardBody || 100, `${prefix} · card ${cardIndex + 1} body`, overages); });
    slide.items.forEach((item, itemIndex) => { over(item.title, rule.itemTitle || 24, `${prefix} · item ${itemIndex + 1} title`, overages); over(item.body, rule.itemBody || 70, `${prefix} · item ${itemIndex + 1} body`, overages); });
    slide.steps.forEach((step, stepIndex) => { over(step.label, rule.stepLabel || 22, `${prefix} · step ${stepIndex + 1} label`, overages); over(step.body, rule.stepBody || 70, `${prefix} · step ${stepIndex + 1} body`, overages); });
    slide.columns.forEach((column, columnIndex) => { over(column.title, rule.columnTitle || 32, `${prefix} · column ${columnIndex + 1} title`, overages); over(column.body, rule.columnBody || 110, `${prefix} · column ${columnIndex + 1} body`, overages); if (column.points.length > (rule.pointCount || 3)) structural.push({ path: `${prefix} · column ${columnIndex + 1} points`, limit: `${rule.pointCount || 3} item`, value: column.points.length }); });
    slide.insights.forEach((insight, insightIndex) => { over(insight.title, rule.insightTitle || 36, `${prefix} · insight ${insightIndex + 1} title`, overages); over(insight.body, rule.insightBody || 90, `${prefix} · insight ${insightIndex + 1} body`, overages); });
  });
  return { warnings, overages, structural };
}

export function assetsForDeck(deck) {
  return structuredClone({ ...deck, slides: deck.slides.map((slide) => ({ ...slide, asset: supportedAssets.has(slide.asset) ? slide.asset : '' })) });
}
