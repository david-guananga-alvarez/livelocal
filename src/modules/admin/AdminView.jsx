import React from 'react';
import { MapPinned, RotateCcw, Users } from 'lucide-react';
import { resetState } from '../../state/store';
import { statusLabel } from '../matching/matching';

export default function AdminView({ state, setState }) {
  return (
    <div className="stack appView adminView">
      <section className="hero compact adminHero">
        <div>
          <p className="eyebrow">Panel de operaciones</p>
          <h1>LiveLocal bajo control</h1>
          <p>Supervisa peticiones, disponibilidad y actividad de la red.</p>
        </div>
        <button className="danger" onClick={() => setState(resetState())}>
          <RotateCcw size={16} /> Restablecer demo
        </button>
      </section>

      <section className="adminStats" aria-label="Resumen operativo">
        <article><MapPinned size={18}/><span>Peticiones</span><b>{state.requests.length}</b></article>
        <article><Users size={18}/><span>Locales disponibles</span><b>{state.locals.filter(local => local.available).length}</b></article>
      </section>

      <section className="card">
        <div className="sectionHeader"><div><p className="eyebrow dark">Actividad</p><h2>Peticiones</h2></div></div>
        <div className="table adminTable">
          {state.requests.length === 0 ? <p className="emptyState">Todavía no hay peticiones.</p> : state.requests.map(request => (
            <div className="tableRow" key={request.id}>
              <b title={request.zoneName}>{request.zoneName}</b>
              <span className={`statusBadge status-${request.status}`}>{statusLabel(request.status)}</span>
              <span className="tableSecondary">{request.localId ? `Local ${request.localId.slice(0, 8)}` : 'Sin local asignado'}</span>
              <strong>{request.price} €</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader"><div><p className="eyebrow dark">Red</p><h2>Locales</h2></div></div>
        <div className="table adminTable localsTable">
          {state.locals.map(local => (
            <div className="tableRow" key={local.id}>
              <b>{local.name}</b>
              <span className={`statusBadge ${local.available ? 'status-available' : 'status-offline'}`}>{local.available ? 'Disponible' : 'Offline'}</span>
              <span className="tableSecondary">{local.zones.join(' · ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
