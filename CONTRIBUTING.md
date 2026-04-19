# Contributing to MindScribe

Thank you for your interest in contributing. MindScribe is a hackathon-born project and we welcome improvements of all kinds: bug fixes, features, design polish, and documentation.

---

## Getting started

```bash
git clone https://github.com/your-username/mindscribe.git
cd mindscribe
npm install
```

Create a `.env` file at the project root with your Supabase URL and anon key, plus LLM keys if you work on AI features. Do not commit `.env`.

Optional Conda workflow:

```bash
conda env create -f environment.yml
conda activate mindscribe
npm install
```

Open Chrome or Edge at [http://localhost:5173](http://localhost:5173).

### Working with auth and Supabase

- Use a **development** Supabase project or a dedicated schema; never commit real user data or **service role** keys.
- To verify auth-related changes: sign up a test user, confirm you only see your own rows under RLS, then test **Logout** and ensure the app returns to the login screen and lists clear.

### Working on Edge Functions

- Code lives under `supabase/functions/<name>/`. The Deno runtime is used (`https://esm.sh/...` imports).
- Set required server secrets with `supabase secrets set KEY=value`; never put them in `.env` or commit them.
- Deploy with `supabase functions deploy <name>`. For `export-journal`, you also need `RESEND_API_KEY` and `RESEND_FROM` configured.

### Theming

- Components keep using the existing dark slate utility classes; the light theme is applied via global overrides in `src/styles/globals.css` under `[data-theme='light']`. Avoid adding inline color values when a slate utility already exists.

---

## Branch naming

| Type       | Pattern                        | Example                      |
|------------|--------------------------------|------------------------------|
| Feature    | `feat/<short-description>`     | `feat/export-to-pdf`       |
| Bug fix    | `fix/<short-description>`      | `fix/speech-api-edge-case` |
| Refactor   | `refactor/<short-description>` | `refactor/llm-parse-helper`|
| Docs       | `docs/<short-description>`   | `docs/update-readme-setup` |
| Chore/deps | `chore/<short-description>`  | `chore/upgrade-tailwind-v4`|

Always branch from `main`.

---

## Commit message style

Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec:

```
<type>(<scope>): <short summary>

[optional body: explain why, not what]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

**Examples:**

```
feat(auth): remember redirect after email confirmation
fix(insights): handle empty range without throwing
docs(readme): document Supabase env vars
```

Keep the summary line under 72 characters. Use the body for non-obvious context.

---

## Code guidelines

- **React:** Functional components only; no class components.
- **Hooks:** Custom hooks live in `src/hooks/`; keep them single-purpose.
- **Services:** External API calls go in `src/services/`; avoid raw `fetch` in presentational components when a service already exists.
- **No comments on obvious code:** Comment only when the *why* is non-obvious (constraint, workaround, invariant).
- **No dead code:** Remove unused imports and commented-out blocks before opening a PR.
- **Tailwind:** Prefer utility classes; avoid inline `style` except for dynamic values Tailwind cannot express.
- **Accessibility:** Visible focus styles; interactive controls need labels where helpful.
- **Errors:** Prefer user-visible error state; avoid relying on `console.error` alone for failures the user should know about.

---

## Pull request process

1. Open an issue first for non-trivial changes so scope stays aligned.
2. Work on a named feature branch.
3. Manually test the main flows in Chrome or Edge (auth, home list, save entry, insights).
4. Keep PRs focused: one logical change per PR.
5. Describe **what** changed and **why**; add screenshots or short clips for UI changes; list any new environment variables.
6. Request review and iterate on feedback.
7. Merges use **squash merge** when possible to keep history readable.

---

## Areas to contribute

- **New emotion visuals:** Extend `getEmotionColor` / `getEmotionBarColor` in `src/utils/helpers.js`.
- **LLM providers:** Extend `src/services/llmService.js` with additional backends if desired.
- **Guided prompts:** Optional prompts on Recording or Home.
- **PWA:** Service worker and web app manifest.
- **i18n:** Speech language and prompt language options.

---

## Questions?

Open a GitHub Discussion or file an issue on the repository.
