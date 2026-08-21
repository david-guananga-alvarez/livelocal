import React, { useEffect, useRef } from 'react';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirmar', busy = false, onConfirm, onCancel }) {
  const cancelRef = useRef(null);
  useEffect(() => { if (open) cancelRef.current?.focus(); }, [open]);
  if (!open) return null;

  return (
    <div className="dialogBackdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !busy && onCancel()}>
      <section className="confirmDialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message">
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <div className="dialogActions">
          <button ref={cancelRef} type="button" className="secondary" disabled={busy} onClick={onCancel}>Volver</button>
          <button type="button" className="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Guardando…' : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
