import { getEmotionColor } from '../utils/helpers';

export function EmotionTag({ emotion }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-sm font-medium border capitalize ${getEmotionColor(emotion)}`}
    >
      {emotion}
    </span>
  );
}
