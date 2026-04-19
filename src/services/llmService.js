const PROVIDER = import.meta.env.VITE_LLM_PROVIDER || 'claude';
const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(prompt, json = true) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

function callLLM(prompt) {
  if (PROVIDER === 'openai') return callOpenAI(prompt, true);
  return callClaude(prompt);
}

function callLLMText(prompt) {
  if (PROVIDER === 'openai') return callOpenAI(prompt, false);
  return callClaude(prompt);
}

function parseJSON(text) {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) return JSON.parse(fenceMatch[1]);
  const objectMatch = text.match(/(\{[\s\S]*\})/);
  if (objectMatch) return JSON.parse(objectMatch[1]);
  return JSON.parse(text);
}

export async function processTranscription(userText, { mood } = {}) {
  const moodHint = mood ? `\nContext: The user described their mood as "${mood}" before writing.` : '';

  const prompt = `You are a compassionate journaling assistant. The user has shared their raw thoughts below. Do NOT rewrite or replace their words; only produce four distinct AI-enhanced fields.${moodHint}

User's words: "${userText}"

Each field has a strictly different role. Do NOT repeat the same idea across fields:

ai_summary → FIRST PERSON. 1-2 sentences from the user's perspective (I..., I noticed..., I felt...). Factual and personal. No advice.
highlight  → EMOTIONAL PEAK. One short sentence capturing the single most felt or meaningful moment. Must feel different from the summary: more intimate, less descriptive.
emotions   → 2-4 emotion labels as a JSON array.
feedback   → ACTIONABLE. 1-2 sentences of second-person advice (You / Your). Must NOT restate the summary or highlight. Give a concrete, specific suggestion tied to what was shared.

Return ONLY this exact JSON (no markdown, no extra text):
{
  "ai_summary": "...",
  "highlight": "...",
  "emotions": ["...", "..."],
  "feedback": "..."
}

Constraints:
- ai_summary: first person, specific; begins with "I" or "I've" or "I was"
- highlight: intimate and felt, not a description; starts with something like "Seeing...", "The moment...", "Feeling..."
- feedback: second person, actionable, never a paraphrase of the other fields
- emotions: pick 2-4 from [stress, anxiety, happiness, confidence, sadness, joy, frustration, calm, hope, fear, excitement, overwhelm, gratitude, loneliness]
- All four fields must feel distinct so a reader gets new information from each one`;

  const text = await callLLM(prompt);
  return parseJSON(text);
}


export async function generatePeriodSummary(entries) {
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

  const prompt = `You are a warm, perceptive journaling companion. Based only on the AI summaries of these journal entries, write a personal, honest reflection for this period.

Entry summaries:
${JSON.stringify(entrySummaries, null, 2)}

Return ONLY this exact JSON (no markdown, no extra text):
{
  "weeklyReflection": "2-3 sentences in first person (I noticed..., I felt..., This period...). Warm, specific, references what actually appears in the summaries. No filler.",
  "patternInsight": "1-2 sentences in second person (You tend to..., You often...). Name a real, specific pattern visible across the entries: emotional, behavioural, or thematic.",
  "suggestion": "1 sentence in second person. One concrete, actionable suggestion directly tied to the observed pattern. Starts with a verb (Try..., Consider..., When...)."
}

Rules:
- weeklyReflection must read like something a thoughtful friend wrote, not a template
- patternInsight must be specific to these entries; no generic observations
- suggestion must be directly traceable to the pattern; not generic advice
- All three must feel distinct and add value to each other`;

  const text = await callLLM(prompt);
  return parseJSON(text);
}

// Detect a date range from a natural language question.
// Returns { start: Date, label: string } or null (use all recent entries).
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

function compressEntries(entries) {
  return entries
    .slice(0, 20)
    .map((e) => {
      const date = new Date(e.date || e.created_at).toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
      });
      const emotions = Array.isArray(e.emotions) ? e.emotions.join(', ') : '';
      return `Date: ${date}\nSummary: ${e.ai_summary || '(no summary)'}\nEmotions: ${emotions || 'none'}`;
    })
    .join('\n\n---\n\n');
}

export async function askPastSelf(question, allEntries) {
  const timeframe = detectTimeframe(question);

  let relevant = [...allEntries];
  if (timeframe) {
    relevant = allEntries.filter((e) => {
      const created = new Date(e.date || e.created_at);
      if (timeframe.end && created >= timeframe.end) return false;
      return created >= timeframe.start;
    });
  }

  if (relevant.length === 0) {
    return "There are no journal entries in that time period yet. Start writing and come back to ask!";
  }

  const label = timeframe?.label ?? 'your recent entries';
  const context = compressEntries(relevant);

  const prompt = `You are analyzing a user's past journal entries to answer their personal question honestly and meaningfully.

Question: "${question}"

Journal entries from ${label} (${Math.min(relevant.length, 20)} shown):

${context}

Rules:
- Answer ONLY using what appears in the provided entries; do not invent details
- Write in second person (You felt..., You noticed..., Your mood...)
- Focus on emotional patterns, recurring themes, or specific moments
- Be specific: reference actual emotions and content from the entries
- Keep the answer to 3-5 sentences, concise, warm, and reflective
- If the entries do not contain enough relevant information, say so honestly in one sentence`;

  return await callLLMText(prompt);
}

