export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon = null,
  className = '',
  type = 'button',
}) {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

  const variants = {
    primary:
      'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-violet-900/30',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700',
    danger:
      'bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/60',
    ghost: 'text-slate-400 hover:text-white hover:bg-slate-800',
    success:
      'bg-emerald-900/40 text-emerald-300 border border-emerald-800/40 cursor-default',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin opacity-70" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
