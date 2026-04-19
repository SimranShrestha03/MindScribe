import { useState, useEffect } from 'react';
import { useJournal } from '../context/JournalContext';
import { Button } from '../components/Button';
import { EmotionTag } from '../components/EmotionTag';

const CATEGORY_LABELS = {
  journal:  { label: 'Daily Journal', emoji: '📓' },
  idea:     { label: 'Idea',          emoji: '💡' },
  dream:    { label: 'Dream',         emoji: '🌙' },
  goal:     { label: 'Goal',          emoji: '🎯' },
  memory:   { label: 'Memories',      emoji: '🧠' },
  favorite: { label: 'Favorite',      emoji: '⭐' },
};

function EditableTextarea({ value, onChange, rows = 3, placeholder = '' }) {
  return (
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 text-slate-200 text-sm leading-relaxed resize-none focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600"
      placeholder={placeholder}
    />
  );
}

export function Results() {
  const { navigate, currentEntry, saveEntry, updateEntry, autoEditMode, setAutoEditMode } = useJournal();

  const [entry, setEntry] = useState(currentEntry);
  const [editMode, setEditMode] = useState(autoEditMode);

  // Clear the context flag so it doesn't linger for future navigations
  useEffect(() => {
    if (autoEditMode) setAutoEditMode(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // null  → new entry, not yet in DB → next save = INSERT
  // string → saved entry id        → next save = UPDATE
  const [savedId, setSavedId] = useState(currentEntry?.id || null);

  // New entries always have pending changes (need first save).
  // Existing entries start clean.
  const [pendingChanges, setPendingChanges] = useState(!currentEntry?.id);

  const [isSaving, setIsSaving]   = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [favLoading, setFavLoading] = useState(false);

  if (!entry) {
    navigate('home');
    return null;
  }

  const cat = CATEGORY_LABELS[entry.type] || CATEGORY_LABELS.journal;

  const updateField = (field, value) => {
    setEntry((prev) => ({ ...prev, [field]: value }));
    setPendingChanges(true);
    setSaveMessage('');
    setSaveError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    const wasUpdate = !!savedId;

    try {
      let saved;
      if (savedId) {
        saved = await updateEntry(savedId, {
          type:       entry.type,
          user_text:  entry.user_text,
          ai_summary: entry.ai_summary,
          highlight:  entry.highlight,
          feedback:   entry.feedback,
          emotions:   Array.isArray(entry.emotions) ? entry.emotions : [],
          is_favorite: entry.is_favorite || false,
        });
      } else {
        saved = await saveEntry({
          type:       entry.type,
          user_text:  entry.user_text,
          ai_summary: entry.ai_summary,
          emotions:   Array.isArray(entry.emotions) ? entry.emotions : [],
          feedback:   entry.feedback,
          highlight:  entry.highlight,
          is_favorite: entry.is_favorite || false,
        });
        if (saved?.id) setSavedId(saved.id);
      }

      if (saved) setEntry((prev) => ({ ...prev, ...saved }));
      setPendingChanges(false);
      setEditMode(false);
      setSaveMessage(wasUpdate ? 'Updated!' : 'Saved!');
    } catch (err) {
      console.error(err);
      setSaveError('Failed to save entry');
    }

    setIsSaving(false);
  };

  const handleToggleFavorite = async () => {
    const newFav = !entry.is_favorite;
    setEntry((prev) => ({ ...prev, is_favorite: newFav }));

    if (savedId) {
      setFavLoading(true);
      try {
        await updateEntry(savedId, { is_favorite: newFav });
      } catch {
        setEntry((prev) => ({ ...prev, is_favorite: !newFav }));
      }
      setFavLoading(false);
    } else {
      setPendingChanges(true);
      setSaveMessage('');
    }
  };

  const saveButtonLabel =
    isSaving                          ? 'Saving...'
    : !pendingChanges && saveMessage  ? saveMessage
    : savedId                         ? 'Update Entry'
                                      : 'Save Entry';

  const saveButtonVariant = !pendingChanges && saveMessage ? 'success' : 'primary';

  return (
    <div className="min-h-screen px-6 py-12 max-w-2xl mx-auto fade-up">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => navigate('home')}
          className="text-slate-500 hover:text-white transition-colors flex items-center gap-1 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Home
        </button>

        <div className="flex items-center gap-2">
          <span>{cat.emoji}</span>
          <h1 className="text-base font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            {cat.label}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Favourite toggle */}
          <button
            onClick={handleToggleFavorite}
            disabled={favLoading}
            aria-label={entry.is_favorite ? 'Remove from favourites' : 'Add to favourites'}
            className={`transition-colors disabled:opacity-50 ${
              entry.is_favorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'
            }`}
          >
            <svg className="w-5 h-5" fill={entry.is_favorite ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>

          {/* Edit toggle */}
          <button
            onClick={() => setEditMode((prev) => !prev)}
            className={`text-sm font-medium px-3 py-1.5 rounded-lg border transition-all ${
              editMode
                ? 'border-violet-500 bg-violet-900/30 text-violet-300'
                : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {/* 1. My Words */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">📝 My Words</p>
        {editMode ? (
          <EditableTextarea
            value={entry.user_text}
            onChange={(v) => updateField('user_text', v)}
            rows={4}
            placeholder="Your words..."
          />
        ) : (
          <p className="text-slate-200 text-sm leading-relaxed whitespace-pre-wrap">{entry.user_text}</p>
        )}
      </div>

      {/* 2. AI Summary */}
      {(editMode || entry.ai_summary) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">🧠 AI Summary</p>
          {editMode ? (
            <EditableTextarea
              value={entry.ai_summary}
              onChange={(v) => updateField('ai_summary', v)}
              rows={3}
              placeholder="AI summary..."
            />
          ) : (
            <p className="text-slate-300 text-sm leading-relaxed">{entry.ai_summary}</p>
          )}
        </div>
      )}

      {/* 3. Highlight */}
      {(editMode || entry.highlight) && (
        <div className="bg-gradient-to-r from-amber-900/20 to-yellow-900/20 border border-amber-700/30 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <span className="text-xl shrink-0">✨</span>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-1">Highlight</p>
            {editMode ? (
              <EditableTextarea
                value={entry.highlight}
                onChange={(v) => updateField('highlight', v)}
                rows={2}
                placeholder="The most meaningful moment..."
              />
            ) : (
              <p className="text-slate-200 text-sm leading-relaxed">{entry.highlight}</p>
            )}
          </div>
        </div>
      )}

      {/* 4. Emotions */}
      {(editMode || entry.emotions?.length > 0) && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Emotions</p>
          {editMode ? (
            <div>
              <input
                type="text"
                value={Array.isArray(entry.emotions) ? entry.emotions.join(', ') : ''}
                onChange={(e) =>
                  updateField(
                    'emotions',
                    e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  )
                }
                placeholder="joy, calm, hope"
                className="w-full bg-slate-800/60 border border-slate-700/60 rounded-xl px-3 py-2 text-slate-200 text-sm focus:outline-none focus:border-violet-500/60 transition-colors placeholder-slate-600"
              />
              <p className="text-xs text-slate-600 mt-1.5">Comma-separated</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {entry.emotions.map((emotion) => (
                <EmotionTag key={emotion} emotion={emotion} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. Feedback */}
      {(editMode || entry.feedback) && (
        <div className="bg-gradient-to-br from-violet-900/25 to-indigo-900/25 border border-violet-700/25 rounded-2xl p-6 mb-6">
          <p className="text-xs font-semibold text-violet-300 uppercase tracking-wider mb-3">💬 Feedback</p>
          {editMode ? (
            <EditableTextarea
              value={entry.feedback}
              onChange={(v) => updateField('feedback', v)}
              rows={3}
              placeholder="Feedback..."
            />
          ) : (
            <p className="text-slate-200 leading-relaxed text-sm">{entry.feedback}</p>
          )}
        </div>
      )}

      {/* Save / Update */}
      <Button
        variant={saveButtonVariant}
        onClick={handleSave}
        loading={isSaving}
        disabled={isSaving || !pendingChanges}
        className="w-full mb-3"
        icon={
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
        }
      >
        {saveButtonLabel}
      </Button>

      {saveError && <p className="text-red-400 text-sm mb-3 text-center">{saveError}</p>}

      <button
        onClick={() => navigate('insights')}
        className="w-full text-center text-slate-600 hover:text-violet-400 text-sm transition-colors py-2 flex items-center justify-center gap-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        View Insights
      </button>
    </div>
  );
}
