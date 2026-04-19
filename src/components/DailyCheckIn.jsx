const MOODS = [
  { emoji: '😞', label: 'Rough',  value: 'rough' },
  { emoji: '😐', label: 'Okay',   value: 'okay'  },
  { emoji: '🙂', label: 'Good',   value: 'good'  },
  { emoji: '😄', label: 'Great',  value: 'great' },
];

export function DailyCheckIn({ onSelectMood, onSkip }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 fade-up">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-300">How are you feeling today?</p>
        <button
          onClick={onSkip}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MOODS.map(({ emoji, label, value }) => (
          <button
            key={value}
            onClick={() => onSelectMood(value)}
            className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-slate-800 bg-slate-800/50 hover:border-violet-600/60 hover:bg-violet-900/20 transition-all duration-150 active:scale-95"
          >
            <span className="text-2xl">{emoji}</span>
            <span className="text-xs text-slate-500 font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
