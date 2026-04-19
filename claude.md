# MindScribe: reference for assistants and developers

Single-document overview of architecture, auth, data, and files. The app is a React + Vite SPA with no custom backend server: the database and auth are hosted Supabase.

---

## Purpose

MindScribe helps users journal by **voice** (Web Speech API) or **text**. An LLM turns raw input into structured fields: summary, emotions, highlight, feedback. Data lives in **Supabase Postgres** behind **Supabase Auth** (email/password) and **RLS** so users only access their own rows.

---

## Runtime stack

| Piece | Detail |
|-------|--------|
| UI | React 18, functional components |
| Styles | Tailwind CSS 3 |
| Bundler | Vite 4 |
| Database + auth | Supabase (`@supabase/supabase-js`), anon key in browser only |
| LLM | OpenAI or Anthropic via `src/services/llmService.js`, `VITE_LLM_PROVIDER` |

---

## Environment variables (must be prefixed `VITE_`)

| Variable | Role |
|----------|------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable anon key (never service_role in frontend) |
| `VITE_LLM_PROVIDER` | `openai` or `claude` |
| `VITE_OPENAI_API_KEY` | OpenAI key when provider is openai |
| `VITE_CLAUDE_API_KEY` | Anthropic key when provider is claude |

Optional Conda users can install Node via `environment.yml`, then run `npm install`.

---

## Entry point and providers

File: `src/main.jsx`

Wrap order (outer to inner):

1. **`ThemeProvider`** (`src/context/ThemeContext.jsx`): `theme` ('dark' | 'light'), `toggleTheme`. Persists to `localStorage` key `mindscribe_theme`. Sets `data-theme` attribute and matching class (`dark` / `light`) on `<html>`.
2. **`AuthProvider`** (`src/context/AuthContext.jsx`): Loads session with `supabase.auth.getSession()`, subscribes to `onAuthStateChange`. Exposes `user`, `loading`, `signUp`, `signIn`, `signOut`.
3. **`JournalProvider`** (`src/context/JournalContext.jsx`): Page routing state, journal entries cache, Supabase helpers.

`index.html` runs a tiny pre-React script that reads the stored theme and sets `data-theme` and the matching class on `<html>` before React hydrates, so there is no flash on reload.

---

## Routing (no React Router)

`JournalContext` holds `page`, one of: `home`, `recording`, `results`, `insights`.

`App.jsx`:

- While auth `loading`: show `LoadingSpinner`.
- If no `user`: render **only** `AuthPage` (main app pages are not mounted; avoids unauthenticated Supabase calls).
- If `user`: map `page` to `Home`, `Recording`, `Results`, or `WeeklyInsights`.

Navigation: `navigate('home')` etc. from context.

---

## Authentication UI

File: `src/pages/AuthPage.jsx`

- Toggle between **Login** and **Sign Up**.
- Fields: email, password. Client validation: email shape, password length >= 6.
- Uses `supabase.auth.signInWithPassword` and `signUp`. Shows Supabase errors and loading on submit.
- If email confirmation is required and signup returns no session, user sees a message to check email.

---

## Journal context

File: `src/context/JournalContext.jsx`

**State:** `page`, `navigate`, `currentEntry`, `setCurrentEntry`, `entries`, `pendingCategory`, `setPendingCategory`, `pendingMood`, `setPendingMood`, `autoEditMode`, `setAutoEditMode`.

**Persistence helpers:** `saveEntry`, `updateEntry`, `deleteEntry`, `fetchEntries`, `fetchEntriesByRange`.

**Important:** When `user?.id` changes (login, logout, account switch), an effect resets: `page` to `home`, clears `entries`, `currentEntry`, pending category/mood, `autoEditMode`. Prevents cross-user data leaks in memory.

**saveEntry:** If there is no `user`, throws an error asking the user to log in (defense in depth; gate normally prevents this).

---

## Supabase client and services

**Client:** `src/services/supabaseClient.js` calls `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`.

**Service:** `src/services/supabaseService.js`

| Function | Behavior |
|----------|----------|
| `saveJournal` | Insert into `journals`. Does **not** set `user_id`; DB default `auth.uid()` applies. |
| `updateJournal` | Update by `id`. |
| `deleteJournal` | Delete by `id`. |
| `getAllJournals` | Select all for current user (RLS scoped). |
| `getJournalsByDateRange` | `created_at >= startDate`, ordered newest first. |
| `saveInsightRecord` | Insert into `insights` (period summary save from Weekly Insights). |

---

## Database expectations (conceptual)

- Tables such as **`journals`** and **`insights`** include **`user_id`** with RLS policies like `auth.uid() = user_id`.
- Insert payloads from the app omit `user_id` when the column default is `auth.uid()`.

---

## Pages (behavior summary)

### Home (`src/pages/Home.jsx`)

Header: title, date, **ThemeToggle**, **Export** (opens `ExportModal`), **Insights** button, **Logout** (`signOut`). Search filters by `ai_summary`. Six category cards (including Favorites via `is_favorite`). Entry list with menu: edit, favourite toggle, delete. Loads entries with `fetchEntries` on mount. Daily check-in modal uses `localStorage` key `mindscribe_checkin_date`. FAB opens Add Entry modal.

### Add Entry modal (`src/components/AddEntryModal.jsx`)

Pick category; **Speak** closes modal and goes to Recording; **Write** uses textarea then `processTranscription` and navigates to Results.

### Recording (`src/pages/Recording.jsx`)

Requires Web Speech API. Live transcript; on stop, runs `processTranscription` with optional `pendingMood`, sets `currentEntry`, clears mood, navigates to Results.

### Results (`src/pages/Results.jsx`)

Sections: My Words, AI Summary, Highlight, Emotions, Feedback. Edit mode; Save inserts or updates Supabase; favourite star uses `updateEntry` when already saved.

### Weekly Insights (`src/pages/WeeklyInsights.jsx`)

Tabs: Today, 7 / 10 / 30 days. Fetches via `fetchEntriesByRange`. Mood bars, stats, recent entries. **Generate AI Summary** calls `generatePeriodSummary`. **Save Insights** calls `saveInsightRecord`. Header includes **ThemeToggle** and **Logout**.

### Export modal (`src/components/ExportModal.jsx`)

Range select (`7`, `30`, `90`, `custom`); custom mode shows two `<input type="date">` fields. On submit calls `supabase.functions.invoke('export-journal', { body })`. States: `idle`, `submitting`, `success`, `error`. Shows backend `entryCount` and the user email on success; surfaces a friendly message when no entries match.

### Theme (`src/context/ThemeContext.jsx`, `src/components/ThemeToggle.jsx`)

`ThemeToggle` is a small icon button (sun in dark mode, moon in light mode) shown on Home, Insights, and AuthPage headers. Toggling flips `data-theme` between `dark` and `light` and persists via `localStorage`. Light mode is achieved with overrides in `src/styles/globals.css` under `[data-theme='light']` that remap the slate utility classes used by the app: no markup changes needed elsewhere.

---

## AI layer

File: `src/services/llmService.js`

- `processTranscription(userText, { mood })` returns `ai_summary`, `emotions`, `feedback`, `highlight`. Does not rewrite user wording in the stored raw text path; structured fields are model output.
- `generatePeriodSummary(entries)` returns `weeklyReflection`, `patternInsight`, `suggestion` for the Insights screen.

Provider and model names are configured in code and env.

---

## Shared UI and utilities

- `src/components/Button.jsx`: variants include loading spinner.
- `src/components/EmotionTag.jsx`, `MoodBar.jsx`, `LoadingSpinner.jsx`, `ThemeToggle.jsx`, modals (`AddEntryModal`, `CheckInModal`, `ExportModal`) under `components/`.
- `src/utils/helpers.js`: dates, emotion counts, colors for charts and tags.

## Edge Function: `export-journal`

Path: `supabase/functions/export-journal/index.ts` (Deno).

Pipeline:

1. Read `Authorization` header; create a Supabase client with that JWT (RLS scoped to caller).
2. `supabase.auth.getUser()` to verify; reject 401 if missing.
3. Resolve `range` (`'7'|'30'|'90'`) or `'custom'` with `startDate`/`endDate` (ISO `YYYY-MM-DD`); reject 400 on invalid input.
4. SELECT `journals` rows in `[start, end]`, ascending by `created_at`.
5. Build a paginated PDF with `pdf-lib` (Helvetica + bold), wrapping text per page width; sanitize text to WinAnsi to avoid font errors.
6. Zip as `journal.pdf` inside `journal-export.zip` with `jszip`.
7. POST to Resend `/emails` with the ZIP attached as base64. Subject: "Your MindScribe Journal Export".

Required secrets on the project: `RESEND_API_KEY`, `RESEND_FROM`. `SUPABASE_URL` and `SUPABASE_ANON_KEY` are auto-injected.

Response:

```json
{ "success": true, "entryCount": 12, "email": "user@example.com" }
```

Empty range returns `entryCount: 0`; the modal surfaces this as "No entries found in that date range."

---

## Dead code removed

The following files were previously noted as unused and have been deleted from the repo: `src/utils/storage.js`, `src/services/elevenLabsService.js`, `src/hooks/useTextToSpeech.js`, `src/components/CheckInModal.jsx` (replaced by `DailyCheckIn.jsx`). The legacy `generateWeeklySummary` alias in `llmService.js` was also removed.

---

## Security checklist for changes

1. Never add **service_role** or other secrets meant for servers into `src/` or `.env` committed to git.
2. Keep inserts free of manual `user_id` unless there is a deliberate exception and RLS allows it.
3. Any new Supabase calls should assume **logged-in** users unless explicitly designed for anon.

---

## Commands

| Command | Meaning |
|---------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run preview` | Serve built assets |

---

## File map (quick)

| Path | Role |
|------|------|
| `App.jsx` | Auth gate + page switch |
| `main.jsx` | Providers root |
| `context/ThemeContext.jsx` | Light / dark theme |
| `context/AuthContext.jsx` | Session |
| `context/JournalContext.jsx` | Navigation + journals state |
| `pages/AuthPage.jsx` | Login / signup |
| `pages/Home.jsx`, `Recording.jsx`, `Results.jsx`, `WeeklyInsights.jsx` | Main UX |
| `components/ExportModal.jsx`, `ThemeToggle.jsx` | Export and theme UI |
| `services/supabaseClient.js` | Supabase singleton |
| `services/supabaseService.js` | DB operations |
| `services/llmService.js` | LLM calls |
| `supabase/functions/export-journal/index.ts` | Edge Function: PDF + ZIP + Resend email |

This file should stay aligned when you add major features so assistants can answer without scanning the entire tree every time.
