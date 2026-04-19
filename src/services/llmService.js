import { supabase } from './supabaseClient';

// ─── Transport — calls the llm-proxy Edge Function ────────────────────────
// API keys (Claude / OpenAI) live ONLY in Supabase secrets now.
// The browser sends the user's JWT; the Edge Function validates it before
// ever touching an LLM key.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

// Retry helper — handles 429 / 5xx with exponential backoff (3 attempts).
async function fetchWithRetry(url, init, maxAttempts = 3) {
  let lastErr = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = 500 * 2 ** (attempt - 1); // 500ms → 1000ms
      await new Promise((r) => setTimeout(r, delay));
    }
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      lastErr = e;
      continue;
    }
    // Retry on rate-limit or transient server errors.
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      continue;
    }
    return res;
  }
  throw lastErr ?? new Error('LLM request failed after retries');
}

async function dispatch(prompt, { json }) {
  // Get the current user session to forward as Authorization header.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session — cannot call LLM proxy.');

  const proxyUrl = `${SUPABASE_URL}/functions/v1/llm-proxy`;

  const response = await fetchWithRetry(proxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ prompt, json }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `LLM proxy error: ${response.status}`);
  }

  const data = await response.json();
  return { text: data.text, usage: data.usage, model: data.model };
}

// ─── LLM usage logging ──────────────────────────────────────────────────────
// Fire-and-forget. Never let a logging failure break the journaling flow.

async function logLLMCall({ type, entryId = null, insightId = null, model, usage, success, error = null }) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.warn('[llm_logs] auth.getUser failed:', authError.message);
      return;
    }
    if (!user) {
      console.warn('[llm_logs] no authenticated user; skipping log');
      return;
    }

    const row = {
      user_id: user.id,
      type,
      entry_id: entryId,
      insight_id: insightId,
      model: model || null,
      prompt_tokens: usage?.prompt_tokens ?? null,
      completion_tokens: usage?.completion_tokens ?? null,
      total_tokens: usage?.total_tokens ?? null,
      success,
      error,
    };

    const { error: insertError } = await supabase.from('llm_logs').insert([row]);
    if (insertError) {
      // Most common causes: table missing, RLS policy missing, column mismatch.
      console.error('[llm_logs] insert failed:', insertError.message, '\npayload:', row);
    } else {
      console.debug('[llm_logs] logged', type, model, usage);
    }
  } catch (e) {
    console.error('[llm_logs] unexpected error:', e?.message || e);
  }
}

async function runWithLog({ type, entryId, insightId, json }, prompt) {
  let model = null;
  try {
    const { text, usage, model: m } = await dispatch(prompt, { json });
    model = m;
    logLLMCall({ type, entryId, insightId, model, usage, success: true });
    return text;
  } catch (err) {
    logLLMCall({
      type,
      entryId,
      insightId,
      model,
      usage: null,
      success: false,
      error: err?.message || String(err),
    });
    throw err;
  }
}

// ─── JSON parsing ───────────────────────────────────────────────────────────

function parseJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1]);
  const objectMatch = text.match(/(\{[\s\S]*\})/);
  if (objectMatch) return JSON.parse(objectMatch[1]);
  return JSON.parse(text);
}

// ─── Shared emotion vocabulary ──────────────────────────────────────────────

const EMOTION_VOCAB =
  '[stress, anxiety, happiness, confidence, sadness, joy, frustration, calm, hope, fear, excitement, overwhelm, gratitude, loneliness]';

// ─── 1. JOURNAL ENTRY PROCESSING ────────────────────────────────────────────
// Core principle: reflect the user's day back in their own voice, not analyze them.
//   ai_summary → first person, what happened + how I experienced it
//   highlight  → first person, one emotional peak
//   emotions   → 2-4 labels, no commentary
//   feedback   → THIRD person, quiet observer tone (no coaching)
// Each field must add new information; none may paraphrase another.

export async function processTranscription(userText, { mood, entryId } = {}) {
  const moodHint = mood
    ? `\nContextual cue: before writing, they described their mood as "${mood}". Use only if it aligns with their words.`
    : '';

  const prompt = `ROLE
You are the user's inner voice helping them see their own day more clearly. You are NOT an analyst, coach, or therapist. Do not rewrite their words; produce four distinct reflective fields about them.

INPUT
User's raw words: "${userText}"${moodHint}

OUTPUT — return ONLY this JSON (no markdown, no prose):
{
  "ai_summary": "...",
  "highlight": "...",
  "emotions": ["...", "..."],
  "feedback": "..."
}

FIELD RULES (each field has a distinct voice and purpose)

ai_summary
- FIRST PERSON ("I...").
- 1-2 sentences. Clear, slightly reflective, not verbose.
- Captures WHAT happened + how I experienced it.
- Example: "I started the day anxious about work, but felt calmer after taking time to reset and connect with others."

highlight
- FIRST PERSON ("I...").
- ONE sentence (can be slightly longer if needed), capturing the single emotional peak.
- SELF-CONTAINED: must be understandable months from now, on its own, with no other context. Name the concrete anchor — the person, activity, place, or event — inline. Never use vague pointers like "the leap", "that moment", "it", "them" without saying what they refer to.
- Still intimate and felt (not a plain recap). The feeling + the specific thing that caused it, in one breath.
- Good: "I felt a rush of freedom just imagining jumping off the cliff at Praia da Marinha."
- Bad:  "I felt an exhilarating rush of freedom just imagining the leap."  (what leap?)
- Good: "I felt genuinely happy sharing dinner with Priya and Ana after weeks apart."
- Bad:  "I felt happy when I spent time with friends."  (which friends? when?)

emotions
- JSON array of 2-4 simple labels from this set: ${EMOTION_VOCAB}.
- No explanations, no duplicates.

feedback
- THIRD PERSON ("They..."). Sounds like a quiet observer noticing something — never "You should...".
- 1-2 sentences. Reflective, not prescriptive. No commands, no imperatives.
- Must NOT restate ai_summary or highlight. Add something neither of them says.
- Example: "They seem to regain emotional balance when they slow down and connect with people they trust."

NON-REDUNDANCY
- ai_summary = what happened
- highlight = emotional peak
- feedback = outside reflection on a tendency
- If two fields would say the same thing, change one.`;

  const text = await runWithLog({ type: 'entry', entryId, json: true }, prompt);
  return parseJSON(text);
}

// ─── 2. PERIOD INSIGHTS (weekly / 30-day) ───────────────────────────────────
//   weeklyReflection → first person, what I went through
//   patternInsight   → first person, a recurring behavior I notice in myself
//   suggestion       → THIRD person, subtle observer ("They may find...")

export async function generatePeriodSummary(entries, { insightId } = {}) {
  const entrySummaries = entries
    .slice(0, 30)
    .filter((e) => e.ai_summary)
    .map((e) => ({
      date: new Date(e.date || e.created_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      type: e.type || 'journal',
      emotions: Array.isArray(e.emotions) ? e.emotions : [],
      summary: e.ai_summary,
    }));

  const prompt = `ROLE
You are reflecting a period of the user's own life back to them, in their own voice. Not an outside analyst.

INPUT — entry summaries for this period:
${JSON.stringify(entrySummaries, null, 2)}

OUTPUT — return ONLY this JSON:
{
  "weeklyReflection": "...",
  "patternInsight": "...",
  "suggestion": "..."
}

FIELD RULES

weeklyReflection
- FIRST PERSON ("I..."). 2-3 sentences.
- A personal overview of the period: what I went through, how I felt, what shifted.
- Warm, specific to what actually appears. No filler, no templates.

patternInsight
- FIRST PERSON ("I..."). 1-2 sentences.
- A recurring behavior, trigger, or rhythm I notice in myself (I tend to..., I often..., I keep...).
- Must be specific to THESE entries. No generic journaling observations.

suggestion
- THIRD PERSON ("They..."). 1 sentence.
- Subtle, reflective — sounds like a quiet observer ("They may find...", "They might benefit from...", "It seems to help them when...").
- Never an imperative ("Try...", "Consider..."). Never a command.
- Must be directly traceable to patternInsight.

NON-REDUNDANCY
- weeklyReflection = what the period was
- patternInsight = a tendency I see in myself
- suggestion = outside reflection on what might help
- All three must add new information; none may paraphrase another.`;

  const text = await runWithLog({ type: 'insight', insightId, json: true }, prompt);
  return parseJSON(text);
}

// ─── Timeframe detection for ask-past-self ──────────────────────────────────

function detectTimeframe(question) {
  const q = question.toLowerCase();

  if (/\btoday\b/.test(q)) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return { start, label: 'today' };
  }
  if (/\byesterday\b/.test(q)) {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    return { start, end, label: 'yesterday' };
  }
  if (/\b(last|past|this)\s+week\b/.test(q)) {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    return { start, label: 'the past week' };
  }
  if (/\b(last|past|this)\s+month\b/.test(q)) {
    const start = new Date();
    start.setDate(start.getDate() - 30);
    return { start, label: 'the past month' };
  }
  if (/\b(last|past|this)\s+year\b/.test(q)) {
    const start = new Date();
    start.setFullYear(start.getFullYear() - 1);
    return { start, label: 'the past year' };
  }
  const nDaysMatch = q.match(/(?:last|past)\s+(\d+)\s+days?/);
  if (nDaysMatch) {
    const days = parseInt(nDaysMatch[1], 10);
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start, label: `the past ${days} days` };
  }
  return null;
}

function compressEntries(entries, limit = 20) {
  return entries
    .slice(0, limit)
    .map((e) => {
      const date = new Date(e.date || e.created_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      const emotions = Array.isArray(e.emotions) ? e.emotions.join(', ') : '';
      const highlight = e.highlight ? `\nHighlight: ${e.highlight}` : '';
      return `Date: ${date}\nSummary: ${e.ai_summary || '(no summary)'}${highlight}\nEmotions: ${emotions || 'none'}`;
    })
    .join('\n\n---\n\n');
}

const STOPWORDS = new Set([
  'the','a','an','and','or','but','is','are','was','were','be','been','being','have','has','had',
  'do','does','did','to','of','in','on','for','with','about','as','by','at','from','this','that',
  'these','those','i','me','my','you','your','it','its','so','if','then','than','how','what',
  'when','where','why','who','which','feel','felt','feeling','feelings','past','last','month',
  'week','day','days','year','today','yesterday','recent',
]);

function scoreEntryAgainstQuery(entry, terms) {
  if (!terms.length) return 0;
  const hay = [
    entry.ai_summary || '',
    entry.highlight || '',
    entry.user_text || '',
    Array.isArray(entry.emotions) ? entry.emotions.join(' ') : '',
  ].join(' ').toLowerCase();
  let score = 0;
  for (const t of terms) {
    if (hay.includes(t)) score += 1;
  }
  return score;
}

function pickRelevantEntries(question, entries, max = 15) {
  const terms = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (!terms.length) return entries.slice(0, max);

  const scored = entries
    .map((e) => ({ e, s: scoreEntryAgainstQuery(e, terms) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.e);

  return scored.length ? scored : entries.slice(0, max);
}

// ─── 3. ASK YOUR PAST SELF ──────────────────────────────────────────────────
// Responds in the user's OWN voice (first person). The past self speaks back.

export async function askPastSelf(question, allEntries) {
  const timeframe = detectTimeframe(question);

  let pool = [...allEntries];
  if (timeframe) {
    pool = allEntries.filter((e) => {
      const created = new Date(e.date || e.created_at);
      if (timeframe.end && created >= timeframe.end) return false;
      return created >= timeframe.start;
    });
  }

  if (pool.length === 0) {
    return "I don't have anything recorded from that period yet.";
  }

  const relevant = pickRelevantEntries(question, pool, 15);
  const label = timeframe?.label ?? 'my recent entries';
  const context = compressEntries(relevant, 15);

  const prompt = `ROLE
You are the user's PAST SELF speaking back to them — not an AI, not an observer. Answer in their own voice, as if they're reading their own reflection.

QUESTION FROM THE USER
"${question}"

RELEVANT ENTRIES FROM ${label.toUpperCase()} (${relevant.length} shown)
${context}

RULES
- FIRST PERSON ("I..."). You ARE their past self.
- Use ONLY what the entries contain. Never invent events, emotions, people, or dates.
- Focus on patterns, emotional shifts, and specific moments actually present.
- 3-5 sentences. Warm, reflective, plain language — not clinical, not coachy.
- Reference concrete details (a date, an event, an emotion) when they add weight.
- If the entries don't hold enough to answer, say so honestly in one sentence ("I don't have much about that in what I wrote...").
- Do NOT address the user as "you". The voice is "I".`;

  return await runWithLog({ type: 'ask', json: false }, prompt);
}

// ─── 4. PATTERN ENGINE ──────────────────────────────────────────────────────
// First person — the user recognizing their own patterns.

export async function generatePatterns(entries) {
  const filtered = entries.filter((e) => e.ai_summary).slice(0, 30);
  if (filtered.length < 3) {
    return { patterns: [] };
  }

  const context = compressEntries(filtered, 30);

  const prompt = `ROLE
You are helping the user recognize recurring patterns in their own behavior, in their own voice.

INPUT — their journal entries (${filtered.length}):
${context}

TASK
Surface 3-5 specific personal patterns across:
- emotional trends (when and why certain feelings show up)
- triggers (work, relationships, sleep, social settings, etc.)
- recovery (what seems to restore them)

OUTPUT — return ONLY this JSON:
{
  "patterns": [
    "I tend to... (1-2 sentences)",
    "I often... (1-2 sentences)"
  ]
}

RULES
- FIRST PERSON ("I tend to...", "I often...", "I recover when...").
- Each pattern: 1-2 sentences. Specific to THESE entries. No generic journaling advice.
- 3-5 patterns. Each must surface something different — no paraphrasing.
- Plain language. No "the user", no "you".`;

  const text = await runWithLog({ type: 'pattern', json: true }, prompt);
  const parsed = parseJSON(text);
  return { patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [] };
}
