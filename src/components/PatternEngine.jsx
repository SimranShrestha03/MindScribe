import { useState } from 'react';
import { generatePatterns } from '../services/llmService';

export function PatternEngine({ entries }) {
  const [patterns, setPatterns] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const enoughData = entries.filter((e) => e.ai_summary).length >= 3;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generatePatterns(entries);
      setPatterns(result.patterns);
    } catch (err) {
      setError(err?.message || 'Failed to generate patterns');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          🧠 Your Patterns
        </p>
        {patterns && !loading && (
          <button
            onClick={handleGenerate}
            className="text-xs text-slate-500 hover:text-violet-400 transition-colors"
          >
            Refresh
          </button>
        )}
      </div>

      {!patterns && !loading && (
        <>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Surface recurring emotional trends, triggers, and recovery patterns across your entries.
          </p>
          <button
            onClick={handleGenerate}
            disabled={!enoughData}
            className="w-full px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-[.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enoughData ? 'Find patterns' : 'Write a few more entries to unlock'}
          </button>
        </>
      )}

      {loading && (
        <div className="flex items-center gap-3 py-2">
          <span className="w-4 h-4 border-2 border-violet-400/30 border-t-violet-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Reading your entries...</p>
        </div>
      )}

      {patterns && patterns.length > 0 && !loading && (
        <ul className="space-y-3">
          {patterns.map((p, i) => (
            <li
              key={i}
              className="flex gap-3 bg-gradient-to-br from-violet-900/15 to-indigo-900/15 border border-violet-700/20 rounded-xl p-4"
            >
              <span className="text-violet-400 text-sm font-bold shrink-0">{i + 1}.</span>
              <p className="text-sm text-slate-300 leading-relaxed">{p}</p>
            </li>
          ))}
        </ul>
      )}

      {patterns && patterns.length === 0 && !loading && (
        <p className="text-sm text-slate-500">
          Not enough signal yet. Keep writing and try again.
        </p>
      )}

      {error && (
        <p className="mt-3 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}
