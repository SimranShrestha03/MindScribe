import { useMemo } from 'react';

function formatShort(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function HighlightsOfMonth({ entries }) {
  const highlights = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    return entries
      .filter((e) => {
        if (!e.highlight || !e.highlight.trim()) return false;
        const d = new Date(e.date || e.created_at);
        return d >= cutoff;
      })
      .sort((a, b) => (b.highlight?.length || 0) - (a.highlight?.length || 0))
      .slice(0, 10);
  }, [entries]);

  if (highlights.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        ✨ Highlights This Month
      </p>
      <ul className="space-y-3">
        {highlights.map((e) => (
          <li
            key={e.id}
            className="flex gap-3 border-b border-slate-800 pb-3 last:border-0 last:pb-0"
          >
            <span className="text-xs text-slate-500 shrink-0 w-12 pt-0.5">
              {formatShort(e.date || e.created_at)}
            </span>
            <p className="text-sm text-slate-300 leading-relaxed">{e.highlight}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
