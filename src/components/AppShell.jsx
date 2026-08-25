import React from 'react';
import { Eye, MapPinned, Shield, User, WifiOff } from 'lucide-react';
import { TabBar } from './ui/Primitives';

const baseRoles = [
  { value: 'client', label: 'Cliente', icon: <User size={18} /> },
  { value: 'local', label: 'Local', icon: <MapPinned size={18} /> },
];

export default function AppShell({ activeRole, canAccessAdmin, onRoleChange, userMenu, isOnline = true, children }) {
  const roles = canAccessAdmin
    ? [...baseRoles, { value: 'admin', label: 'Admin', icon: <Shield size={18} /> }]
    : baseRoles;

  return (
    <div className="appShell">
      <a className="skipLink" href="#app-main">Ir al contenido</a>
      <header className="appHeader">
        <div className="appHeaderInner">
          <div className="brand" aria-label="LiveLocal Barcelona">
            <span className="brandMark" aria-hidden="true"><Eye size={20} /></span>
            <span className="brandCopy"><b>LiveLocal</b><small>Barcelona</small></span>
          </div>
          <nav className="roleNavigation" aria-label="Elige cómo quieres usar LiveLocal">
            <TabBar label="Modo de uso" value={activeRole} tabs={roles} onChange={onRoleChange} />
          </nav>
          <div className="appUserMenu">{userMenu}</div>
        </div>
      </header>
      {!isOnline && <div className="networkBanner" role="status"><WifiOff size={16} aria-hidden="true" /><span>Sin conexión. Puedes seguir consultando la pantalla; los cambios se enviarán cuando recuperes internet.</span></div>}
      <main id="app-main" className="appContent" key={activeRole} tabIndex="-1">
        {children}
      </main>
    </div>
  );
}
