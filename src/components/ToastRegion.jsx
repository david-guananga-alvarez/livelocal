import React, { useEffect } from 'react';

export default function ToastRegion({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (!toast) return <div className="toastRegion" aria-live="polite" />;
  return (
    <div className="toastRegion" aria-live="polite">
      <div className={`toast toast-${toast.type || 'info'}`}>
        <span>{toast.message}</span>
        {toast.action && <button type="button" onClick={toast.action.onClick}>{toast.action.label}</button>}
        <button type="button" className="toastClose" aria-label="Cerrar aviso" onClick={onDismiss}>×</button>
      </div>
    </div>
  );
}
