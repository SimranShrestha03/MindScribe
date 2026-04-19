import { useState, useMemo } from 'react';
import { generateMonthlyHighlightsSummary } from '../services/llmService';

export function HighlightsOfMonth({ entries }) {
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const hasHighlights = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return entries.some((e) => {
      if (!e.highlight?.trim()) return false;
      const d = new Date(e.date || e.created_at);
      return d >= cutoff;
    });
  }, [entries]);

  if (!hasHighlights) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMonthlyHighlightsSummary(entries);
      setSummary(result);
    } catch (err) {
      setError(err?.message || 'Failed to generate highlights');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          ✨ Highlights This Month
        </p>
        {summary && !loading && (
          <button
            onClick={handleGenerate}
            className="text-xs text-slate-500 hover:text-violet-400 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {!summary && !loading && (
        <>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Let AI read your best moments from the past 30 days and distill them into a short reflection.
          </p>
          <button
            onClick={handleGenerate}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-amber-600/70 to-orange-600/70 hover:from-amber-500/80 hover:to-orange-500/80 text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98]"
          >
            Distill my highlights
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-2">
          <span className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Reading your month...</p>
        </div>
      )}

      {summary && !loading && (
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">{summary}</p>
      )}

      {error && (
        <p className="mt-3 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
