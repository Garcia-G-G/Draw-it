import React, { useCallback } from 'react';
import { useAppStore } from '../../store';
import type { ToastType } from '../../types';

const TOAST_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/80 dark:text-emerald-200 dark:border-emerald-700',
  error: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/80 dark:text-red-200 dark:border-red-700',
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-900/80 dark:text-blue-200 dark:border-blue-700',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/80 dark:text-amber-200 dark:border-amber-700',
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0',
};

const ToastContainer: React.FC = () => {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  const handleDismiss = useCallback((id: string) => {
    removeToast(id);
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto animate-slide-in-right flex items-center gap-2 rounded-lg border px-3 py-2 shadow-lg ${TOAST_STYLES[toast.type]}`}
        >
          <span className="text-sm font-medium">{TOAST_ICONS[toast.type]}</span>
          <span className="text-sm">{toast.message}</span>
          <button
            onClick={() => handleDismiss(toast.id)}
            className="ml-2 opacity-50 transition-opacity hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
              <path strokeLinecap="round" d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
};

export default React.memo(ToastContainer);
