import fs from 'node:fs/promises';
import path from 'node:path';
import OpenAI from 'openai';
import { parse } from 'csv-parse/sync';

const INPUT_CSV = process.env.INPUT_CSV || 'tmp/games_with_descriptions_html_fix3.csv';
const OUTPUT_CSV = process.env.OUTPUT_CSV || 'tmp/games_with_ai_summaries_preview_tuned3.csv';
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

function prepareDescriptionText(text = '') {
  return String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const normalizeText = (text = '') => String(text).replace(/\s+/g, ' ').trim();

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wordCount(text) {
  const t = normalizeText(text);
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function splitSentences(text) {
  const t = normalizeText(text);
  if (!t) return [];
  return t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function sentenceCount(text) {
  return splitSentences(text).length;
}

function truncatePipeList(value, maxSegments = 4) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  return raw.split('|').map((p) => p.trim()).filter(Boolean).slice(0, maxSegments);
}

function parseMechanics(boardgamemechanic) {
  return truncatePipeList(boardgamemechanic, 12);
}

function rankMechanics(mechanics, description) {
  if (mechanics.length === 0) return [];
  const descLower = prepareDescriptionText(description).toLowerCase();
  const scored = mechanics.map((mechanic, idx) => {
    const escaped = mechanic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = descLower.match(new RegExp(escaped.toLowerCase(), 'g'));
    const freq = matches ? matches.length : 0;
    return { mechanic, score: freq + (mechanics.length - idx) * 0.001 };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.mechanic);
}

function actionLabelFromLine(body) {
  const cleaned = normalizeText(body);
  if (!cleaned) return null;
  const beforeDash = cleaned.split(/\s+-\s+/)[0];
  const words = beforeDash.split(/\s+/).slice(0, 5).join(' ');
  return words || null;
}

function extractNumberedListItems(description) {
  const prepared = prepareDescriptionText(description);
  const lines = prepared.split('\n').map((l) => l.trim()).filter(Boolean);
  const items = [];
  const numberedRe = /^\d+[\).]\s*(.+)$/i;

  for (const line of lines) {
    const match = line.match(numberedRe);
    if (!match) continue;
    const label = actionLabelFromLine(match[1]);
    if (label) items.push(label);
  }

  return items.slice(0, 6);
}

function extractBulletedOrIndentedActions(description) {
  const prepared = prepareDescriptionText(description);
  const lines = prepared.split('\n');
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^[•\-*]\s+/.test(trimmed)) {
      const label = actionLabelFromLine(trimmed.replace(/^[•\-*]\s+/, ''));
      if (label) items.push(label);
      continue;
    }

    const headerMatch = trimmed.match(/^([A-Z][A-Z\s]{1,24}):\s*(.+)$/);
    if (headerMatch) {
      const header = normalizeText(headerMatch[1]);
      if (header.length <= 24 && !/^(THE|AND|FOR)$/i.test(header)) {
        items.push(header);
      }
    }
  }

  return [...new Set(items)].slice(0, 6);
}

const WIN_SENTENCE_PATTERNS = [
  /\bto win(?: the game)?\b/i,
  /\bwin(?:s)? the game\b/i,
  /\bwin by\b/i,
  /\bmost\s+vps?\b/i,
  /\bvictory\s+points?\b/i,
  /\bwhoever\b.*\bwins?\b/i,
  /\bultimate\s+goal\b/i,
  /\bgoal\s+is\s+to\b/i,
  /\bfirst\s+to\b.*\bwins?\b/i,
  /\bplayer\s+with\s+the\s+most\b/i,
];

const FLAVOR_SKIP = /description from the publisher|kickstarter|board game arena/i;

function splitDescriptionSentences(text) {
  const prepared = prepareDescriptionText(text);
  return prepared
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => normalizeText(s))
    .filter((s) => s.length > 12);
}

function extractWinCondition(description) {
  const sentences = splitDescriptionSentences(description);
  for (const sentence of sentences) {
    if (FLAVOR_SKIP.test(sentence)) continue;
    if (WIN_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence))) {
      return sentence.length > 200 ? `${sentence.slice(0, 197)}...` : sentence;
    }
  }
  return null;
}

function extractPlayExcerpt(description, mechanics, maxSentences = 2) {
  if (mechanics.length === 0) return null;

  const sentences = splitDescriptionSentences(description);
  const scored = sentences
    .filter((s) => !FLAVOR_SKIP.test(s))
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      let score = 0;

      for (const mechanic of mechanics) {
        if (lower.includes(mechanic.toLowerCase())) score += 2;
      }

      if (/\b(you|players?|each turn|round|action)\b/i.test(sentence)) score += 1;
      if (WIN_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence))) score -= 1;

      return { sentence, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  return scored
    .slice(0, maxSentences)
    .map((x) => x.sentence)
    .join(' ');
}

function extractIdentityContext(description) {
  const sentences = splitDescriptionSentences(description)
    .filter((sentence) => !FLAVOR_SKIP.test(sentence))
    .filter((sentence) => !/^\d+[\).]/.test(sentence))
    .filter((sentence) => !WIN_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence)));

  if (sentences.length === 0) return null;
  return sentences.slice(0, 2).join(' ');
}

function buildSummaryContext(description, mechanicsAll, mechanicsPrimary) {
  const numbered = extractNumberedListItems(description);
  const bulleted = extractBulletedOrIndentedActions(description);
  const turnActions = [...new Set([...numbered, ...bulleted])].slice(0, 6);
  const winCondition = extractWinCondition(description);
  const identityContext = extractIdentityContext(description);

  let fallbackPlayLine = null;
  if (turnActions.length === 0 && !winCondition) {
    fallbackPlayLine = extractPlayExcerpt(description, mechanicsAll, 2);
  }

  const primarySet = new Set(mechanicsPrimary.map((m) => m.toLowerCase()));
  const extraMechanics = mechanicsAll.filter((m) => !primarySet.has(m.toLowerCase())).slice(0, 3);

  return {
    identity_context: identityContext,
    turn_actions: turnActions,
    win_condition: winCondition,
    extra_mechanics: extraMechanics,
    fallback_play_line: fallbackPlayLine,
  };
}

function buildUserPayload(row) {
  const description = row.description || '';
  const mechanicsAll = parseMechanics(row.boardgamemechanic);
  const mechanicsRanked = rankMechanics(mechanicsAll, description);
  const mechanicsPrimary = mechanicsRanked.slice(0, 2);
  const categories = truncatePipeList(row.boardgamecategory, 4);
  const themeTags = truncatePipeList(row.boardgamefamily, 4);

  return {
    game_id: row.id,
    title: row.name,
    categories,
    mechanics_primary: mechanicsPrimary,
    summary_context: buildSummaryContext(description, mechanicsAll, mechanicsPrimary),
    theme_tags: themeTags,
  };
}

function buildSystemPrompt() {
  return [
    `## Role
You are a board game summarizer. Write concise editorial capsule summaries based only on the provided BoardGameGeek-derived data.`,

    `## Output format
Return JSON only: {"summary_full":"..."}
Plain text only. No markdown, no emojis.`,

    `## Required structure
- Write one concise paragraph.
- Use second person where natural.
- Cover three ideas somewhere in the paragraph:
  1. who you are as a player, with light thematic identity or setting
  2. what you do during play, using concrete verbs and table actions
  3. how you win, stated clearly and specifically
- You may use 2 to 4 sentences if that reads more naturally than a rigid template.
- Do not repeat the game title unless it is truly needed for clarity.
- Prefer to stay under 50 words when possible, but do not sound clipped or incomplete.
- Prefer action language over mechanic labels. Do not say labels like "worker placement" or "deck-building" if you can describe the action instead.`,

    `## Evidence hierarchy
- Identity / role: summary_context.identity_context first, then categories, then theme_tags lightly.
- Play loop: summary_context.turn_actions first, then summary_context.fallback_play_line, then mechanics_primary as evidence.
- Win condition: summary_context.win_condition first. If absent, infer the clearest objective from the provided context.
- Use only the provided BGG-derived data. Do not use outside knowledge.`,

    `## Style rules
- Be concrete and specific.
- Avoid copying long phrases directly from the source description.
- Avoid publisher filler, lore-heavy flavor, and tag dumps.
- Natural variation is better than repetition; do not force every summary into the same sentence pattern.
- The cleanest summary usually does not need to repeat the game title.
- The paragraph should still make the win condition easy to identify, often with a phrase like "Win by".`,
  ].join('\n\n');
}

function hasSecondPerson(summaryFull) {
  return /\b(?:You're|You are|You\b)/i.test(summaryFull);
}

function summaryHasWinClause(summaryFull) {
  return /^\s*Win by\b/i.test(summaryFull) || WIN_SENTENCE_PATTERNS.some((pattern) => pattern.test(summaryFull));
}

function summaryRepeatsTitle(summaryFull, title) {
  const normalizedTitle = normalizeText(title);
  if (!normalizedTitle) return false;
  const pattern = new RegExp(`\\b${escapeRegExp(normalizedTitle)}\\b`, 'i');
  return pattern.test(summaryFull);
}

function validateSummary(summaryFull, payload) {
  const issues = [];
  const sentences = splitSentences(summaryFull);
  const totalWords = wordCount(summaryFull);

  if (!summaryFull) issues.push('summary_full is empty');
  if (sentences.length < 2 || sentences.length > 4) {
    issues.push(`summary_full should read as a concise paragraph using 2 to 4 sentences (found ${sentences.length})`);
  }
  if (!hasSecondPerson(summaryFull)) {
    issues.push('summary_full should use second-person voice somewhere in the paragraph');
  }

  if (summaryRepeatsTitle(summaryFull, payload.title)) {
    issues.push('summary_full should avoid repeating the game title unless absolutely necessary');
  }

  if (payload.summary_context?.identity_context && !/^\s*(You're|You are)\b/i.test(sentences[0] || '')) {
    issues.push('the paragraph should still open with a clear player identity or role');
  }

  if (payload.summary_context?.win_condition && !summaryHasWinClause(summaryFull)) {
    issues.push('the paragraph should clearly describe how you win');
  }

  if (totalWords > 50) {
    issues.push(`summary_full should ideally stay under 50 words (currently ${totalWords}) while preserving identity, play loop, and win condition`);
  }

  return {
    valid: issues.length === 0,
    issues,
    sentenceCount: sentences.length,
    wordCount: totalWords,
  };
}

async function callOpenAIJson({ system, user, temperature = 0.4 }) {
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature,
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

async function repairSummary({ summaryFull, issues, payload }) {
  const repairUser = JSON.stringify(
    {
      issues,
      current: { summary_full: summaryFull },
      game_context: payload,
      rewrite_rules: {
        summary_full:
          'Write one concise paragraph of 2 to 4 sentences. Make sure it covers who you are, what you do, and how you win. Prefer under 50 words when possible. Do not repeat the game title unless clarity requires it. Use vivid but concrete action language.',
      },
    },
    null,
    2,
  );

  const repairSystem = [
    `## Role
You fix board-game summaries to satisfy structure, clarity, and style rules.`,

    `## Output format
Return JSON only: {"summary_full":"..."}
Plain text only. No markdown, no emojis.`,

    `## Rules
- Apply every issue listed in the user message until resolved.
- Preserve a concise paragraph style.
- 2 to 4 sentences is acceptable.
- Keep the editorial capsule style.
- If the win condition is unclear, strengthen the win clause.
- If the summary is too long, rewrite it to be more succinct while preserving identity, play loop, and win condition.
- Remove the game title unless it is necessary for clarity.
- If output is too flavor-heavy or vague, replace flavor with concrete actions and win clarity.
- Do not truncate mid-word or mid-thought; shorten by rewriting.`,
  ].join('\n\n');

  return callOpenAIJson({
    system: repairSystem,
    user: repairUser,
    temperature: 0.3,
  });
}

async function generateSummary(row) {
  const payload = buildUserPayload(row);
  const system = buildSystemPrompt();
  const user = `Game data:\n${JSON.stringify(payload, null, 2)}`;

  const initial = await callOpenAIJson({ system, user, temperature: 0.4 });
  let summaryFull = normalizeText(initial.parsed.summary_full || '');
  const rawInitial = initial.raw;

  let repairPasses = 0;
  let lastRepairRaw = '';

  for (let pass = 0; pass < MAX_REPAIR_PASSES; pass++) {
    const validation = validateSummary(summaryFull, payload);
    if (validation.valid) break;

    repairPasses++;
    const { parsed, raw } = await repairSummary({
      summaryFull,
      issues: validation.issues,
      payload,
    });
    lastRepairRaw = raw;
    summaryFull = normalizeText(parsed.summary_full || summaryFull);
  }

  const finalValidation = validateSummary(summaryFull, payload);

  return {
    summary_full: summaryFull,
    raw_response: rawInitial,
    repair_raw_last: lastRepairRaw,
    repair_passes: repairPasses,
    word_count: finalValidation.wordCount,
    sentence_count: finalValidation.sentenceCount,
    validation_ok: finalValidation.valid,
    validation_issues: finalValidation.issues.join(' | '),
    identity_context_extracted: payload.summary_context?.identity_context || '',
    turn_actions_extracted: (payload.summary_context?.turn_actions || []).join('; '),
    win_condition_extracted: payload.summary_context?.win_condition || '',
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
      const result = await generateSummary(row);
      out.push({
        id: row.id,
        name: row.name,
        summary_full: result.summary_full,
        word_count: result.word_count,
        sentence_count: result.sentence_count,
        repair_passes: result.repair_passes,
        validation_ok: result.validation_ok,
        validation_issues: result.validation_issues,
        identity_context_extracted: result.identity_context_extracted,
        turn_actions_extracted: result.turn_actions_extracted,
        win_condition_extracted: result.win_condition_extracted,
        raw_response: result.raw_response,
        repair_raw_last: result.repair_raw_last,
      });
      console.log(`[${i + 1}/${slice.length}] OK: ${row.name}`);
    } catch (err) {
      out.push({
        id: row.id,
        name: row.name,
        summary_full: '',
        word_count: 0,
        sentence_count: 0,
        repair_passes: 0,
        validation_ok: false,
        validation_issues: '',
        identity_context_extracted: '',
        turn_actions_extracted: '',
        win_condition_extracted: '',
        raw_response: `ERROR: ${err.message}`,
        repair_raw_last: '',
      });
      console.log(`[${i + 1}/${slice.length}] FAIL: ${row.name} -> ${err.message}`);
    }
  }

  const header = [
    'id',
    'name',
    'summary_full',
    'word_count',
    'sentence_count',
    'repair_passes',
    'validation_ok',
    'validation_issues',
    'identity_context_extracted',
    'turn_actions_extracted',
    'win_condition_extracted',
    'raw_response',
    'repair_raw_last',
  ];

  const lines = [
    header.join(','),
    ...out.map((r) =>
      [
        escapeCsv(r.id),
        escapeCsv(r.name),
        escapeCsv(r.summary_full),
        escapeCsv(r.word_count),
        escapeCsv(r.sentence_count),
        escapeCsv(r.repair_passes),
        escapeCsv(r.validation_ok),
        escapeCsv(r.validation_issues),
        escapeCsv(r.identity_context_extracted),
        escapeCsv(r.turn_actions_extracted),
        escapeCsv(r.win_condition_extracted),
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
