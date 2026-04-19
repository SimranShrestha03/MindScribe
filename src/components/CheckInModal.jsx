import { useState } from 'react';

const MOODS = [
  { emoji: '😞', label: 'Rough', value: 'rough' },
  { emoji: '😐', label: 'Okay', value: 'okay' },
  { emoji: '🙂', label: 'Good', value: 'good' },
  { emoji: '😄', label: 'Great', value: 'great' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function CheckInModal({ onSelect, onDismiss }) {
  const [selected, setSelected] = useState(null);

  const handleSelect = (value) => {
    setSelected(value);
    setTimeout(() => onSelect(value), 280);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onDismiss} />

      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 z-10 text-center fade-up">
        <div className="text-4xl mb-4">
          {new Date().getHours() < 12 ? '🌤️' : new Date().getHours() < 17 ? '☀️' : '🌙'}
        </div>
        <h2 className="text-xl font-bold text-white mb-1">{getGreeting()}</h2>
        <p className="text-slate-400 text-sm mb-8">How are you feeling today?</p>

        <div className="grid grid-cols-4 gap-2 mb-8">
          {MOODS.map(({ emoji, label, value }) => (
            <button
              key={value}
              onClick={() => handleSelect(value)}
              className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all duration-200 ${
                selected === value
                  ? 'border-violet-500 bg-violet-900/40 scale-105'
                  : 'border-slate-800 bg-slate-800/50 hover:border-slate-700 hover:bg-slate-800'
              }`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-slate-400 font-medium">{label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="text-slate-600 hover:text-slate-400 text-sm transition-colors"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
