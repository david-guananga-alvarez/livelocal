import React, { useMemo, useState } from 'react';
import { Search, Video, CheckCircle, MapPin } from 'lucide-react';
import { zones, prices } from '../../data/seed';
import { getMatchingLocals, statusLabel } from '../matching/matching';
import { formatDistance } from '../location/location';
import ZoneMap from '../../components/ZoneMap';
import SessionWorkspace from '../session/SessionWorkspace';
import { createRequest } from '../requests/requestsService';
import { useAuth } from '../auth/AuthProvider';

export default function ClientView({ state, setState }) {
  const { user } = useAuth();

  const [zone, setZone] = useState('gothic');
  const [duration, setDuration] = useState(15);
  const [notes, setNotes] = useState(
    'Enséñame la zona en directo y responde dudas.'
  );

  const activeRequests = state.requests
    .filter(
      r =>
        r.clientId === user?.id &&
        r.status !== 'completed' &&
        r.status !== 'cancelled'
    )
    .reverse();

  const selectedZone = zones.find(z => z.id === zone);

  const matches = useMemo(
    () => getMatchingLocals(state.locals, zone, zones),
    [state.locals, zone]
  );

  async function requestNow() {
    const best = matches[0];

    const req = {
      id: crypto.randomUUID(),
      clientId: user.id,
      zoneId: zone,
      zoneName: selectedZone.name,
      zoneCenter: selectedZone.center,
      duration,
      price: prices[duration],
      notes,
      status: 'pending',
      createdAt: new Date().toLocaleString(),
      localId: null,
      candidateLocalIds: matches.map(m => m.id),
      bestEta: best?.etaMinutes ?? selectedZone.eta,
      bestDistanceKm: best?.distanceKm ?? null,
    };

    try {
      await createRequest(req);

      setState(prev => ({
        ...prev,
        requests: [...prev.requests, req],
      }));
    } catch (error) {
      console.error('Error creando petición en Supabase:', error);
      alert('No se pudo crear la petición');
    }
  }

  function startSession(requestId) {
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r =>
        r.id === requestId
          ? { ...r, status: 'in_progress' }
          : r
      ),
    }));
  }

  function complete(requestId) {
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r =>
        r.id === requestId
          ? { ...r, status: 'completed' }
          : r
      ),
    }));
  }

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">LiveLocal Barcelona</p>

        <h1>
          Pide ojos humanos en una zona, como pedir un Uber.
        </h1>

        <p>
          Ahora el matching usa zonas + distancia aproximada de los locales disponibles.
        </p>
      </section>

      {activeRequests.length > 0 && (
        <section className="card">
          <h2>Mis peticiones activas</h2>

          <div className="stack">
            {activeRequests.map(request => {
              const local = state.locals.find(
                l => l.id === request.localId
              );

              return (
                <div className="requestCard" key={request.id}>
                  <div>
                    <b>{request.zoneName}</b>

                    <p>
                      {request.duration} min · {request.price} €
                    </p>

                    <small>
                      {statusLabel(request.status)}
                    </small>
                  </div>

                  {request.status === 'pending' && (
                    <div className="searching">
                      <span></span>
                      Buscando local cercano...
                    </div>
                  )}

                  {request.status === 'matched' && (
                    <div className="matched">
                      <CheckCircle size={18} />

                      <span>
                        Local encontrado:{' '}
                        <b>{local?.name ?? 'Local'}</b>
                      </span>

                      <button
                        onClick={() => startSession(request.id)}
                      >
                        <Video size={16} />
                        Iniciar sesión
                      </button>
                    </div>
                  )}

                  {request.status === 'in_progress' && (
                    <>
                      <SessionWorkspace
                        request={request}
                        state={state}
                        setState={setState}
                        role="Cliente"
                      />

                      <button
                        className="success"
                        onClick={() => complete(request.id)}
                      >
                        Finalizar servicio
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card">
        <h2>¿Dónde necesitas un local?</h2>

        <ZoneMap
          zones={zones}
          selected={zone}
          onSelect={setZone}
        />

        <div className="coverageBox">
          <MapPin size={18} />

          <div>
            <b>{selectedZone.name}</b>

            <span>
              {matches.length} locales compatibles · ETA{' '}
              {matches[0]?.etaMinutes ?? selectedZone.eta} min
            </span>

            {matches[0] && (
              <small>
                Más cercano: {matches[0].name},{' '}
                {formatDistance(matches[0].distanceKm)}
              </small>
            )}
          </div>
        </div>

        <div className="formRow">
          <label>
            Duración

            <select
              value={duration}
              onChange={e => setDuration(+e.target.value)}
            >
              <option value="15">
                15 min · 15 €
              </option>

              <option value="30">
                30 min · 25 €
              </option>

              <option value="45">
                45 min · 35 €
              </option>
            </select>
          </label>

          <label>
            Instrucciones

            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </label>
        </div>

        <button
          className="primary big"
          onClick={requestNow}
        >
          <Search size={18} />
          Pedir local ahora
        </button>
      </section>
    </div>
  );
}