import { useState, useEffect } from 'react';
import { useJournal } from '../context/JournalContext';
import { useAuth } from '../context/AuthContext';
import { generatePeriodSummary } from '../services/llmService';
import { saveInsightRecord } from '../services/supabaseService';
import { Button } from '../components/Button';
import { MoodBar } from '../components/MoodBar';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ThemeToggle } from '../components/ThemeToggle';
import { PatternEngine } from '../components/PatternEngine';
import { HighlightsOfMonth } from '../components/HighlightsOfMonth';
import { countEmotions, formatDate } from '../utils/helpers';

const FILTERS = [
  { label: 'Today', days: 1 },
  { label: '7 Days', days: 7 },
  { label: '10 Days', days: 10 },
  { label: '30 Days', days: 30 },
];

const CATEGORY_EMOJI = {
  journal: '📓', idea: '💡', dream: '🌙',
  goal: '🎯', memory: '🧠', favorite: '⭐',
};

function InsightCard({ label, labelColor = 'text-slate-500', iconPath, iconBg, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${labelColor}`}>{label}</p>
      <div className="flex gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>
        <p className="text-slate-300 leading-relaxed text-sm">{children}</p>
      </div>
    </div>
  );
}

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

  const [summary, setSummary] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const [isSavingInsight, setIsSavingInsight] = useState(false);
  const [insightSaved, setInsightSaved] = useState(false);
  const [insightSaveError, setInsightSaveError] = useState(null);

  useEffect(() => {
    setIsFetching(true);
    setFetchError(null);
    setSummary(null);
    setInsightSaved(false);
    setInsightSaveError(null);
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

  const RANGE_LABELS = { 1: 'today', 7: '7_days', 10: '10_days', 30: '30_days' };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenError(null);
    setInsightSaved(false);
    setInsightSaveError(null);
    try {
      const result = await generatePeriodSummary(rangeEntries);
      setSummary(result);
    } catch (err) {
      setGenError(err.message);
    }
    setIsGenerating(false);
  };

  const handleSaveInsights = async () => {
    if (!summary) return;
    setIsSavingInsight(true);
    setInsightSaveError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      if (activeDays === 1) {
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate.setDate(startDate.getDate() - activeDays);
      }

      await saveInsightRecord({
        range_type:        RANGE_LABELS[activeDays] || `${activeDays}_days`,
        start_date:        startDate.toISOString(),
        end_date:          endDate.toISOString(),
        summary:           summary.weeklyReflection,
        pattern:           summary.patternInsight,
        suggestion:        summary.suggestion,
        dominant_emotion:  sortedEmotions[0]?.[0] || null,
        emotion_breakdown: emotionCounts,
        entry_count:       rangeEntries.length,
        entry_ids:         rangeEntries.map((e) => e.id).filter(Boolean),
        is_saved:          true,
      });

      setInsightSaved(true);
    } catch (err) {
      setInsightSaveError(err.message || 'Failed to save insights');
    }

    setIsSavingInsight(false);
  };

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

          {/* Recent entries log */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              Recent Entries
            </p>
            <div className="space-y-3">
              {rangeEntries.slice(0, 5).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 py-2.5 border-b border-slate-800 last:border-0"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5 text-base">
                    {CATEGORY_EMOJI[entry.type] || '📓'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-600 mb-0.5">{formatDate(entry.date)}</p>
                    <p className="text-sm text-slate-300 line-clamp-2">
                      {entry.user_text || entry.ai_summary || 'No content'}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {entry.emotions?.slice(0, 3).map((e) => (
                        <span key={e} className="text-xs text-slate-600 capitalize">{e}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {!summary ? (
            <Button
              variant="primary"
              onClick={handleGenerate}
              loading={isGenerating}
              className="w-full"
              icon={
                !isGenerating && (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                )
              }
            >
              {isGenerating ? 'Generating...' : 'Generate AI Summary'}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-violet-900/25 to-indigo-900/25 border border-violet-700/25 rounded-2xl p-6">
                <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-4">
                  Weekly Reflection
                </p>
                <p className="text-slate-200 leading-relaxed text-sm">{summary.weeklyReflection}</p>
              </div>

              <InsightCard
                label="Pattern Insight"
                iconPath="M13 10V3L4 14h7v7l9-11h-7z"
                iconBg="bg-indigo-900/50 text-indigo-400"
              >
                {summary.patternInsight}
              </InsightCard>

              <InsightCard
                label="Suggestion"
                labelColor="text-emerald-500"
                iconPath="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                iconBg="bg-emerald-900/30 text-emerald-400"
              >
                {summary.suggestion}
              </InsightCard>

              <Button
                variant={insightSaved ? 'success' : 'primary'}
                onClick={handleSaveInsights}
                loading={isSavingInsight}
                disabled={isSavingInsight || insightSaved}
                className="w-full"
                icon={
                  !isSavingInsight && !insightSaved && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  )
                }
              >
                {isSavingInsight ? 'Saving...' : insightSaved ? 'Insights Saved!' : 'Save Insights'}
              </Button>

              {insightSaveError && (
                <p className="text-red-400 text-sm text-center mt-2">{insightSaveError}</p>
              )}
            </div>
          )}

          {genError && <p className="text-red-400 text-sm mt-4 text-center">{genError}</p>}

          {/* Pattern Engine + Highlights — run on the full entry history, not the range tab */}
          <div className="mt-8">
            <PatternEngine entries={allEntries} />
            <HighlightsOfMonth entries={allEntries} />
          </div>
        </>
      )}
    </div>
  );
}
