import React, { useEffect } from 'react';

export default function ToastRegion({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return <div className="toastRegion" aria-live="polite" aria-atomic="true" />;
  return (
    <div className="toastRegion" aria-live={toast.type === 'error' ? 'assertive' : 'polite'} aria-atomic="true">
      <div className={`toast toast-${toast.type || 'info'}`} role={toast.type === 'error' ? 'alert' : 'status'}>
        <span className="toastIcon" aria-hidden="true">{toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i'}</span>
        <span className="toastMessage">{toast.message}</span>
        {toast.action && <button type="button" onClick={toast.action.onClick}>{toast.action.label}</button>}
        <button type="button" className="toastClose" aria-label="Cerrar aviso" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
}
