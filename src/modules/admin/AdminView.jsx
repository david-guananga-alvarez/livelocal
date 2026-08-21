import React, { useCallback, useEffect, useState } from 'react';
import { MapPinned, RotateCcw, Users } from 'lucide-react';
import { resetState } from '../../state/store';
import { statusLabel } from '../matching/matching';
import { getRequests } from '../requests/requestsService';
import { getLocals } from '../local/localService';
import { supabase } from '../auth/supabaseClient';

export default function AdminView({ state, setState }) {
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState('');
  const loadOperations = useCallback(async () => {
    if (!supabase) return;
    setLoading(true); setError('');
    try {
      const [requests, locals] = await Promise.all([getRequests(), getLocals()]);
      setRemote({ requests, locals });
    } catch (loadError) { setError(loadError?.message || 'No se pudo cargar la operación'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadOperations(); }, [loadOperations]);
  const requests = remote?.requests ?? state.requests;
  const locals = remote?.locals ?? state.locals;
  const onlineCount = locals.filter(local => local.is_online ?? local.available).length;

  return (
    <div className="stack appView adminView">
      <section className="hero compact adminHero">
        <div>
          <p className="eyebrow">Panel de operaciones</p>
          <h1>LiveLocal bajo control</h1>
          <p>Supervisa peticiones, disponibilidad y actividad de la red.</p>
        </div>
        {!supabase && <button className="danger" onClick={() => setState(resetState())}>
          <RotateCcw size={16} /> Restablecer demo
        </button>}
      </section>

      <section className="adminStats" aria-label="Resumen operativo">
        <article><MapPinned size={18}/><span>Peticiones</span><b>{requests.length}</b></article>
        <article><Users size={18}/><span>Locales disponibles</span><b>{onlineCount}</b></article>
      </section>

      <section className="card">
        <div className="sectionHeader"><div><p className="eyebrow dark">Actividad</p><h2>Peticiones</h2></div></div>
        <div className="table adminTable">
          {loading ? <div className="skeletonList" aria-label="Cargando peticiones"><i/><i/><i/></div> : error ? <div className="emptyState"><p>{error}</p><button onClick={loadOperations}>Reintentar</button></div> : requests.length === 0 ? <p className="emptyState">Todavía no hay peticiones.</p> : requests.map(request => (
            <div className="tableRow" key={request.id}>
              <b title={request.zoneName || request.zone}>{request.zoneName || request.zone}</b>
              <span className={`statusBadge status-${request.status}`}>{statusLabel(request.status)}</span>
              <span className="tableSecondary">{(request.localId || request.local_id) ? `Local ${(request.localId || request.local_id).slice(0, 8)}` : 'Sin local asignado'}</span>
              <strong>{request.price != null ? `${request.price} €` : `${request.duration_minutes || '—'} min`}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="sectionHeader"><div><p className="eyebrow dark">Red</p><h2>Locales</h2></div></div>
        <div className="table adminTable localsTable">
          {locals.length === 0 ? <p className="emptyState">Todavía no hay locales registrados.</p> : locals.map(local => (
            <div className="tableRow" key={local.id || local.user_id}>
              <b>{local.name || `Local ${(local.user_id || local.id).slice(0, 8)}`}</b>
              <span className={`statusBadge ${(local.is_online ?? local.available) ? 'status-available' : 'status-offline'}`}>{(local.is_online ?? local.available) ? 'Disponible' : 'Offline'}</span>
              <span className="tableSecondary">{local.zones?.join(' · ') || (local.updated_at ? `Actualizado ${new Date(local.updated_at).toLocaleString()}` : 'Sin ubicación')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
