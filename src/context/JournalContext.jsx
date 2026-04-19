import { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

  // Reset all per-user state whenever the active user changes (login/logout/switch).
  useEffect(() => {
    setPage('home');
    setCurrentEntry(null);
    setEntries([]);
    setPendingCategory('journal');
    setPendingMood(null);
    setAutoEditMode(false);
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

  const fetchEntries = useCallback(async () => {
    const rows = await getAllJournals();
    const mapped = rows.map(mapRow);
    setEntries(mapped);
    return mapped;
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
        saveEntry,
        updateEntry,
        deleteEntry,
        fetchEntries,
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
