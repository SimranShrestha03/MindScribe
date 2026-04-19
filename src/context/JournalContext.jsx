import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
  saveJournal,
  updateJournal,
  deleteJournal,
  getAllJournals,
  getJournalsByDateRange,
} from '../services/supabaseService';
import { useAuth } from './AuthContext';

const JournalContext = createContext(null);

function mapRow(row) {
  return {
    id: row.id,
    date: row.created_at,
    type: row.type || 'journal',
    is_favorite: row.is_favorite || false,
    user_text: row.user_text,
    ai_summary: row.ai_summary,
    emotions: Array.isArray(row.emotions) ? row.emotions : [],
    feedback: row.feedback,
    highlight: row.highlight,
  };
}

export function JournalProvider({ children }) {
  const { user } = useAuth();
  const [page, setPage] = useState('home');
  const [currentEntry, setCurrentEntry] = useState(null);
  const [entries, setEntries] = useState([]);
  const [pendingCategory, setPendingCategory] = useState('journal');
  const [pendingMood, setPendingMood] = useState(null);
  const [autoEditMode, setAutoEditMode] = useState(false);

  // Pagination state for the home feed.
  const [hasMore, setHasMore] = useState(false);
  const pageIndexRef = useRef(0); // mutable ref so callbacks don't go stale

  // Reset all per-user state whenever the active user changes (login/logout/switch).
  useEffect(() => {
    setPage('home');
    setCurrentEntry(null);
    setEntries([]);
    setPendingCategory('journal');
    setPendingMood(null);
    setAutoEditMode(false);
    setHasMore(false);
    pageIndexRef.current = 0;
  }, [user?.id]);

  const navigate = useCallback((p) => setPage(p), []);

  const saveEntry = useCallback(async (entryData) => {
    if (!user) throw new Error('Please log in to save your entry.');
    const saved = await saveJournal(entryData);
    const newEntry = mapRow(saved);
    setEntries((prev) => [newEntry, ...prev]);
    return newEntry;
  }, [user]);

  const updateEntry = useCallback(async (id, updates) => {
    const updated = await updateJournal(id, updates);
    const mappedEntry = mapRow(updated);
    setEntries((prev) => prev.map((e) => (e.id === id ? mappedEntry : e)));
    return mappedEntry;
  }, []);

  const deleteEntry = useCallback(async (id) => {
    await deleteJournal(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  /**
   * fetchEntries — loads the first page (page 0) and resets the list.
   * Called on mount and after user switches.
   */
  const fetchEntries = useCallback(async () => {
    pageIndexRef.current = 0;
    const { data, hasMore: more } = await getAllJournals(0);
    const mapped = data.map(mapRow);
    setEntries(mapped);
    setHasMore(more);
    return mapped;
  }, []);

  /**
   * fetchMoreEntries — appends the next page to the existing list.
   * Returns false if there are no more pages.
   */
  const fetchMoreEntries = useCallback(async () => {
    const nextPage = pageIndexRef.current + 1;
    const { data, hasMore: more } = await getAllJournals(nextPage);
    if (data.length === 0) {
      setHasMore(false);
      return false;
    }
    pageIndexRef.current = nextPage;
    setEntries((prev) => {
      // De-duplicate by id in case a new entry was inserted between pages.
      const existing = new Set(prev.map((e) => e.id));
      const fresh = data.map(mapRow).filter((e) => !existing.has(e.id));
      return [...prev, ...fresh];
    });
    setHasMore(more);
    return true;
  }, []);

  const fetchEntriesByRange = useCallback(async (days) => {
    const startDate = new Date();
    if (days === 1) {
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate.setDate(startDate.getDate() - days);
    }
    const rows = await getJournalsByDateRange(startDate);
    return rows.map(mapRow);
  }, []);

  return (
    <JournalContext.Provider
      value={{
        page,
        navigate,
        currentEntry,
        setCurrentEntry,
        entries,
        hasMore,
        saveEntry,
        updateEntry,
        deleteEntry,
        fetchEntries,
        fetchMoreEntries,
        fetchEntriesByRange,
        pendingCategory,
        setPendingCategory,
        pendingMood,
        setPendingMood,
        autoEditMode,
        setAutoEditMode,
      }}
    >
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal() {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used within JournalProvider');
  return ctx;
}
