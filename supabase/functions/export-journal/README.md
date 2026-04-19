# export-journal Edge Function

Authenticates the caller, fetches their `journals` rows in the requested
date range, generates a PDF, zips it, and emails it via Resend.

## Deploy

```bash
# 1. Link your local repo to your Supabase project (one-time):
supabase link --project-ref <your-project-ref>

# 2. Set required secrets:
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM='MindScribe <noreply@yourdomain.com>'

# 3. Deploy the function (verify_jwt stays on so RLS works):
supabase functions deploy export-journal
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically by the
Edge Functions runtime.

## Invoke from the browser

```js
await supabase.functions.invoke('export-journal', {
  body: { range: '7' }              // or '30', '90'
});

await supabase.functions.invoke('export-journal', {
  body: { range: 'custom', startDate: '2026-04-01', endDate: '2026-04-19' }
});
```

The user's JWT is forwarded automatically; the database client inside the
function uses it, so RLS scopes the SELECT to the calling user only.

## Response shape

```json
{ "success": true, "entryCount": 12, "email": "user@example.com" }
```

If there are no rows in range:

```json
{ "success": true, "entryCount": 0, "message": "No entries to export in that range." }
```

Errors return `{ "error": "..." }` with a non-2xx status code.

## Notes

- PDF text is sanitized to WinAnsi so `pdf-lib`'s `Helvetica` can render
  arbitrary user input safely (smart quotes / em dashes / unicode chars
  collapse to ASCII equivalents).
- The ZIP contains `journal.pdf` only; structure is intentionally simple
  so additional artifacts can be added later.
- Resend free-tier sandbox: if you do not have a verified domain, set
  `RESEND_FROM` to `onboarding@resend.dev` and Resend will only deliver
  to your verified test address.
