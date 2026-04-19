export function LoadingSpinner({ message = 'Processing...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
        <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 animate-spin" />
      </div>
      <p className="text-slate-500 text-sm animate-pulse">{message}</p>
    </div>
  );
}
