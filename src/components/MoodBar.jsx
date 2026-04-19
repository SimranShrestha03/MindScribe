import { getEmotionBarColor } from '../utils/helpers';

export function MoodBar({ emotion, count, maxCount }) {
  const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-400 capitalize w-24 shrink-0 truncate">
        {emotion}
      </span>
      <div className="flex-1 bg-slate-800 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${getEmotionBarColor(emotion)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-slate-500 w-5 text-right shrink-0">{count}</span>
    </div>
  );
}
