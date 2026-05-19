import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { parse } from 'csv-parse/sync';
const INPUT_CSV = process.env.INPUT_CSV || 'tmp/games_with_descriptions_html_fix2.csv';
const OUTPUT_CSV = process.env.OUTPUT_CSV || 'tmp/games_with_ai_summaries_preview_run2.csv';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LIMIT = Number(process.env.LIMIT || 25); // test small first
const START_AT = Number(process.env.START_AT || 0);
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OPENAI_API_KEY');
}
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const escapeCsv = (value = '') => `"${String(value).replaceAll('"', '""')}"`;
const stripHtmlish = (text = '') =>
  String(text)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const normalizeText = (text = '') =>
  String(text).replace(/\s+/g, ' ').trim();
const clipAtWord = (text = '', max = 100) => {
  const t = normalizeText(text);
  if (t.length <= max) return t;
  const sliced = t.slice(0, max + 1);
  const lastSpace = sliced.lastIndexOf(' ');
  if (lastSpace > Math.floor(max * 0.6)) return sliced.slice(0, lastSpace).trimEnd();
  return t.slice(0, max).trimEnd();
};
const withinRange = (text, min, max) => {
  const t = normalizeText(text);
  return t.length >= min && t.length <= max;
};
function buildUserPayload(row) {
  return {
    id: row.id,
    name: row.name,
    playing_time: row.playing_time,
    is_cooperative: row.is_cooperative,
    is_teambased: row.is_teambased,
    rec_players: row.rec_players,
    boardgamecategory: row.boardgamecategory,
    boardgamemechanic: row.boardgamemechanic,
    boardgamefamily: row.boardgamefamily,
    description: stripHtmlish(row.description || '').slice(0, 3000),
  };
}
async function generateSummaries(row) {
  const payload = buildUserPayload(row);
  const system = [
    'You write concise mobile board-game blurbs.',
    'Return JSON only with keys: summary_short, summary_more.',
    'summary_short must be 85-100 chars.',
    'summary_more must be 70-100 chars.',
    'Plain text only. No markdown, no emojis.',
    'Avoid overusing comparison openers such as "Think of"; use varied phrasing.',
    'Use comparison-style cues sparingly and only when they add clarity.',
    'summary_short: game type + core mechanism + clear player-facing feel.',
    'summary_more: extra flavor/context and optional comparison cue only if helpful.',
    'Avoid repeating the game title unless necessary.',
  ].join(' ');
  const user = `Game data:\n${JSON.stringify(payload, null, 2)}`;
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
  });
  const raw = res.choices?.[0]?.message?.content || '{}';
  let parsed = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  let summary_short = normalizeText(parsed.summary_short || '');
  let summary_more = normalizeText(parsed.summary_more || '');
  const needsRepair =
    !withinRange(summary_short, 85, 100) ||
    !withinRange(summary_more, 70, 100);
  if (needsRepair) {
    const repairPrompt = {
      summary_short,
      summary_more,
      rules: {
        summary_short: '85-100 chars',
        summary_more: '70-100 chars',
        reduce_phrase_start: 'Think of',
        plain_text_only: true,
      },
    };
    const repairRes = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'Rewrite blurbs to satisfy strict length and style constraints. Avoid repetitive sentence starts (especially repeated "Think of"), but do not ban them entirely. Return JSON only: {"summary_short":"...","summary_more":"..."}',
        },
        { role: 'user', content: JSON.stringify(repairPrompt) },
      ],
      response_format: { type: 'json_object' },
    });
    try {
      const repaired = JSON.parse(repairRes.choices?.[0]?.message?.content || '{}');
      summary_short = normalizeText(repaired.summary_short || summary_short);
      summary_more = normalizeText(repaired.summary_more || summary_more);
    } catch {
      // Keep originals if repair parse fails.
    }
  }
  summary_short = clipAtWord(summary_short, 100);
  summary_more = clipAtWord(summary_more, 100);
  return { summary_short, summary_more, raw_response: raw };
}
async function main() {
  const absoluteInput = path.resolve(INPUT_CSV);
  const absoluteOutput = path.resolve(OUTPUT_CSV);
  const file = await fs.readFile(absoluteInput, 'utf8');
  const rows = parse(file, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
  });
  const slice = rows.slice(START_AT, START_AT + LIMIT);
  console.log(`Loaded ${rows.length} rows. Processing ${slice.length} rows...`);
  const out = [];
  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    try {
      const { summary_short, summary_more, raw_response } = await generateSummaries(row);
      out.push({
        id: row.id,
        name: row.name,
        summary_short,
        summary_more,
        short_len: summary_short.length,
        more_len: summary_more.length,
        raw_response,
      });
      console.log(`[${i + 1}/${slice.length}] OK: ${row.name}`);
    } catch (err) {
      out.push({
        id: row.id,
        name: row.name,
        summary_short: '',
        summary_more: '',
        short_len: 0,
        more_len: 0,
        raw_response: `ERROR: ${err.message}`,
      });
      console.log(`[${i + 1}/${slice.length}] FAIL: ${row.name} -> ${err.message}`);
    }
  }
  const header = [
    'id',
    'name',
    'summary_short',
    'summary_more',
    'short_len',
    'more_len',
    'raw_response',
  ];
  const lines = [
    header.join(','),
    ...out.map((r) =>
      [
        escapeCsv(r.id),
        escapeCsv(r.name),
        escapeCsv(r.summary_short),
        escapeCsv(r.summary_more),
        escapeCsv(r.short_len),
        escapeCsv(r.more_len),
        escapeCsv(r.raw_response),
      ].join(',')
    ),
  ];
  await fs.writeFile(absoluteOutput, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Done. Wrote preview CSV: ${absoluteOutput}`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});