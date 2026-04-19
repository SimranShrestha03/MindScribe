import { useState, useEffect } from 'react';
import { useJournal } from '../context/JournalContext';
import { useAuth } from '../context/AuthContext';
import { MoodBar } from '../components/MoodBar';
import { Button } from '../components/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ThemeToggle } from '../components/ThemeToggle';
import { PatternEngine } from '../components/PatternEngine';
import { HighlightsOfMonth } from '../components/HighlightsOfMonth';
import { EmbeddingsBackfill } from '../components/EmbeddingsBackfill';
import { countEmotions } from '../utils/helpers';

const FILTERS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '10 Days', days: 10 },
  { label: '30 Days', days: 30 },
];

export function WeeklyInsights() {
  const { navigate, fetchEntriesByRange, entries: allEntries, fetchEntries } = useJournal();
  const { signOut } = useAuth();

  useEffect(() => {
    if (allEntries.length === 0) {
      fetchEntries().catch((err) => console.error(err));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const [activeDays, setActiveDays] = useState(7);
  const [rangeEntries, setRangeEntries] = useState([]);
  const [isFetching, setIsFetching] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    setIsFetching(true);
    setFetchError(null);
    fetchEntriesByRange(activeDays)
      .then(setRangeEntries)
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load data');
      })
      .finally(() => setIsFetching(false));
  }, [activeDays, fetchEntriesByRange]);

  const emotionCounts = countEmotions(rangeEntries);
  const sortedEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);
  const maxCount = sortedEmotions[0]?.[1] || 1;

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate('home')}
          className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Home
        </button>
        <h1 className="text-base font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
          Insights
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={handleLogout}
            className="text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1 text-sm"
            aria-label="Log out"
          >
            Logout
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Date filter tabs */}
      <div className="flex gap-2 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-1.5">
        {FILTERS.map(({ label, days }) => (
          <button
            key={days}
            onClick={() => setActiveDays(days)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeDays === days
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isFetching ? (
        <LoadingSpinner message="Loading entries..." />
      ) : fetchError ? (
        <p className="text-red-400 text-sm text-center py-8">{fetchError}</p>
      ) : rangeEntries.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-5xl mb-5">📔</div>
          <h2 className="text-xl font-bold text-white mb-2">No entries yet</h2>
          <p className="text-slate-400 mb-8">
            Start journaling to see your patterns and insights here.
          </p>
          <Button variant="primary" onClick={() => navigate('home')}>
            Back to Home
          </Button>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-3xl font-extrabold text-violet-400">{rangeEntries.length}</p>
              <p className="text-slate-500 text-xs mt-1">
                {FILTERS.find((f) => f.days === activeDays)?.label} entries
              </p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-3xl font-extrabold text-indigo-400">{sortedEmotions.length}</p>
              <p className="text-slate-500 text-xs mt-1">Emotions tracked</p>
            </div>
          </div>

          {/* Mood distribution */}
          {sortedEmotions.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-5">
                Mood Distribution
              </p>
              <div className="space-y-3">
                {sortedEmotions.map(([emotion, count]) => (
                  <MoodBar key={emotion} emotion={emotion} count={count} maxCount={maxCount} />
                ))}
              </div>
            </div>
          )}

          {/* Pattern Engine + Highlights — always run on full entry history */}
          <div className="mt-4">
            <PatternEngine entries={allEntries} />
            <HighlightsOfMonth entries={allEntries} />
            <EmbeddingsBackfill />
          </div>
        </>
      )}
    </div>
  );
}
