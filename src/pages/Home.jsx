import { useState, useEffect, useRef, useMemo } from 'react';
import { useJournal } from '../context/JournalContext';
import { useAuth } from '../context/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { DailyCheckIn } from '../components/DailyCheckIn';
import { AddEntryModal } from '../components/AddEntryModal';
import { AskYourself } from '../components/AskYourself';
import { EmotionTag } from '../components/EmotionTag';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ExportModal } from '../components/ExportModal';
import { ThemeToggle } from '../components/ThemeToggle';
import { StreakBadge } from '../components/StreakBadge';

const CATEGORIES = [
  { value: 'journal',   label: 'Daily Journal', emoji: '📓' },
  { value: 'idea',      label: 'Ideas',         emoji: '💡' },
  { value: 'dream',     label: 'Dreams',        emoji: '🌙' },
  { value: 'goal',      label: 'Goals',         emoji: '🎯' },
  { value: 'memory',    label: 'Memories',      emoji: '🧠' },
  { value: 'favorite',  label: 'Favorites',     emoji: '⭐' },
];

const TODAY_KEY = 'mindscribe_checkin_date';

function formatCardDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Entry card with 3-dot menu ────────────────────────────────────────────
function EntryCard({ entry, onClick, onEdit, onDelete, onToggleFavourite, isMenuOpen, onMenuOpen, onMenuClose }) {
  const menuRef = useRef(null);
  const cat = CATEGORIES.find((c) => c.value === entry.type) || CATEGORIES[0];

  // Close menu on outside click
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onMenuClose();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isMenuOpen, onMenuClose]);

  return (
    <div className="relative bg-slate-900 border border-slate-800 rounded-2xl p-4 hover:border-slate-700 transition-colors">
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Category + label (clickable) */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer"
          onClick={onClick}
        >
          <span className="text-base">{cat.emoji}</span>
          <span className="text-xs font-semibold text-slate-500">{cat.label}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Day + date */}
          <span className="text-xs text-slate-600">{formatCardDate(entry.date)}</span>

          {/* Favourite indicator */}
          {entry.is_favorite && (
            <span className="text-amber-400 text-xs" title="Favourite">★</span>
          )}

          {/* 3-dot menu trigger */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); isMenuOpen ? onMenuClose() : onMenuOpen(); }}
              className="text-slate-600 hover:text-slate-400 rounded p-0.5 transition-colors"
              aria-label="Entry options"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="4"  r="1.5" />
                <circle cx="10" cy="10" r="1.5" />
                <circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 top-7 z-50 bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl py-1.5 w-48 overflow-hidden">
                {/* Edit */}
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/60 transition-colors flex items-center gap-3"
                >
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit entry
                </button>

                {/* Favourite toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavourite(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-700/60 transition-colors flex items-center gap-3"
                >
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 ${entry.is_favorite ? 'text-amber-400' : 'text-slate-400'}`}
                    fill={entry.is_favorite ? 'currentColor' : 'none'}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.8}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  {entry.is_favorite ? 'Remove favourite' : 'Add to favourites'}
                </button>

                <div className="border-t border-slate-700/60 my-1" />

                {/* Delete */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700/60 transition-colors flex items-center gap-3"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview (clickable) */}
      <div className="cursor-pointer" onClick={onClick}>
        <p className="text-sm text-slate-300 leading-relaxed line-clamp-2 mb-3">
          {entry.user_text || entry.ai_summary || 'No content'}
        </p>
        {entry.emotions?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.emotions.slice(0, 3).map((e) => (
              <EmotionTag key={e} emotion={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Home page ──────────────────────────────────────────────────────────────
export function Home() {
  const {
    navigate,
    entries,
    fetchEntries,
    setPendingMood,
    setPendingCategory,
    setCurrentEntry,
    updateEntry,
    deleteEntry,
    setAutoEditMode,
  } = useJournal();
  const { signOut } = useAuth();

  const [isFetching,    setIsFetching]    = useState(entries.length === 0);
  const [fetchError,    setFetchError]    = useState(null);
  const [showCheckIn,   setShowCheckIn]   = useState(false);
  const [showAddEntry,  setShowAddEntry]  = useState(false);
  const [showExport,    setShowExport]    = useState(false);
  const [showAsk,       setShowAsk]       = useState(false);
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchTerm,    setSearchTerm]    = useState('');
  const [openMenuId,    setOpenMenuId]    = useState(null);

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    const today = new Date().toDateString();
    if (localStorage.getItem(TODAY_KEY) !== today) {
      setShowCheckIn(true);
    }

    fetchEntries()
      .catch((err) => {
        console.error(err);
        setFetchError('Failed to load entries');
      })
      .finally(() => setIsFetching(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckInSelect = (mood) => {
    localStorage.setItem(TODAY_KEY, new Date().toDateString());
    setPendingMood(mood);
    setShowCheckIn(false);
  };

  const handleCheckInDismiss = () => {
    localStorage.setItem(TODAY_KEY, new Date().toDateString());
    setShowCheckIn(false);
  };

  const handleCategoryClick = (value) => {
    setActiveCategory((prev) => (prev === value ? null : value));
    setOpenMenuId(null);
  };

  const filteredEntries = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();

    let results = entries.filter((e) => {
      if (!activeCategory) return true;
      if (activeCategory === 'favorite') return e.is_favorite === true;
      return e.type === activeCategory;
    });

    if (!q) return results;

    const scored = results
      .map((e) => {
        let score = 0;
        if (e.highlight?.toLowerCase().includes(q))   score += 3;
        if (e.ai_summary?.toLowerCase().includes(q))  score += 2;
        if (e.user_text?.toLowerCase().includes(q))   score += 1;
        const emotionMatch = Array.isArray(e.emotions) &&
          e.emotions.some((em) => em.toLowerCase().includes(q));
        if (emotionMatch) score += 2;
        return { entry: e, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(({ entry }) => entry);

    return scored;
  }, [entries, activeCategory, debouncedSearch]);

  const handleEntryClick = (entry) => {
    setCurrentEntry(entry);
    navigate('results');
  };

  const handleCardEdit = (entry) => {
    setCurrentEntry(entry);
    setAutoEditMode(true);
    navigate('results');
  };

  const handleCardFavourite = async (entry) => {
    try {
      await updateEntry(entry.id, { is_favorite: !entry.is_favorite });
    } catch (err) {
      console.error('Favourite toggle failed:', err);
    }
    setOpenMenuId(null);
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleDelete = async (entry) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) {
      setOpenMenuId(null);
      return;
    }
    try {
      await deleteEntry(entry.id);
    } catch (err) {
      console.error('Delete failed:', err);
    }
    setOpenMenuId(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {showAddEntry && (
        <AddEntryModal onClose={() => setShowAddEntry(false)} />
      )}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}

      <div className="max-w-2xl mx-auto px-4 pt-10 pb-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              MindScribe
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors px-3 py-2 rounded-xl border border-slate-800 hover:border-violet-800"
              aria-label="Export journal"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Export
            </button>
            <button
              onClick={() => navigate('insights')}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-400 transition-colors px-3 py-2 rounded-xl border border-slate-800 hover:border-violet-800"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Insights
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors px-3 py-2 rounded-xl border border-slate-800 hover:border-red-900/60"
              aria-label="Log out"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>

        {/* Streak */}
        {entries.length > 0 && (
          <div className="mb-4">
            <StreakBadge entries={entries} />
          </div>
        )}

        {/* Search + Ask toggle */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search across summaries, highlights, emotions..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); if (showAsk) setShowAsk(false); }}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-8 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => { setShowAsk((v) => !v); setSearchTerm(''); }}
            title="Ask your past self"
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
              showAsk
                ? 'bg-violet-900/40 border-violet-600/60 text-violet-300'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-violet-800 hover:text-violet-400'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            Ask
          </button>
        </div>

        {/* Ask your past self panel */}
        {showAsk && entries.length > 0 && (
          <AskYourself entries={entries} />
        )}
        {showAsk && entries.length === 0 && !isFetching && (
          <p className="text-slate-500 text-sm text-center mb-4 py-2">
            No entries yet. Start journaling first!
          </p>
        )}

        {/* Daily check-in (inline, shown once per day) */}
        {showCheckIn && (
          <DailyCheckIn
            onSelectMood={handleCheckInSelect}
            onSkip={handleCheckInDismiss}
          />
        )}

        {/* Category cards */}
        <div className="grid grid-cols-3 gap-3 mb-7">
          {CATEGORIES.map(({ value, label, emoji }) => {
            const count = value === 'favorite'
              ? entries.filter((e) => e.is_favorite).length
              : entries.filter((e) => e.type === value).length;
            const isActive = activeCategory === value;
            return (
              <button
                key={value}
                onClick={() => handleCategoryClick(value)}
                className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border transition-all ${
                  isActive
                    ? 'border-violet-500 bg-violet-900/30'
                    : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                }`}
              >
                <span className="text-2xl">{emoji}</span>
                <span className={`text-xs font-semibold ${isActive ? 'text-violet-300' : 'text-slate-400'}`}>
                  {label}
                </span>
                {count > 0 && (
                  <span className="text-xs text-slate-600">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active filter pill */}
        {activeCategory && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">Showing:</span>
            <button
              onClick={() => setActiveCategory(null)}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-300 bg-violet-900/30 border border-violet-800/40 rounded-full px-3 py-1"
            >
              {CATEGORIES.find((c) => c.value === activeCategory)?.emoji}{' '}
              {CATEGORIES.find((c) => c.value === activeCategory)?.label}
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Entries */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            {debouncedSearch
              ? `Results for "${debouncedSearch}" (${filteredEntries.length})`
              : activeCategory
              ? 'Filtered Entries'
              : 'Recent Entries'}
          </p>

          {isFetching && entries.length === 0 ? (
            <LoadingSpinner message="Loading your entries..." />
          ) : fetchError && entries.length === 0 ? (
            <p className="text-red-400 text-sm text-center py-8">{fetchError}</p>
          ) : filteredEntries.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-4xl mb-4">
                {debouncedSearch
                  ? '🔍'
                  : activeCategory
                  ? CATEGORIES.find((c) => c.value === activeCategory)?.emoji
                  : '📔'}
              </p>
              <p className="text-slate-400 text-sm">
                {debouncedSearch
                  ? 'No entries match your search.'
                  : activeCategory
                  ? 'No entries in this category yet.'
                  : 'No entries yet. Tap + to add your first.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((entry) => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => handleEntryClick(entry)}
                  onEdit={() => handleCardEdit(entry)}
                  onDelete={() => handleDelete(entry)}
                  onToggleFavourite={() => handleCardFavourite(entry)}
                  isMenuOpen={openMenuId === entry.id}
                  onMenuOpen={() => setOpenMenuId(entry.id)}
                  onMenuClose={() => setOpenMenuId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating + button */}
      <button
        onClick={() => { setPendingCategory('journal'); setShowAddEntry(true); }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-violet-900/50 hover:scale-105 active:scale-95 transition-transform z-40"
        aria-label="Add new entry"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  );
}
