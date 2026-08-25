import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Eye, MapPinned, Shield, User, WifiOff, X } from 'lucide-react';
import { TabBar } from './ui/Primitives';

const baseRoles = [
  { value: 'client', label: 'Cliente', icon: <User size={18} /> },
  { value: 'local', label: 'Local', icon: <MapPinned size={18} /> },
];

export default function AppShell({ activeRole, canAccessAdmin, onRoleChange, userMenu, isOnline = true, immersive = false, sessionLabel, children }) {
  const [modeDialogOpen, setModeDialogOpen] = useState(false);
  const modeButtonRef = useRef(null);
  const modeDialogRef = useRef(null);
  const modeDialogCloseRef = useRef(null);
  const roles = canAccessAdmin
    ? [...baseRoles, { value: 'admin', label: 'Admin', icon: <Shield size={18} /> }]
    : baseRoles;

  useEffect(() => {
    if (!modeDialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => modeDialogCloseRef.current?.focus());
    const handleKeyDown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setModeDialogOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(modeDialogRef.current?.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      modeButtonRef.current?.focus();
    };
  }, [modeDialogOpen]);

  function changeRole(nextRole) {
    onRoleChange(nextRole);
    setModeDialogOpen(false);
  }

  return (
    <div className={`appShell${immersive ? ' isImmersive' : ''}`}>
      <a className="skipLink" href="#app-main">Ir al contenido</a>
      <header className="appHeader">
        <div className="appHeaderInner">
          <div className="brand" aria-label="LiveLocal Barcelona">
            <span className="brandMark" aria-hidden="true"><Eye size={20} /></span>
            <span className="brandCopy"><b>LiveLocal</b><small>Barcelona</small></span>
          </div>
          {immersive ? (
            <>
              <div className="immersiveSessionMeta"><i aria-hidden="true" /><span>{sessionLabel || 'Sesión en directo'}</span></div>
              <button ref={modeButtonRef} type="button" className="immersiveModeButton" aria-haspopup="dialog" onClick={() => setModeDialogOpen(true)}>
                <span>Cambiar modo</span><ChevronDown size={15} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <nav className="roleNavigation" aria-label="Elige cómo quieres usar LiveLocal">
                <TabBar label="Modo de uso" value={activeRole} tabs={roles} onChange={onRoleChange} />
              </nav>
              <div className="appUserMenu">{userMenu}</div>
            </>
          )}
        </div>
      </header>
      {!isOnline && <div className="networkBanner" role="status"><WifiOff size={16} aria-hidden="true" /><span>Sin conexión. Puedes consultar la pantalla, pero las acciones online podrían fallar. Reinténtalo cuando recuperes internet.</span></div>}
      <main id="app-main" className="appContent" key={activeRole} tabIndex="-1">
        {children}
      </main>
      {modeDialogOpen && (
        <div className="modeDialogBackdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && setModeDialogOpen(false)}>
          <section ref={modeDialogRef} className="modeDialog" role="dialog" aria-modal="true" aria-labelledby="mode-dialog-title" aria-describedby="mode-dialog-description">
            <div className="modeDialogHeader">
              <div><h2 id="mode-dialog-title">Cambiar modo</h2><p id="mode-dialog-description">La sesión seguirá activa al cambiar de vista.</p></div>
              <button ref={modeDialogCloseRef} type="button" className="modeDialogClose" aria-label="Cerrar selector de modo" onClick={() => setModeDialogOpen(false)}><X size={18} aria-hidden="true" /></button>
            </div>
            <TabBar label="Selecciona un modo" value={activeRole} tabs={roles} onChange={changeRole} />
          </section>
        </div>
      )}
    </div>
  );
}
