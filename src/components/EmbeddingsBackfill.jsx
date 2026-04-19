import { useEffect, useState, useRef } from 'react';
import { getEntriesMissingEmbeddings, setEntryEmbedding } from '../services/supabaseService';
import { embedText } from '../services/llmService';

function embeddingTextFor(row) {
  return [row.ai_summary, row.highlight, row.user_text].filter(Boolean).join('\n\n');
}

export function EmbeddingsBackfill() {
  const [missingCount, setMissingCount] = useState(null);
  const [running, setRunning] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [failed, setFailed] = useState(0);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const cancelRef = useRef(false);

  const loadCount = async () => {
    try {
      const rows = await getEntriesMissingEmbeddings();
      setMissingCount(rows.length);
    } catch (e) {
      setError(e?.message || 'Failed to count entries');
    }
  };

  useEffect(() => {
    loadCount();
    return () => { cancelRef.current = true; };
  }, []);

  const handleRun = async () => {
    setError(null);
    setRunning(true);
    setProcessed(0);
    setFailed(0);
    setDone(false);
    cancelRef.current = false;

    try {
      const rows = await getEntriesMissingEmbeddings();

      for (const row of rows) {
        if (cancelRef.current) break;

        const text = embeddingTextFor(row);
        if (!text) {
          setFailed((n) => n + 1);
          continue;
        }

        try {
          const vec = await embedText(text);
          if (vec) await setEntryEmbedding(row.id, vec);
          setProcessed((n) => n + 1);
        } catch (e) {
          console.warn('[backfill] entry', row.id, 'failed:', e?.message);
          setFailed((n) => n + 1);
        }

        // Gentle throttle — avoids hammering the proxy/provider on large backfills.
        await new Promise((r) => setTimeout(r, 100));
      }

      setDone(true);
      await loadCount();
    } catch (e) {
      setError(e?.message || 'Backfill failed');
    } finally {
      setRunning(false);
    }
  };

  const handleCancel = () => {
    cancelRef.current = true;
  };

  if (missingCount === null) return null;
  if (missingCount === 0 && !done) return null; // nothing to do, nothing to show

  const total = missingCount;
  const progress = total > 0 ? Math.round(((processed + failed) / total) * 100) : 100;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
        🧬 Semantic Search Backfill
      </p>

      {done && missingCount === 0 ? (
        <p className="text-sm text-emerald-400">
          All entries are embedded. Ask will use semantic search across your full history.
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            {running
              ? `Embedding entries... ${processed + failed} / ${total}`
              : `${missingCount} ${missingCount === 1 ? 'entry is' : 'entries are'} missing semantic embeddings. Older entries will still show up in keyword fallback, but Ask works better once they're embedded.`}
          </p>

          {running && (
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {failed > 0 && (
            <p className="text-xs text-amber-400 mb-3">
              {failed} entr{failed === 1 ? 'y' : 'ies'} skipped (missing text or API error).
            </p>
          )}

          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={handleRun}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98]"
              >
                Rebuild embeddings
              </button>
            ) : (
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold rounded-xl transition-colors"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <p className="mt-3 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
