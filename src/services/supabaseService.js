import { supabase } from './supabaseClient';

export async function saveJournal({ type, user_text, ai_summary, emotions, feedback, highlight, is_favorite = false }) {
  const emotionsArray = Array.isArray(emotions) ? emotions : [];

  const { error: insertError } = await supabase
    .from('journals')
    .insert([{
      type: type || 'journal',
      user_text,
      ai_summary,
      emotions: emotionsArray,
      feedback,
      highlight,
      is_favorite,
    }]);

  if (insertError) {
    console.error('Supabase insert error:', insertError);
    throw new Error(insertError.message || 'Failed to save entry');
  }

  const { data, error: fetchError } = await supabase
    .from('journals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError) {
    console.error('Supabase fetch-after-insert error:', fetchError);
    return { type, user_text, ai_summary, emotions: emotionsArray, feedback, highlight, is_favorite };
  }

  return data;
}

export async function updateJournal(id, updates) {
  const { error: updateError } = await supabase
    .from('journals')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    console.error('Supabase update error:', updateError);
    throw new Error(updateError.message || 'Failed to update entry');
  }

  const { data, error: fetchError } = await supabase
    .from('journals')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) {
    console.error('Supabase fetch-after-update error:', fetchError);
    return { id, created_at: new Date().toISOString(), ...updates };
  }

  return data;
}

const PAGE_SIZE = 50;

/**
 * Paginated journal fetch.
 * @param {number} page  0-indexed page number (default 0)
 * @returns {{ data: object[], hasMore: boolean }}
 */
export async function getAllJournals(page = 0) {
  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1; // inclusive upper bound for Supabase range()

  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return { data: data ?? [], hasMore: (data ?? []).length === PAGE_SIZE };
}

export async function getJournalsByDateRange(startDate) {
  const { data, error } = await supabase
    .from('journals')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function deleteJournal(id) {
  const { error } = await supabase.from('journals').delete().eq('id', id);
  if (error) {
    console.error('Supabase delete error:', error);
    throw new Error(error.message || 'Failed to delete entry');
  }
}

export async function saveInsightRecord(insight) {
  const { error } = await supabase.from('insights').insert([insight]);
  if (error) {
    console.error('Supabase insights insert error:', error);
    throw new Error(error.message || 'Failed to save insights');
  }
}
