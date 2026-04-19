import { useState } from 'react';
import { useJournal } from '../context/JournalContext';
import { processTranscription } from '../services/llmService';
import { Button } from './Button';
import { LoadingSpinner } from './LoadingSpinner';

const CATEGORIES = [
  { value: 'journal', label: 'Journal', emoji: '📓' },
  { value: 'idea', label: 'Idea', emoji: '💡' },
  { value: 'dream', label: 'Dream', emoji: '🌙' },
  { value: 'goal', label: 'Goal', emoji: '🎯' },
  { value: 'memory', label: 'Memories', emoji: '🧠' },
  { value: 'favorite', label: 'Favorite', emoji: '⭐' },
];

export function AddEntryModal({ onClose }) {
  const { navigate, setCurrentEntry, setPendingCategory, pendingCategory, pendingMood } = useJournal();

  const [category, setCategory] = useState(pendingCategory || 'journal');
  const [mode, setMode] = useState('speak');
  const [writtenText, setWrittenText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState(null);

  const handleSpeak = () => {
    setPendingCategory(category);
    onClose();
    navigate('recording');
  };

  const handleWrite = async () => {
    if (!writtenText.trim()) return;
    setIsProcessing(true);
    setProcessError(null);
    try {
      const result = await processTranscription(writtenText.trim(), { mood: pendingMood });
      setCurrentEntry({ user_text: writtenText.trim(), type: category, ...result });
      onClose();
      navigate('results');
    } catch (err) {
      console.error(err);
      setProcessError('Failed to process entry. Please try again.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 z-10">
        {/* Handle bar */}
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mb-6 sm:hidden" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white">New Entry</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Category</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {CATEGORIES.map(({ value, label, emoji }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-sm transition-all ${
                category === value
                  ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                  : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
              }`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* Input mode toggle */}
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Input</p>
        <div className="flex gap-2 mb-5">
          {[
            { value: 'speak', label: '🎤 Speak' },
            { value: 'write', label: '✍️ Write' },
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setMode(value)}
              className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                mode === value
                  ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                  : 'border-slate-800 bg-slate-800/50 text-slate-400 hover:border-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Write textarea */}
        {mode === 'write' && (
          <textarea
            value={writtenText}
            onChange={(e) => setWrittenText(e.target.value)}
            placeholder="Write your thoughts freely..."
            rows={4}
            autoFocus
            className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-slate-200 text-sm leading-relaxed resize-none focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600 mb-4"
          />
        )}

        {processError && (
          <p className="text-red-400 text-sm mb-4">{processError}</p>
        )}

        {isProcessing ? (
          <div className="py-2">
            <LoadingSpinner message="Analysing your thoughts..." />
          </div>
        ) : mode === 'speak' ? (
          <Button variant="primary" onClick={handleSpeak} className="w-full">
            Start Recording
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleWrite}
            disabled={!writtenText.trim()}
            className="w-full"
          >
            Process Entry
          </Button>
        )}
      </div>
    </div>
  );
}
