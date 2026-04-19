# MindScribe: reference for assistants and developers

> **Standing instruction:** Every time a feature is added, changed, or removed, this file MUST be updated before the session ends. Keep it accurate so future assistants do not need to re-read the whole codebase.

Single-document overview of architecture, auth, data, and files. The app is a React + Vite SPA with no custom backend server: the database and auth are hosted Supabase.

---

## Purpose

MindScribe helps users journal by **voice** (Web Speech API) or **text**. An LLM turns raw input into structured fields: summary, emotions, highlight, feedback. Data lives in **Supabase Postgres** behind **Supabase Auth** (email/password) and **RLS** so users only access their own rows.

---

## Runtime stack

| Piece | Detail |
|-------|--------|
| UI | React 18, functional components |
| Styles | Tailwind CSS 3 (dark mode via `darkMode: 'class'`) |
| Bundler | Vite 4 |
| Database + auth | Supabase (`@supabase/supabase-js`), anon key in browser only |
| LLM | OpenAI (`gpt-4o-mini`) or Anthropic (`claude-sonnet-4-6`) via `VITE_LLM_PROVIDER` |

---

## Environment variables (must be prefixed `VITE_`)

| Variable | Role |
|----------|------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key (never service_role in frontend) |
| `VITE_LLM_PROVIDER` | **No longer used in the browser.** Provider is now set via the `LLM_PROVIDER` Edge Function secret. |

Optional Conda users can install Node via `environment.yml`, then run `npm install`.

Edge Function secrets (set via `supabase secrets set`, never in `.env`):

| Secret | Role |
|--------|------|
| `LLM_PROVIDER` | `openai` or `claude` (default: `claude`) |
| `CLAUDE_API_KEY` | Anthropic secret key — **server only, never in browser** |
| `OPENAI_API_KEY` | OpenAI secret key — **server only, never in browser** |
| `RESEND_API_KEY` | Resend email API key (`re_...`) |
| `RESEND_FROM` | Sender address, e.g. `MindScribe <noreply@yourdomain.com>` |

> **Security:** `VITE_OPENAI_API_KEY` and `VITE_CLAUDE_API_KEY` have been **removed** from the browser bundle. All LLM keys live exclusively in Supabase Edge Function secrets.

---

## Entry point and providers

File: `src/main.jsx`

Wrap order (outer to inner):

1. **`ThemeProvider`** (`src/context/ThemeContext.jsx`): `theme` ('dark' | 'light'), `toggleTheme`. Persists to `localStorage` key `mindscribe_theme`. Sets `data-theme` attribute and class on `<html>`.
2. **`AuthProvider`** (`src/context/AuthContext.jsx`): Loads session with `supabase.auth.getSession()`, subscribes to `onAuthStateChange`. Exposes `user`, `loading`, `signUp`, `signIn`, `signOut`.
3. **`JournalProvider`** (`src/context/JournalContext.jsx`): Page routing state, journal entries cache, Supabase helpers.

`index.html` runs a tiny pre-React script that applies the stored theme before hydration so there is no flash on reload.

---

## Routing (no React Router)

`JournalContext` holds `page`, one of: `home`, `recording`, `results`, `insights`.

`App.jsx`:

- While auth `loading`: show `LoadingSpinner`.
- If no `user`: render **only** `AuthPage` (main app pages are not mounted; avoids unauthenticated Supabase calls).
- If `user`: map `page` to `Home`, `Recording`, `Results`, or `WeeklyInsights`.

---

## Authentication UI

File: `src/pages/AuthPage.jsx`

- Toggle between **Login** and **Sign Up** on a single screen.
- Fields: email, password. Signup also shows an **optional Name** field.
- Client validation: email shape, password length >= 6.
- `ThemeToggle` button in the top-right corner.
- Uses `supabase.auth.signInWithPassword` and `signUp`. Shows Supabase errors and loading on submit.
- On signup, `AuthContext.signUp(email, password, name)` passes a trimmed `name` via `options.data` so it lands in `auth.users.raw_user_meta_data`. The `handle_new_user` DB trigger reads it into `profiles.name`.
- If email confirmation is required and signup returns no session, shows a message to check email.

---

## Journal context

File: `src/context/JournalContext.jsx`

**State:** `page`, `navigate`, `currentEntry`, `setCurrentEntry`, `entries`, `hasMore`, `pendingCategory`, `setPendingCategory`, `pendingMood`, `setPendingMood`, `autoEditMode`, `setAutoEditMode`.

**Persistence helpers:** `saveEntry`, `updateEntry`, `deleteEntry`, `fetchEntries`, `fetchMoreEntries`, `fetchEntriesByRange`.

- `fetchEntries` — loads page 0 and resets the entry list (called on mount).
- `fetchMoreEntries` — appends page N+1; used by the infinite-scroll sentinel in Home.

**Important:** When `user?.id` changes (login, logout, switch), an effect resets all state to defaults, preventing cross-user data leaks in memory.

**saveEntry:** throws if `user` is null as defense-in-depth (auth gate normally prevents this).

---

## Supabase client and services

**Client:** `src/services/supabaseClient.js` calls `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.

**Service:** `src/services/supabaseService.js`

| Function | Behavior |
|----------|----------|
| `saveJournal` | Insert into `journals`. Does **not** set `user_id`; DB default `auth.uid()` applies. |
| `updateJournal` | Update by `id`. |
| `deleteJournal` | Delete by `id`. |
| `getAllJournals(page=0)` | Paginated select (50 rows/page, newest first). Returns `{ data, hasMore }`. |
| `getJournalsByDateRange` | `created_at >= startDate`, ordered newest first. |
| `saveInsightRecord` | Insert into `insights` (period summary save from Weekly Insights). |

---

## Database expectations

- Tables **`journals`**, **`insights`**, and **`llm_logs`** include **`user_id`** with RLS policies `auth.uid() = user_id`.
- `journals` and `insights` have a `user_id` default of `auth.uid()` — inserts omit it.
- `llm_logs` has no default — the client sets `user_id` explicitly from `supabase.auth.getUser()`.
- **`profiles`** is keyed on `id` (references `auth.users(id) on delete cascade`). RLS: `auth.uid() = id` for select/update. Rows are created by a trigger, not the client.

**`profiles` columns:** `id`, `email`, `name` (nullable), `timezone` (nullable), `created_at`, `last_active_at`, `last_entry_at`, `entry_count`.

**Triggers driving `profiles`:**
- `on_auth_user_created` — after `insert on auth.users`, calls `handle_new_user()` which inserts a profile row with `email` and `raw_user_meta_data->>'name'`.
- `on_journal_insert` — after `insert on journals`, calls `bump_profile_activity()` which bumps `last_active_at`, sets `last_entry_at = now()`, and increments `entry_count`.

**View `active_users_7d`** — selects profiles with `last_active_at >= now() - interval '7 days'`. Convenience surface for admin/analytics queries; no UI reads it yet.

Key columns in `journals`: `id`, `created_at`, `user_text`, `ai_summary`, `emotions` (jsonb array), `feedback`, `highlight`, `type`, `is_favorite`, `embedding` (pgvector, 1536 dims, nullable).

**Semantic search** uses a `match_journals(query_embedding vector(1536), match_count int) returns table(...)` SQL function (defined with `security invoker`, scoped to `auth.uid()`). Called via `supabase.rpc('match_journals', ...)` from the client. Returns the 15 nearest neighbors by cosine distance. Entries without an embedding are skipped; Ask falls back to keyword scoring in that case.

**`llm_logs`** (every LLM call, success or failure):

| Column | Notes |
|--------|-------|
| `id` | uuid pk |
| `created_at` | default `now()` |
| `user_id` | set explicitly by client |
| `type` | `'entry' \| 'insight' \| 'ask' \| 'pattern'` |
| `entry_id`, `insight_id` | optional linking ids |
| `model` | e.g. `gpt-4o-mini`, `claude-sonnet-4-6` |
| `prompt_tokens`, `completion_tokens`, `total_tokens` | normalized across providers |
| `success` | boolean |
| `error` | message on failure |

RLS policies: `for insert with check (auth.uid() = user_id)` and `for select using (auth.uid() = user_id)`.

---

## Pages

### Home (`src/pages/Home.jsx`)

Header row: **MindScribe** title + date, then **ThemeToggle**, **Export** button, **Insights** button, **Logout**.

Below header:

- **StreakBadge**: 🔥 N Day Streak (consecutive journaling days, anchors on today or yesterday). Hidden when there are zero entries.
- **Search bar** (debounced 300ms via `useDebounce`). Local keyword filter — no LLM. Scores across `highlight` (+3), `ai_summary` (+2), `emotions` (+2), `user_text` (+1). Returns matching entry cards, capped at 20. Typing clears the Ask panel.
- **Ask button** (chat icon) toggles the `AskYourself` panel. Opening Ask clears the search term.
- **AskYourself panel** (when open): see section below. **Difference vs. Search:** Search returns matching entry rows; Ask sends a question + relevant entries to the LLM and returns a synthesized first-person reflection.
- **DailyCheckIn** inline card (shown once per day, dismissed via `localStorage` key `mindscribe_checkin_date`).
- **Category filter grid**: 6 cards. Favorites filters on `is_favorite`.
- **Entry list**: cards with 3-dot menu (edit, favourite, delete), up to 3 emotion chips.

FAB (bottom-right): opens Add Entry modal.

### DailyCheckIn (`src/components/DailyCheckIn.jsx`)

Inline card (not a modal). Shows "How are you feeling today?" with 4 mood buttons (😞 😐 🙂 😄) and a Skip link. On mood tap: stores today's date in `localStorage`, sets `pendingMood` in context, opens Add Entry modal.

### AskYourself (`src/components/AskYourself.jsx`)

Collapsible panel below the search bar. Input + Ask button + 4 quick-suggestion chips.

- **Timeframe detection** (regex, no network): "today", "yesterday", "last week", "last month", "last year", "last N days" -> filters `entries` in memory by date.
- **Relevance selection**: keyword scoring on `ai_summary / highlight / user_text / emotions` with stopword filtering. Picks top 15; falls back to recency if nothing matches.
- **Context compression**: formatted as `Date / Summary / Highlight / Emotions` blocks (up to 15).
- **LLM call**: `askPastSelf(question, allEntries)` in `llmService.js`. Returns plain text.
- **Voice**: response is **first person** — written as the user's past self speaking back ("I was feeling..."). This is intentional and matches the "my own thoughts reflected back" principle.
- **Dismiss behavior**: answer disappears on click outside the component (via `mousedown` listener on `containerRef`) or when the user starts typing a new question.

### Add Entry modal (`src/components/AddEntryModal.jsx`)

Pick category; **Speak** goes to Recording; **Write** shows textarea, calls `processTranscription`, then navigates to Results.

### Recording (`src/pages/Recording.jsx`)

Chrome/Edge only (Web Speech API). Live transcript with waveform. On stop: calls `processTranscription(text, { mood: pendingMood })`, sets `currentEntry`, navigates to Results.

### Results (`src/pages/Results.jsx`)

Five sections in order: My Words, AI Summary, Highlight, Emotions, Feedback. Edit mode toggles all fields editable. Save: first-time = INSERT, subsequent = UPDATE. Favourite star syncs to DB when entry is already saved.

### Weekly Insights (`src/pages/WeeklyInsights.jsx`)

Header: back button, title, **ThemeToggle**, **Logout**. Date tabs: Today / 7 / 10 / 30 days. Stats, mood distribution bars, recent entries log. **Generate AI Summary** calls `generatePeriodSummary`; **Save Insights** calls `saveInsightRecord`.

Below the AI summary (and operating on the **full** entry history, not the active tab):

- **PatternEngine** (`components/PatternEngine.jsx`) — on-demand button that calls `generatePatterns(entries)` and renders 3–5 first-person patterns ("I tend to...", "I often..."). Gated on having at least 3 summarized entries.
- **HighlightsOfMonth** (`components/HighlightsOfMonth.jsx`) — last 30 days of non-empty highlights, ranked by length, top 10. Purely local — no LLM call. Hidden when empty.
- **EmbeddingsBackfill** (`components/EmbeddingsBackfill.jsx`) — only renders when at least one entry has no embedding. Sequentially embeds missing entries via `embedText` + `setEntryEmbedding`, with cancel button and progress bar. 100ms delay between calls as a gentle rate limit. Self-hides once everything is backfilled.

On mount, `WeeklyInsights` calls `fetchEntries()` if the JournalContext cache is empty so these two components have the full history to work with.

### Export modal (`src/components/ExportModal.jsx`)

Delivery toggle: **Email me** or **Download PDF**. Range select: Last 7 / 30 / 90 days or Custom (two date pickers).

- **Email mode:** `supabase.functions.invoke('export-journal', { body: { ..., mode: 'email' } })`. Function emails a ZIP containing the PDF via Resend.
- **Download mode:** direct `fetch` to `${VITE_SUPABASE_URL}/functions/v1/export-journal` with `Authorization: Bearer <access_token>` and `apikey` headers. Function returns raw PDF bytes (`Content-Type: application/pdf`, `Content-Disposition: attachment`, `X-Entry-Count` header). Client wraps the response in a `Blob`, creates an object URL, and clicks a hidden `<a download>` to save. URL is revoked after 1s.

Why two paths: `supabase.functions.invoke` doesn't expose binary response bodies cleanly, so download uses plain `fetch`. Email keeps using `invoke` for consistent error-context parsing.

States: idle, submitting, success, error. Parses JSON error bodies (for both modes) and falls back to generic messages.

### Theme (`src/context/ThemeContext.jsx` + `src/components/ThemeToggle.jsx`)

Sun/moon icon button. Toggling sets `data-theme` on `<html>` and persists to `localStorage`. Light mode is CSS overrides in `globals.css` under `[data-theme='light']` that remap slate utilities. No markup changes needed in components.

---

## AI layer (`src/services/llmService.js`)

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `processTranscription(userText, { mood, entryId })` | `entry` | Returns `{ ai_summary, emotions, feedback, highlight }` JSON. |
| `generatePeriodSummary(entries, { insightId })` | `insight` | Returns `{ weeklyReflection, patternInsight, suggestion }` JSON. |
| `generatePatterns(entries)` | `pattern` | Returns `{ patterns: string[] }` (3–5 items). Requires ≥3 summarized entries. |
| `askPastSelf(question, allEntries?)` | `ask` | Semantic retrieval (embedding → `match_journals` RPC) with keyword fallback, timeframe filter, first-person plain-text answer. `allEntries` is only used when the RPC returns too few results. |
| `embedText(input)` | (unlogged) | Proxies to the `embed` action; returns a 1536-dim float array. Used on entry save (fire-and-forget) and to embed the Ask question. |

### Tone spec (STRICT — keep prompts aligned with these)

Each LLM field has a defined voice. Do not paraphrase across fields — they must add distinct value.

**Entry (`processTranscription`):**
- `ai_summary` — **1st person**, 1–2 sentences. What happened + how I experienced it.
- `highlight` — **1st person**, one emotional peak. **Must be self-contained** (name the person/place/activity inline — no "the leap", "that moment"). Readable cold months later.
- `emotions` — 2–4 labels from a fixed vocabulary. No commentary.
- `feedback` — **3rd person** ("They seem to..."). Quiet observer. Never imperative, never "You should".

**Period summary (`generatePeriodSummary`):**
- `weeklyReflection` — 1st person, 2–3 sentences.
- `patternInsight` — 1st person ("I tend to...").
- `suggestion` — **3rd person** ("They may find...", "It seems to help them when..."). No imperatives like "Try..." / "Consider...".

**Patterns (`generatePatterns`):** all items 1st person ("I tend to...", "I recover when..."), 3–5 distinct.

**Ask past self (`askPastSelf`):** 1st person throughout — the past self speaking back, NOT an outside analyst.

Core principle: *"My thoughts reflected back to me in my own voice"*, not *"An AI analyzing me"*. Prompts are structured `ROLE → INPUT → OUTPUT → RULES → NON-REDUNDANCY`.

### Transports

| Provider | Model | Notes |
|----------|-------|-------|
| `claude` (default) | `claude-sonnet-4-6` | Routed through `llm-proxy` Edge Function. Prompt caching enabled (`cache_control: ephemeral`) on the static ROLE/RULES prefix — cuts input tokens ~80% on repeat calls. |
| `openai` | `gpt-4o-mini` | Routed through `llm-proxy` Edge Function. JSON mode enforced via `response_format` when caller expects JSON. |
| embeddings | `text-embedding-3-small` (OpenAI, 1536 dims) | `embed` action on the proxy. Always uses OpenAI regardless of `LLM_PROVIDER` — Claude has no embedding endpoint. `OPENAI_API_KEY` must be set even when the chat provider is Claude. |

Both providers retry 429 / 5xx up to 3 times with exponential back-off (500ms, 1000ms) before surfacing an error. Retry logic lives in the Edge Function (`fetchWithRetry`).

Both transports return `{ text, usage, model }`. Usage is normalized to `{ prompt_tokens, completion_tokens, total_tokens }` (Claude's `input_tokens`/`output_tokens` are mapped).

### Logging (every call)

Every LLM call is wrapped in `runWithLog({ type, entryId?, insightId?, json }, prompt)`. On both success and failure it inserts into `llm_logs`:

- success path: `{ user_id, type, model, prompt_tokens, completion_tokens, total_tokens, success: true }`
- failure path: `{ ..., success: false, error: err.message }` then rethrows.

`logLLMCall` is fire-and-forget but checks Supabase's `{ error }` response explicitly (Supabase does not throw on DB errors). Failures are `console.error`'d with payload so table/RLS/schema issues are visible in DevTools but never break the user flow.

### Internal helpers

- `dispatch(prompt, { json })` — picks provider, returns `{ text, usage, model }`.
- `runWithLog(...)` — wraps dispatch with token logging.
- `logLLMCall(...)` — direct Supabase insert into `llm_logs`.
- `detectTimeframe(question)` — regex → `{ start, end?, label }` or `null`.
- `compressEntries(entries, limit)` — `Date / Summary / Highlight / Emotions` blocks.
- `pickRelevantEntries(question, entries, max)` — keyword scoring with stopword filter; recency fallback.
- `parseJSON(text)` — handles raw JSON and fenced blocks.

---

## Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useDebounce(value, delay)` | `src/hooks/useDebounce.js` | Delays a value update; used to debounce search input (300ms). |
| `useSpeechRecognition()` | `src/hooks/useSpeechRecognition.js` | Wraps Web Speech API; continuous mode, interim + final results. |

---

## Shared UI components

| Component | Notes |
|-----------|-------|
| `Button.jsx` | 5 variants: primary, secondary, danger, ghost, success. Loading spinner slot. |
| `EmotionTag.jsx` | Colour-coded pill, 14 emotion colours. |
| `MoodBar.jsx` | Horizontal bar for Insights mood chart. |
| `LoadingSpinner.jsx` | Spinning ring with message. |
| `ThemeToggle.jsx` | Sun/moon icon toggle. |
| `StreakBadge.jsx` | 🔥 N Day Streak chip (Home). Hidden when streak is 0. |
| `DailyCheckIn.jsx` | Inline mood picker card (Home only). |
| `AskYourself.jsx` | Ask past self panel (Home only). First-person response. |
| `PatternEngine.jsx` | Insights — on-demand recurring-pattern finder (calls `generatePatterns`). |
| `HighlightsOfMonth.jsx` | Insights — last 30 days of highlights, local only. |
| `AddEntryModal.jsx` | New entry flow. |
| `ExportModal.jsx` | Email export flow. |

---

## Edge Function: `export-journal`

Path: `supabase/functions/export-journal/index.ts` (Deno). Deploy with `--no-verify-jwt` so the function handles auth internally.

Pipeline:

1. Read `Authorization` header; build Supabase client with that JWT.
2. `supabase.auth.getUser()` to verify; return 401 if missing.
3. Resolve range (`'7'|'30'|'90'|'custom'`); return 400 on invalid input.
4. SELECT `journals` rows in `[start, end]` for the authenticated user (RLS enforced).
5. Build PDF with `pdf-lib` (Helvetica + bold, WinAnsi safe text, paginated).
6. Branch on `body.mode`:
   - **`'download'`** (default when explicitly requested): return raw PDF bytes with `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="mindscribe-journal-YYYY-MM-DD.pdf"`, and `X-Entry-Count` header. No zip, no email.
   - **`'email'`** (default when unset): zip the PDF as `journal.pdf` inside `journal-export.zip` with `jszip`, POST to Resend with ZIP attached as base64, return JSON `{ success: true, entryCount, email }`.

CORS exposes `X-Entry-Count` and `Content-Disposition` via `Access-Control-Expose-Headers` so the browser fetch can read them. Empty range returns JSON `{ success: true, entryCount: 0 }` for both modes (download path won't serve a binary for zero entries).

---

## Dead code removed

`src/utils/storage.js`, `src/services/elevenLabsService.js`, `src/hooks/useTextToSpeech.js`, `src/components/CheckInModal.jsx` (replaced by `DailyCheckIn.jsx`), and the `generateWeeklySummary` alias in `llmService.js` have all been deleted.

---

## Security checklist for changes

1. Never put `service_role` key or other server secrets in `src/` or committed `.env`.
2. Keep DB inserts free of manual `user_id` (let the column default use `auth.uid()`).
3. New Supabase calls should assume a logged-in user; the app is auth-gated at the router level.
4. Edge Functions handle their own JWT verification with `--no-verify-jwt`; internal `getUser()` check still enforces auth.

---

## Commands

| Command | Meaning |
|---------|---------|
| `npm run dev` | Dev server (port 5173) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve production build locally |
| `supabase functions deploy export-journal --no-verify-jwt` | Deploy export Edge Function |
| `supabase functions deploy llm-proxy --no-verify-jwt` | Deploy LLM proxy Edge Function |
| `supabase secrets set LLM_PROVIDER=claude` | Set active LLM provider |
| `supabase secrets set CLAUDE_API_KEY=sk-ant-...` | Set Anthropic key (server-only) |
| `supabase secrets set OPENAI_API_KEY=sk-proj-...` | Set OpenAI key (server-only) |
| `supabase secrets set KEY=value` | Set any other Edge Function secret |

---

## File map

| Path | Role |
|------|------|
| `App.jsx` | Auth gate + page switch |
| `main.jsx` | Provider root: Theme > Auth > Journal |
| `context/ThemeContext.jsx` | Light/dark theme |
| `context/AuthContext.jsx` | Supabase session |
| `context/JournalContext.jsx` | Navigation + entries state + pagination (`hasMore`, `fetchMoreEntries`) |
| `pages/AuthPage.jsx` | Login / signup |
| `pages/Home.jsx` | Main feed, search, Ask, daily check-in, infinite scroll |
| `pages/Recording.jsx` | Voice recording |
| `pages/Results.jsx` | Entry read-back + edit + save |
| `pages/WeeklyInsights.jsx` | Trends, AI period summary |
| `components/DailyCheckIn.jsx` | Inline daily mood picker |
| `components/AskYourself.jsx` | Ask past self panel (first-person LLM reply) |
| `components/StreakBadge.jsx` | 🔥 N-day streak chip |
| `components/PatternEngine.jsx` | Insights — recurring patterns (LLM) |
| `components/HighlightsOfMonth.jsx` | Insights — last 30 days of highlights (local) |
| `components/ExportModal.jsx` | Email export UI |
| `components/ThemeToggle.jsx` | Sun/moon toggle button |
| `utils/helpers.js` | Emotion colors, `countEmotions`, `formatDate`, `calculateStreak` |
| `services/supabaseClient.js` | Supabase singleton |
| `services/supabaseService.js` | All DB CRUD functions (paginated `getAllJournals`) |
| `services/llmService.js` | All LLM calls — routed through llm-proxy Edge Function |
| `hooks/useDebounce.js` | Debounce utility |
| `hooks/useSpeechRecognition.js` | Web Speech API wrapper |
| `supabase/functions/export-journal/index.ts` | Edge Function: PDF + ZIP + email |
| `supabase/functions/llm-proxy/index.ts` | Edge Function: LLM proxy (Claude/OpenAI, keys server-only, retry, prompt caching) |
