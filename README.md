# MindScribe

**Speak your thoughts. Understand yourself.**

MindScribe is a voice and text journaling app that turns what you say or write into structured reflections: an AI summary, emotion tags, a highlight line, and short supportive feedback. Entries and weekly insights are stored in **Supabase** with **email/password auth** and row-level security so each user only sees their own data.

---

## Why MindScribe?

Many people struggle to process thoughts and emotions after stressful or meaningful events. Traditional journaling takes effort and the right words, which is hard when you are overwhelmed.

MindScribe lowers friction: speak or write, then review a structured reflection and emotional readout. Optional **Weekly Insights** summarizes patterns across your saved entries.

---

## Features

- **Authentication:** Login and sign up on one screen (email + password). Session handled by Supabase Auth; the main app only loads after sign-in.
- **Voice input:** Record using the browser Web Speech API (Chrome or Edge).
- **Text input:** Write an entry from the Add Entry modal without visiting the recording screen.
- **AI structuring:** Transcription or text is turned into `ai_summary`, `emotions`, `feedback`, and `highlight` via OpenAI or Claude (configurable).
- **Results page:** Read back your words, summary, highlight, emotions, and feedback; edit fields; save or update in Supabase; mark favourites.
- **Home:** Search (by summary text), category filters, entry cards with edit / favourite / delete, daily check-in modal, link to Insights, **Logout**.
- **Weekly Insights:** Date ranges (today, 7 / 10 / 30 days), mood distribution, recent entries, on-demand AI period summary, optional save of insight rows to Supabase.
- **Security model:** Frontend uses only the **anon** Supabase key. Tables use RLS with `user_id` defaulting from `auth.uid()`; inserts do not manually set `user_id` in app code.

---

## Tech stack

| Layer        | Choice |
|--------------|--------|
| UI           | React 18 (hooks) |
| Styling      | Tailwind CSS 3 |
| Build        | Vite 4 |
| Speech (STT) | Web Speech API (Chrome / Edge) |
| AI / LLM     | OpenAI or Anthropic Claude (`VITE_LLM_PROVIDER`) |
| Auth + DB    | Supabase Auth + PostgreSQL (`@supabase/supabase-js`) |

---

## Prerequisites

- **Node.js 18+** (see `environment.yml` if you use Conda)
- **Chrome or Edge** for voice recording (Web Speech API)
- A **Supabase** project with `journals` and `insights` tables, RLS, and policies tied to `auth.uid()`
- An **OpenAI** and/or **Anthropic** API key for AI features

---

## Setup

```bash
git clone https://github.com/your-username/mindscribe.git
cd mindscribe

# Optional: Conda users
# conda env create -f environment.yml && conda activate mindscribe

npm install
```

Create a `.env` file at the project root (see **Environment variables**). **Never commit `.env`**; it is listed in `.gitignore`.

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in **Chrome or Edge**.

---

## Environment variables

All client-side variables must use the `VITE_` prefix.

```env
# Supabase (required for auth and persistence)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key

# LLM: openai or claude
VITE_LLM_PROVIDER=openai
VITE_OPENAI_API_KEY=your_openai_key
VITE_CLAUDE_API_KEY=your_claude_key
```

Use the **anon** key in the app only. Do **not** embed the service role key in frontend code.

---

## How to run locally

```bash
npm run dev      # Dev server with HMR (default port 5173)
npm run build    # Production build to dist/
npm run preview  # Preview the production build
```

---

## Typical flow

1. Open the app and **sign up** or **log in**.
2. On **Home**, optionally complete the daily check-in, then add an entry (voice or text).
3. On **Results**, review AI output, edit if needed, **Save Entry** (persists to `journals`).
4. Open **Insights** for range stats and **Generate AI Summary**; optionally **Save Insights** (writes to `insights`).

---

## Project structure

```
src/
├── App.jsx                 # Auth gate + page router
├── main.jsx                # Root: AuthProvider > JournalProvider > App
├── context/
│   ├── AuthContext.jsx     # User session, signUp / signIn / signOut
│   └── JournalContext.jsx  # Page state, entries, Supabase helpers
├── pages/
│   ├── AuthPage.jsx        # Login / sign up
│   ├── Home.jsx
│   ├── Recording.jsx
│   ├── Results.jsx
│   └── WeeklyInsights.jsx
├── components/             # Button, modals, tags, charts, etc.
├── services/
│   ├── supabaseClient.js
│   ├── supabaseService.js  # journals + insights CRUD
│   └── llmService.js       # OpenAI / Claude
├── hooks/
├── utils/
└── styles/
```

---

## Limitations

- Voice features need **Chrome or Edge** (Firefox lacks the needed Speech API support).
- LLM output is interpretive, not clinical or diagnostic.
- Production sites need HTTPS for secure cookies and APIs (localhost is fine for development).

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Future ideas

- Export journal as PDF or Markdown
- PWA and offline-friendly caching
- Push notifications or gentle reminders
- Broader language support in speech and prompts
