// Supabase Edge Function: export-journal
// Authenticates the caller, fetches their journal entries in the requested
// date range, builds a PDF, zips it, and emails it via Resend.
//
// Required environment variables (configure with `supabase secrets set`):
//   SUPABASE_URL                (auto-set in Edge Functions)
//   SUPABASE_ANON_KEY           (auto-set in Edge Functions)
//   RESEND_API_KEY              (your Resend key)
//   RESEND_FROM                 (e.g. "MindScribe <noreply@yourdomain.com>")
//
// Deploy:
//   supabase functions deploy export-journal --no-verify-jwt=false
//
// The function relies on Supabase Auth + RLS: the user's JWT is forwarded
// to the database client, so the SELECT only returns rows the user owns.

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFFont,
  PDFPage,
} from 'https://esm.sh/pdf-lib@1.17.1';
import JSZip from 'https://esm.sh/jszip@3.10.1';

type Range = '7' | '30' | '90' | 'custom';
type Mode = 'email' | 'download';

interface RequestBody {
  range: Range;
  startDate?: string;
  endDate?: string;
  mode?: Mode;
}

interface JournalRow {
  id: string;
  created_at: string;
  user_text: string | null;
  ai_summary: string | null;
  highlight: string | null;
  emotions: unknown;
  type: string | null;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Expose-Headers': 'X-Entry-Count, Content-Disposition',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function resolveDateRange(body: RequestBody): { start: Date; end: Date } | null {
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  if (body.range === 'custom') {
    if (!body.startDate || !body.endDate) return null;
    const start = new Date(body.startDate);
    const customEnd = new Date(body.endDate);
    if (isNaN(start.getTime()) || isNaN(customEnd.getTime())) return null;
    if (start > customEnd) return null;
    customEnd.setHours(23, 59, 59, 999);
    return { start, end: customEnd };
  }

  const days = Number(body.range);
  if (!Number.isFinite(days) || days <= 0) return null;
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  // pdf-lib's StandardFonts only support WinAnsi; strip anything else and
  // normalize a few common smart-quote / dash characters to ASCII.
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const paragraphs = sanitizeText(text).split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      const width = font.widthOfTextAtSize(next, fontSize);
      if (width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function buildPdf(entries: JournalRow[], userEmail: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageSize: [number, number] = [612, 792]; // US Letter
  const margin = 56;
  const contentWidth = pageSize[0] - margin * 2;

  let page: PDFPage = doc.addPage(pageSize);
  let cursorY = pageSize[1] - margin;

  const writeLine = (
    text: string,
    options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; spacing?: number } = {},
  ) => {
    const f = options.font ?? font;
    const size = options.size ?? 11;
    const color = options.color ?? rgb(0.1, 0.1, 0.15);
    const spacing = options.spacing ?? size * 1.4;
    const lines = wrapText(text, f, size, contentWidth);
    for (const line of lines) {
      if (cursorY - spacing < margin) {
        page = doc.addPage(pageSize);
        cursorY = pageSize[1] - margin;
      }
      page.drawText(line, { x: margin, y: cursorY, size, font: f, color });
      cursorY -= spacing;
    }
  };

  const writeGap = (px: number) => {
    cursorY -= px;
    if (cursorY < margin) {
      page = doc.addPage(pageSize);
      cursorY = pageSize[1] - margin;
    }
  };

  // Cover heading
  writeLine('MindScribe Journal Export', { font: fontBold, size: 22, color: rgb(0.34, 0.18, 0.71) });
  writeGap(6);
  writeLine(`Account: ${sanitizeText(userEmail)}`, { size: 10, color: rgb(0.35, 0.4, 0.5) });
  writeLine(`Generated: ${new Date().toLocaleString('en-US')}`, { size: 10, color: rgb(0.35, 0.4, 0.5) });
  writeLine(`Entries: ${entries.length}`, { size: 10, color: rgb(0.35, 0.4, 0.5) });
  writeGap(18);

  for (const entry of entries) {
    if (cursorY < margin + 80) {
      page = doc.addPage(pageSize);
      cursorY = pageSize[1] - margin;
    }

    writeLine(formatDate(entry.created_at), { font: fontBold, size: 13, color: rgb(0.1, 0.1, 0.2) });
    writeGap(4);

    if (entry.user_text) {
      writeLine('My Words', { font: fontBold, size: 10, color: rgb(0.34, 0.18, 0.71) });
      writeLine(entry.user_text, { size: 11 });
      writeGap(6);
    }

    if (entry.ai_summary) {
      writeLine('Summary', { font: fontBold, size: 10, color: rgb(0.34, 0.18, 0.71) });
      writeLine(entry.ai_summary, { size: 11 });
      writeGap(6);
    }

    if (entry.highlight) {
      writeLine('Highlight', { font: fontBold, size: 10, color: rgb(0.34, 0.18, 0.71) });
      writeLine(entry.highlight, { size: 11 });
      writeGap(6);
    }

    const emotions = Array.isArray(entry.emotions)
      ? (entry.emotions as unknown[]).map((e) => String(e)).filter(Boolean)
      : [];
    if (emotions.length) {
      writeLine('Emotions', { font: fontBold, size: 10, color: rgb(0.34, 0.18, 0.71) });
      writeLine(emotions.join(', '), { size: 11 });
    }

    writeGap(18);
  }

  return await doc.save();
}

async function buildZip(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file('journal.pdf', pdfBytes);
  return await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function sendEmailWithZip(
  zipBytes: Uint8Array,
  to: string,
  rangeLabel: string,
  entryCount: number,
): Promise<void> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') ?? 'MindScribe <onboarding@resend.dev>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured on the Edge Function.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your MindScribe Journal Export',
      text: `Hi,

Attached is your MindScribe journal export for ${rangeLabel}. It contains ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'} as a PDF inside a ZIP file.

If you did not request this, you can safely ignore this email.

MindScribe`,
      attachments: [
        {
          filename: 'journal-export.zip',
          content: bytesToBase64(zipBytes),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend API error (${response.status}): ${detail}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    const range = resolveDateRange(body);
    if (!range) {
      return jsonResponse({ error: 'Invalid date range' }, 400);
    }

    const { data: entries, error: dbError } = await supabase
      .from('journals')
      .select('id, created_at, user_text, ai_summary, highlight, emotions, type')
      .gte('created_at', range.start.toISOString())
      .lte('created_at', range.end.toISOString())
      .order('created_at', { ascending: true });

    if (dbError) {
      return jsonResponse({ error: `Database error: ${dbError.message}` }, 500);
    }

    const rows: JournalRow[] = entries ?? [];
    const mode: Mode = body.mode === 'download' ? 'download' : 'email';

    if (rows.length === 0) {
      return jsonResponse({
        success: true,
        entryCount: 0,
        message: 'No entries to export in that range.',
      });
    }

    const pdfBytes = await buildPdf(rows, user.email ?? 'unknown');

    if (mode === 'download') {
      const filename = `mindscribe-journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Entry-Count': String(rows.length),
        },
      });
    }

    if (!user.email) {
      return jsonResponse({ error: 'No email address on this account' }, 400);
    }

    const zipBytes = await buildZip(pdfBytes);

    const rangeLabel =
      body.range === 'custom'
        ? `${body.startDate} to ${body.endDate}`
        : `the last ${body.range} days`;

    await sendEmailWithZip(zipBytes, user.email, rangeLabel, rows.length);

    return jsonResponse({
      success: true,
      entryCount: rows.length,
      email: user.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('export-journal failed:', message);
    return jsonResponse({ error: message }, 500);
  }
});
