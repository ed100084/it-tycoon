import React from 'react';
import { useToastStore } from '../../store/toastStore';
import type { Toast } from '../../store/toastStore';

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast);

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => removeToast(toast.id)}>
      <span className="toast-icon">
        {toast.type === 'success' && '✓'}
        {toast.type === 'warning' && '⚠'}
        {toast.type === 'error'   && '✕'}
        {toast.type === 'info'    && 'ℹ'}
      </span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
    </div>
  );
}

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
};
