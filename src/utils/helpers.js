export function getEmotionColor(emotion) {
  const colorMap = {
    stress:      'bg-red-900/50 text-red-300 border-red-700/60',
    anxiety:     'bg-orange-900/50 text-orange-300 border-orange-700/60',
    happiness:   'bg-yellow-900/50 text-yellow-300 border-yellow-700/60',
    confidence:  'bg-green-900/50 text-green-300 border-green-700/60',
    sadness:     'bg-blue-900/50 text-blue-300 border-blue-700/60',
    joy:         'bg-pink-900/50 text-pink-300 border-pink-700/60',
    frustration: 'bg-red-900/50 text-red-300 border-red-700/60',
    calm:        'bg-teal-900/50 text-teal-300 border-teal-700/60',
    hope:        'bg-emerald-900/50 text-emerald-300 border-emerald-700/60',
    fear:        'bg-purple-900/50 text-purple-300 border-purple-700/60',
    excitement:  'bg-amber-900/50 text-amber-300 border-amber-700/60',
    overwhelm:   'bg-rose-900/50 text-rose-300 border-rose-700/60',
    gratitude:   'bg-lime-900/50 text-lime-300 border-lime-700/60',
    loneliness:  'bg-slate-700/50 text-slate-300 border-slate-600/60',
  };
  return colorMap[emotion?.toLowerCase()] || 'bg-violet-900/50 text-violet-300 border-violet-700/60';
}

export function getEmotionBarColor(emotion) {
  const colorMap = {
    stress:      'bg-red-500',
    anxiety:     'bg-orange-500',
    happiness:   'bg-yellow-400',
    confidence:  'bg-green-500',
    sadness:     'bg-blue-500',
    joy:         'bg-pink-400',
    frustration: 'bg-red-600',
    calm:        'bg-teal-400',
    hope:        'bg-emerald-400',
    fear:        'bg-purple-500',
    excitement:  'bg-amber-400',
    overwhelm:   'bg-rose-500',
    gratitude:   'bg-lime-400',
    loneliness:  'bg-slate-400',
  };
  return colorMap[emotion?.toLowerCase()] || 'bg-violet-400';
}

export function countEmotions(entries) {
  const counts = {};
  entries.forEach((entry) => {
    (entry.emotions || []).forEach((emotion) => {
      counts[emotion] = (counts[emotion] || 0) + 1;
    });
  });
  return counts;
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getWeekEntries(entries) {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return entries.filter((e) => new Date(e.date) >= oneWeekAgo);
}
