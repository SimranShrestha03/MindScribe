import { useState, useRef, useEffect } from 'react';
import { askPastSelf } from '../services/llmService';

const SUGGESTIONS = [
  'How was I feeling last week?',
  'What patterns show up in my emotions?',
  'How did I feel last month?',
  'What have I been stressed about?',
];

export function AskYourself({ entries }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer]     = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const inputRef     = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Dismiss answer when the user clicks outside the component
  useEffect(() => {
    if (!answer) return;
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setAnswer(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [answer]);

  const handleAsk = async (q = question) => {
    const trimmed = q.trim();
    if (!trimmed) return;

    setQuestion(trimmed);
    setAnswer(null);
    setError(null);
    setLoading(true);

    try {
      const result = await askPastSelf(trimmed, entries);
      setAnswer(result);
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div ref={containerRef} className="mb-6 fade-up">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
          Ask your past self
        </p>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={question}
            onChange={(e) => { setQuestion(e.target.value); setAnswer(null); setError(null); }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="How was I feeling last week?"
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600 disabled:opacity-50"
          />
          <button
            onClick={() => handleAsk()}
            disabled={loading || !question.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-semibold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {loading ? 'Thinking...' : 'Ask'}
          </button>
        </div>

        {/* Suggestion chips */}
        {!answer && !loading && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleAsk(s)}
                className="text-xs text-slate-500 bg-slate-800/60 hover:bg-slate-800 hover:text-slate-300 border border-slate-700/60 rounded-full px-2.5 py-1 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="mt-4 bg-gradient-to-br from-violet-900/20 to-indigo-900/20 border border-violet-700/25 rounded-xl p-4">
            <p className="text-slate-300 text-sm leading-relaxed">{answer}</p>
            <button
              onClick={() => { setAnswer(null); setQuestion(''); inputRef.current?.focus(); }}
              className="mt-3 text-xs text-slate-600 hover:text-slate-400 transition-colors"
            >
              Ask another question
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
