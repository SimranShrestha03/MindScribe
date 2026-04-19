// Supabase Edge Function: llm-proxy
// Authenticates the caller, forwards the prompt to Claude or OpenAI,
// and returns { text, usage, model }. API keys never leave the server.
//
// Required secrets (supabase secrets set KEY=value):
//   LLM_PROVIDER          "claude" | "openai"   (default: "claude")
//   CLAUDE_API_KEY         Anthropic secret key
//   OPENAI_API_KEY         OpenAI secret key
//
// Deploy:
//   supabase functions deploy llm-proxy --no-verify-jwt
//
// The function verifies the caller's Supabase JWT before touching any LLM key.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// Retry helper — handles 429 / 5xx with exponential backoff.
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxAttempts = 3,
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = 500 * 2 ** (attempt - 1); // 500ms, 1000ms
      await new Promise((r) => setTimeout(r, delay));
    }
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      lastErr = new Error(`HTTP ${res.status}`);
      continue;
    }
    return res;
  }
  throw lastErr ?? new Error('LLM request failed after retries');
}

// ─── Claude transport ────────────────────────────────────────────────────────
async function callClaude(
  prompt: string,
  claudeKey: string,
): Promise<{ text: string; usage: Record<string, number | null>; model: string }> {
  const CLAUDE_MODEL = 'claude-sonnet-4-6';

  // Split the system scaffold from the unique user content so Anthropic can
  // cache the static prefix and charge ~20% of normal input tokens on repeat calls.
  // The prompt convention from llmService: everything up to the first INPUT/QUESTION
  // line is static scaffolding; the rest contains dynamic user data.
  const staticBreak = prompt.search(/\n(?:INPUT|QUESTION FROM THE USER)/);
  const hasStaticPrefix = staticBreak > 50;

  let messages: unknown[];
  if (hasStaticPrefix) {
    const staticPart = prompt.slice(0, staticBreak).trim();
    const dynamicPart = prompt.slice(staticBreak).trim();
    messages = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: staticPart,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: dynamicPart,
          },
        ],
      },
    ];
  } else {
    messages = [{ role: 'user', content: prompt }];
  }

  const response = await fetchWithRetry(
    'https://api.anthropic.com/v1/messages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        messages,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(err.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const usage = {
    prompt_tokens: data.usage?.input_tokens ?? null,
    completion_tokens: data.usage?.output_tokens ?? null,
    total_tokens:
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0) || null,
    cache_read_input_tokens: data.usage?.cache_read_input_tokens ?? null,
    cache_creation_input_tokens: data.usage?.cache_creation_input_tokens ?? null,
  };
  return { text: data.content[0].text, usage, model: data.model || CLAUDE_MODEL };
}

// ─── OpenAI transport ────────────────────────────────────────────────────────
async function callOpenAI(
  prompt: string,
  openaiKey: string,
  json: boolean,
): Promise<{ text: string; usage: Record<string, number | null>; model: string }> {
  const OPENAI_MODEL = 'gpt-4o-mini';

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as any;
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json() as any;
  const usage = {
    prompt_tokens: data.usage?.prompt_tokens ?? null,
    completion_tokens: data.usage?.completion_tokens ?? null,
    total_tokens: data.usage?.total_tokens ?? null,
  };
  return { text: data.choices[0].message.content, usage, model: data.model || OPENAI_MODEL };
}

// ─── Main handler ────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // 1. Authenticate the caller via their Supabase JWT.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Server is not configured' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    // 2. Parse the request body.
    let body: { prompt: string; json?: boolean };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
      return jsonResponse({ error: 'Missing prompt' }, 400);
    }

    // 3. Dispatch to LLM provider.
    const provider = Deno.env.get('LLM_PROVIDER') ?? 'claude';
    const claudeKey = Deno.env.get('CLAUDE_API_KEY') ?? '';
    const openaiKey = Deno.env.get('OPENAI_API_KEY') ?? '';

    let result: { text: string; usage: Record<string, number | null>; model: string };
    if (provider === 'openai') {
      if (!openaiKey) return jsonResponse({ error: 'OpenAI key not configured' }, 500);
      result = await callOpenAI(body.prompt, openaiKey, body.json ?? true);
    } else {
      if (!claudeKey) return jsonResponse({ error: 'Claude key not configured' }, 500);
      result = await callClaude(body.prompt, claudeKey);
    }

    return jsonResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('llm-proxy error:', message);
    return jsonResponse({ error: message }, 500);
  }
});
