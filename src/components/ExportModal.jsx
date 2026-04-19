import { useState, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { Button } from './Button';

const RANGES = [
  { value: '7',      label: 'Last 7 days' },
  { value: '30',     label: 'Last 30 days' },
  { value: '90',     label: 'Last 90 days' },
  { value: 'custom', label: 'Custom range' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nDaysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ExportModal({ onClose }) {
  const [range, setRange] = useState('7');
  const [startDate, setStartDate] = useState(nDaysAgoISO(7));
  const [endDate, setEndDate] = useState(todayISO());

  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const isCustom = range === 'custom';

  const dateError = useMemo(() => {
    if (!isCustom) return null;
    if (!startDate || !endDate) return 'Pick both a start and end date.';
    if (new Date(startDate) > new Date(endDate)) return 'Start date must be before end date.';
    return null;
  }, [isCustom, startDate, endDate]);

  const handleExport = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (dateError) {
      setStatus('error');
      setErrorMsg(dateError);
      return;
    }

    setStatus('submitting');

    const body = isCustom
      ? { range: 'custom', startDate, endDate }
      : { range };

    try {
      const { data, error } = await supabase.functions.invoke('export-journal', { body });

      // supabase.functions.invoke puts non-2xx bodies in error.context
      if (error) {
        let msg = error?.message || 'Export failed.';
        try {
          const ctx = await error?.context?.json?.();
          if (ctx?.error) msg = ctx.error;
        } catch {
          // context not parseable; keep original message
        }
        throw new Error(msg);
      }

      if (data?.entryCount === 0) {
        setStatus('error');
        setErrorMsg('No entries found in that date range.');
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus('success');
      setSuccessMsg(
        data?.email
          ? `Export sent to ${data.email}. Check your inbox.`
          : 'Export sent to your email. Check your inbox.'
      );
    } catch (err) {
      console.error('Export failed:', err);
      setStatus('error');
      setErrorMsg(
        err?.message ||
          'Export failed. Please check your connection and try again.'
      );
    }
  };

  const submitting = status === 'submitting';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Export journal
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-4">
          We will email you a ZIP containing a PDF of your entries.
        </p>

        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Range
        </label>
        <select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          disabled={submitting}
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-colors mb-4"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {isCustom && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Start
              </label>
              <input
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                End
              </label>
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                max={todayISO()}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500/60 transition-colors"
              />
            </div>
          </div>
        )}

        {status === 'error' && errorMsg && (
          <p className="text-red-400 text-xs bg-red-950/40 border border-red-900/40 rounded-lg px-3 py-2 mb-3">
            {errorMsg}
          </p>
        )}
        {status === 'success' && successMsg && (
          <p className="text-emerald-300 text-xs bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-2 mb-3">
            {successMsg}
          </p>
        )}

        <div className="flex gap-2 mt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={submitting}
            className="flex-1"
          >
            {status === 'success' ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            loading={submitting}
            disabled={submitting || status === 'success'}
            className="flex-1"
          >
            {submitting ? 'Sending...' : status === 'success' ? 'Sent' : 'Export'}
          </Button>
        </div>
      </div>
    </div>
  );
}
