import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { parse } from 'csv-parse/sync';
const INPUT_CSV = process.env.INPUT_CSV || 'tmp/games_with_descriptions_html_fix3.csv';
const OUTPUT_CSV = process.env.OUTPUT_CSV || 'tmp/games_with_ai_summaries_preview_run4.csv';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const LIMIT = Number(process.env.LIMIT || 25);
const START_AT = Number(process.env.START_AT || 0);
const MAX_REPAIR_PASSES = Number(process.env.MAX_REPAIR_PASSES || 3);

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

const normalizeText = (text = '') => String(text).replace(/\s+/g, ' ').trim();

function parseBool(value) {
  if (value === true || value === false) return value;
  const s = String(value ?? '').toLowerCase().trim();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === '') return false;
  return Boolean(value);
}

function wordCount(text) {
  const t = normalizeText(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Count sentences split on . ! ? followed by space or end. Single clause without punctuation counts as 1. */
function sentenceCount(text) {
  const t = normalizeText(text);
  if (!t) return 0;
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length === 0 ? 0 : parts.length;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'to', 'of', 'in', 'on', 'at', 'with', 'as', 'by',
  'is', 'it', 'its', 'are', 'was', 'were', 'be', 'been', 'this', 'that', 'these', 'those',
]);

function contentTokens(text) {
  return normalizeText(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/** Heuristic: flag if many content words from short reappear in more (likely paraphrase repeat). */
function likelyRepeatsShort(short, more, overlapRatio = 0.35) {
  const shortSet = new Set(contentTokens(short));
  if (shortSet.size === 0) return false;
  const moreWords = contentTokens(more);
  if (moreWords.length === 0) return false;
  let hit = 0;
  for (const w of moreWords) {
    if (shortSet.has(w)) hit++;
  }
  return hit / moreWords.length >= overlapRatio;
}

function truncatePipeList(value, maxSegments = 4, maxChars = 220) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const parts = raw.split('|').map((p) => p.trim()).filter(Boolean).slice(0, maxSegments);
  let out = parts.join(' | ');
  if (out.length > maxChars) out = `${out.slice(0, maxChars).trim()}…`;
  return out;
}

function normalizeRecPlayers(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const normalizedParts = raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((part) => {
      if (/^\d+-\d+$/.test(part)) return part;
      if (/^\d+$/.test(part)) return String(Number(part));
      if (/^0+\d+$/.test(part)) return String(Number(part));
      return part;
    });

  if (normalizedParts.length === 0) return null;
  if (normalizedParts.length === 1) return normalizedParts[0];
  return normalizedParts.join(' or ');
}

function buildUserPayload(row) {
  const minP = row.min_players != null && String(row.min_players).trim() !== '' ? row.min_players : null;
  const maxP = row.max_players != null && String(row.max_players).trim() !== '' ? row.max_players : null;
  const playerRange =
    minP != null && maxP != null ? `${minP}-${maxP}` : minP != null ? `${minP}+` : maxP != null ? `up to ${maxP}` : null;
  const recRaw = row.rec_players != null && String(row.rec_players).trim() !== '' ? String(row.rec_players).trim() : null;
  const recNormalized = normalizeRecPlayers(recRaw);
  const bestRaw = row.best_players != null && String(row.best_players).trim() !== '' ? String(row.best_players).trim() : null;

  return {
    game_id: row.id,
    title: row.name,
    categories: truncatePipeList(row.boardgamecategory, 5, 280),
    mechanics: truncatePipeList(row.boardgamemechanic, 6, 320),
    theme_tags: truncatePipeList(row.boardgamefamily, 4, 200),
    theme_excerpt: stripHtmlish(row.description || '').slice(0, 1200),
    play_profile: {
      minutes: row.playing_time != null && row.playing_time !== '' ? Number(row.playing_time) : null,
      recommended_players_raw: recRaw,
      recommended_players_normalized: recNormalized,
      best_at_players: bestRaw,
      rec_players_display: recNormalized || bestRaw || playerRange || null,
      cooperative: parseBool(row.is_cooperative),
      team_based: parseBool(row.is_teambased),
      player_range: playerRange,
    },
  };
}

function buildSystemPrompt() {
  return [
    `## Role
You write concise mobile board-game blurbs for voters skimming a list.`,

    `## Output format
Return JSON only: {"summary_short":"...","summary_more":"..."}
Plain text only. No markdown, no emojis.`,

    `## summary_short
- Exactly one sentence.
- At most 15 words.
- Start with: Rec players: <value>.
- Use rec_players_display, which should prefer recommended_players_normalized. Example: raw "1-4,06" becomes "1-4 or 6".
- Then include cooperative/competitive posture and one core mechanic phrase.
- Do not include color or flavor-heavy wording.
- Do not repeat the game title unless necessary.`,

    `## summary_more
- Exactly one additional sentence.
- At most 25 words.
- Must add new information; do not repeat or paraphrase summary_short (no restating the same mechanism, player count, or genre line).
- Deemphasize flavor text; prioritize extra mechanics, play-time/team-based details, and optional high-level similarity cues from theme_tags/boardgamefamily.
- Optional comparison-style cue only if it adds clarity; avoid overusing openers such as "Think of"—vary phrasing; do not ban them entirely.`,

    `## What to emphasize (topics to look for)
- Game type and genre feel (categories).
- Core mechanism and what players do (mechanics).
- Who it fits: recommended player count from rec_players first, then co-op vs competitive, team play, and typical play time.
- For summary_more, focus on practical play detail over setting/theme.`,

    `## What to use lightly
- Theme tags—vibe only, not a tag dump.
- Long description excerpt—use sparingly; do not let flavor dominate output.`,

    `## Exemptions (do not put in blurbs)
- Turn-by-turn rules, action lists, scoring detail.
- Publisher or marketing filler, crowdfunding or digital-app mentions.
- Verbatim pipe-separated tag strings; synthesize instead.
- Image URLs, ranks, or internal IDs.`,
  ].join('\n\n');
}

function validateSummaries(summaryShort, summaryMore) {
  const issues = [];
  const shortWords = wordCount(summaryShort);
  const moreWords = wordCount(summaryMore);
  const shortSent = sentenceCount(summaryShort);
  const moreSent = sentenceCount(summaryMore);

  if (!summaryShort) issues.push('summary_short is empty');
  if (!summaryMore) issues.push('summary_more is empty');
  if (shortSent !== 1) issues.push(`summary_short must be exactly 1 sentence (found ${shortSent})`);
  if (moreSent !== 1) issues.push(`summary_more must be exactly 1 sentence (found ${moreSent})`);
  if (!/^rec players:\s*/i.test(summaryShort)) {
    issues.push('summary_short must start with "Rec players: <value>"');
  }

  const shortTight = summaryShort.length > 120;
  const moreTight = summaryMore.length > 150;

  const shortMaxWords = shortTight ? 12 : 15;
  const moreMaxWords = moreTight ? 20 : 25;

  if (shortWords > shortMaxWords) {
    issues.push(
      shortTight
        ? `summary_short has ${shortWords} words; because length >120 chars, use at most 12 words`
        : `summary_short has ${shortWords} words; use at most 15 words`,
    );
  }
  if (moreWords > moreMaxWords) {
    issues.push(
      moreTight
        ? `summary_more has ${moreWords} words; because length >150 chars, use at most 20 words`
        : `summary_more has ${moreWords} words; use at most 25 words`,
    );
  }

  if (likelyRepeatsShort(summaryShort, summaryMore)) {
    issues.push('summary_more likely repeats ideas from summary_short; rewrite more with only new angles');
  }

  return { valid: issues.length === 0, issues, shortMaxWords, moreMaxWords, shortWords, moreWords, shortSent, moreSent };
}

async function callOpenAIJson({ system, user }) {
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
  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    return { parsed: {}, raw };
  }
}

async function repairSummaries({ summaryShort, summaryMore, issues, payload }) {
  const repairUser = JSON.stringify(
    {
      issues,
      current: { summary_short: summaryShort, summary_more: summaryMore },
      game_context: payload,
      rewrite_rules: {
        summary_short:
          'Exactly one sentence. Must start with "Rec players: <value>". Then include cooperative/competitive and one core mechanic. Respect word cap from issues. No hard truncation by you—end on a complete clause.',
        summary_more:
          'Exactly one new sentence. Must not repeat or paraphrase summary_short. Deemphasize flavor text and prioritize extra mechanics + play-time/team details + optional similarity cue. Respect word cap from issues. End on a complete clause.',
      },
    },
    null,
    2,
  );

  const repairSystem = [
    `## Role
You fix board-game blurbs to satisfy strict structure and length rules.`,

    `## Output format
Return JSON only: {"summary_short":"...","summary_more":"..."}
Plain text only. No markdown, no emojis.`,

    `## Rules
- Apply every issue listed in the user message until resolved.
- Do not truncate mid-word or mid-thought; shorten by removing phrases, not by cutting off text.
- Avoid repetitive sentence starts (e.g. overusing "Think of"); vary phrasing; do not ban "Think of" entirely.`,
  ].join('\n\n');

  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: repairSystem },
      { role: 'user', content: repairUser },
    ],
    response_format: { type: 'json_object' },
  });
  const raw = res.choices?.[0]?.message?.content || '{}';
  try {
    return { parsed: JSON.parse(raw), raw };
  } catch {
    return { parsed: {}, raw };
  }
}

async function generateSummaries(row) {
  const payload = buildUserPayload(row);
  const system = buildSystemPrompt();
  const user = `Game data:\n${JSON.stringify(payload, null, 2)}`;

  const initial = await callOpenAIJson({ system, user });
  let summaryShort = normalizeText(initial.parsed.summary_short || '');
  let summaryMore = normalizeText(initial.parsed.summary_more || '');
  const rawInitial = initial.raw;

  let repairPasses = 0;
  let lastRepairRaw = '';

  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass++) {
    const v = validateSummaries(summaryShort, summaryMore);
    if (v.valid) break;

    repairPasses++;
    const { parsed, raw } = await repairSummaries({
      summaryShort,
      summaryMore,
      issues: v.issues,
      payload,
    });
    lastRepairRaw = raw;
    summaryShort = normalizeText(parsed.summary_short || summaryShort);
    summaryMore = normalizeText(parsed.summary_more || summaryMore);
  }

  const finalV = validateSummaries(summaryShort, summaryMore);

  return {
    summary_short: summaryShort,
    summary_more: summaryMore,
    raw_response: rawInitial,
    repair_raw_last: lastRepairRaw,
    repair_passes: repairPasses,
    short_words: finalV.shortWords,
    more_words: finalV.moreWords,
    short_sentences: finalV.shortSent,
    more_sentences: finalV.moreSent,
    validation_ok: finalV.valid,
    validation_issues: finalV.issues.join(' | '),
  };
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
      const result = await generateSummaries(row);
      out.push({
        id: row.id,
        name: row.name,
        summary_short: result.summary_short,
        summary_more: result.summary_more,
        short_len: result.summary_short.length,
        more_len: result.summary_more.length,
        short_words: result.short_words,
        more_words: result.more_words,
        short_sentences: result.short_sentences,
        more_sentences: result.more_sentences,
        repair_passes: result.repair_passes,
        validation_ok: result.validation_ok,
        validation_issues: result.validation_issues,
        raw_response: result.raw_response,
        repair_raw_last: result.repair_raw_last,
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
        short_words: 0,
        more_words: 0,
        short_sentences: 0,
        more_sentences: 0,
        repair_passes: 0,
        validation_ok: false,
        validation_issues: '',
        raw_response: `ERROR: ${err.message}`,
        repair_raw_last: '',
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
    'short_words',
    'more_words',
    'short_sentences',
    'more_sentences',
    'repair_passes',
    'validation_ok',
    'validation_issues',
    'raw_response',
    'repair_raw_last',
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
        escapeCsv(r.short_words),
        escapeCsv(r.more_words),
        escapeCsv(r.short_sentences),
        escapeCsv(r.more_sentences),
        escapeCsv(r.repair_passes),
        escapeCsv(r.validation_ok),
        escapeCsv(r.validation_issues),
        escapeCsv(r.raw_response),
        escapeCsv(r.repair_raw_last),
      ].join(','),
    ),
  ];
  await fs.writeFile(absoluteOutput, `${lines.join('\n')}\n`, 'utf8');
  console.log(`Done. Wrote preview CSV: ${absoluteOutput}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
