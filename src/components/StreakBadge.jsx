import { calculateStreak } from '../utils/helpers';

export function StreakBadge({ entries }) {
  const streak = calculateStreak(entries);
  if (streak <= 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-700/40 rounded-full px-3 py-1.5">
      <span className="text-base leading-none">🔥</span>
      <span className="text-sm font-semibold text-amber-300">
        {streak} Day Streak
      </span>
    </div>
  );
}
