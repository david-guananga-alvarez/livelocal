import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  CheckCircle,
  MapPin,
} from 'lucide-react';

import { zones, prices } from '../../data/seed';

import {
  getMatchingLocals,
  statusLabel,
} from '../matching/matching';

import {
  formatDistance,
} from '../location/location';

import ZoneMap from '../../components/ZoneMap';
import SessionWorkspace from '../session/SessionWorkspace';

import {
  createRequest,
  updateRequestStatus,
} from '../requests/requestsService';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';

export default function ClientView({ state, setState }) {
  const { user } = useAuth();

  const [zone, setZone] = useState('gothic');
  const [duration, setDuration] = useState(15);
  const [notes, setNotes] = useState(
    'Enséñame la zona en directo y responde dudas.'
  );

  // --------------------------------------------------
  // REALTIME DE LAS PETICIONES DEL CLIENTE
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase || !user?.id) return;

    const channel = supabase
      .channel(`client-requests-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        payload => {
          const row = payload.new;

          // Solo cambios de este cliente
          if (row.client_id !== user.id) {
            return;
          }

          console.log(
            'Cambio de estado recibido por Cliente:',
            row
          );

          setState(prev => ({
            ...prev,
            requests: prev.requests.map(request =>
              request.id === row.id
                ? {
                    ...request,
                    status: row.status,
                    localId: row.local_id,
                  }
                : request
            ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --------------------------------------------------
  // PETICIONES ACTIVAS DEL USUARIO
  // --------------------------------------------------

  const activeRequests = state.requests
    .filter(
      request =>
        request.clientId === user?.id &&
        request.status !== 'completed' &&
        request.status !== 'cancelled'
    )
    .reverse();

  const selectedZone = zones.find(
    z => z.id === zone
  );

  const matches = useMemo(
    () =>
      getMatchingLocals(
        state.locals,
        zone,
        zones
      ),
    [state.locals, zone]
  );

  // --------------------------------------------------
  // CREAR PETICIÓN
  // --------------------------------------------------

  async function requestNow() {
    const best = matches[0];

    const request = {
      id: crypto.randomUUID(),
      clientId: user.id,

      zoneId: zone,
      zoneName: selectedZone.name,
      zoneCenter: selectedZone.center,

      duration,
      price: prices[duration],
      notes,

      status: 'pending',

      createdAt:
        new Date().toLocaleString(),

      localId: null,

      candidateLocalIds:
        matches.map(local => local.id),

      bestEta:
        best?.etaMinutes ??
        selectedZone.eta,

      bestDistanceKm:
        best?.distanceKm ?? null,
    };

    try {
      await createRequest(request);

      setState(prev => ({
        ...prev,
        requests: [
          ...prev.requests,
          request,
        ],
      }));
    } catch (error) {
      console.error(
        'Error creando petición en Supabase:',
        error
      );

      alert(
        'No se pudo crear la petición'
      );
    }
  }

  // --------------------------------------------------
  // CANCELAR
  // pending / matched / on_the_way -> cancelled
  // --------------------------------------------------

  async function cancelRequest(request) {
    const confirmed = window.confirm(
      '¿Quieres cancelar esta solicitud?'
    );

    if (!confirmed) return;

    try {
      await updateRequestStatus(
        request.id,
        'cancelled'
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'cancelled',
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error cancelando solicitud:',
        error
      );

      alert(
        'No se pudo cancelar la solicitud'
      );
    }
  }

  // --------------------------------------------------
  // FINALIZAR SESIÓN
  // in_progress -> completed
  // --------------------------------------------------

  async function complete(request) {
    try {
      await updateRequestStatus(
        request.id,
        'completed'
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'completed',
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error finalizando servicio:',
        error
      );

      alert(
        'No se pudo finalizar el servicio'
      );
    }
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------

  return (
    <div className="stack">
      <section className="hero">
        <p className="eyebrow">
          LiveLocal Barcelona
        </p>

        <h1>
          Pide ojos humanos en una zona,
          como pedir un Uber.
        </h1>

        <p>
          Ahora el matching usa zonas +
          distancia aproximada de los
          locales disponibles.
        </p>
      </section>

      {/* PETICIONES ACTIVAS */}

      {activeRequests.length > 0 && (
        <section className="card">
          <h2>
            Mis peticiones activas
          </h2>

          <div className="stack">
            {activeRequests.map(request => {
              const local =
                state.locals.find(
                  item =>
                    item.id ===
                    request.localId
                );

              return (
                <div
                  className="requestCard"
                  key={request.id}
                >
                  <div>
                    <b>
                      {request.zoneName}
                    </b>

                    <p>
                      {request.duration} min ·{' '}
                      {request.price} €
                    </p>

                    <small>
                      {statusLabel(
                        request.status
                      )}
                    </small>
                  </div>

                  {/* PENDING */}

                  {request.status ===
                    'pending' && (
                    <div className="searching">
                      <span />
                      Buscando local cercano...
                    </div>
                  )}

                  {/* MATCHED */}

                  {request.status ===
                    'matched' && (
                    <div className="matched">
                      <CheckCircle
                        size={18}
                      />

                      <div>
                        <b>
                          Local encontrado
                        </b>

                        <p>
                          {local?.name ??
                            'Un Local ha aceptado tu solicitud.'}
                        </p>

                        <small>
                          Esperando a que
                          inicie el
                          desplazamiento.
                        </small>
                      </div>
                    </div>
                  )}

                  {/* ON THE WAY */}

                  {request.status ===
                    'on_the_way' && (
                    <div className="matched">
                      <CheckCircle
                        size={18}
                      />

                      <div>
                        <b>
                          Tu Local está de
                          camino
                        </b>

                        <p>
                          Se está desplazando
                          hacia el punto
                          solicitado.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ARRIVED */}

                  {request.status ===
                    'arrived' && (
                    <div className="matched">
                      <CheckCircle
                        size={18}
                      />

                      <div>
                        <b>
                          Tu Local ha llegado
                        </b>

                        <p>
                          Ya está en el punto
                          solicitado.
                        </p>

                        <small>
                          El Local puede
                          iniciar ahora la
                          sesión.
                        </small>
                      </div>
                    </div>
                  )}

                  {/* CANCELACIÓN */}

                  {[
                    'pending',
                    'matched',
                    'on_the_way',
                  ].includes(
                    request.status
                  ) && (
                    <button
                      className="danger"
                      onClick={() =>
                        cancelRequest(
                          request
                        )
                      }
                    >
                      Cancelar solicitud
                    </button>
                  )}

                  {/* SESIÓN */}

                  {request.status ===
                    'in_progress' && (
                    <>
                      <SessionWorkspace
                        request={request}
                        state={state}
                        setState={setState}
                        role="Cliente"
                      />

                      <button
                        className="success"
                        onClick={() =>
                          complete(request)
                        }
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

      {/* NUEVA PETICIÓN */}

      <section className="card">
        <h2>
          ¿Dónde necesitas un local?
        </h2>

        <ZoneMap
          zones={zones}
          selected={zone}
          onSelect={setZone}
        />

        <div className="coverageBox">
          <MapPin size={18} />

          <div>
            <b>
              {selectedZone.name}
            </b>

            <span>
              {matches.length} locales
              compatibles · ETA{' '}
              {matches[0]?.etaMinutes ??
                selectedZone.eta}{' '}
              min
            </span>

            {matches[0] && (
              <small>
                Más cercano:{' '}
                {matches[0].name},{' '}
                {formatDistance(
                  matches[0]
                    .distanceKm
                )}
              </small>
            )}
          </div>
        </div>

        <div className="formRow">
          <label>
            Duración

            <select
              value={duration}
              onChange={event =>
                setDuration(
                  +event.target.value
                )
              }
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
              onChange={event =>
                setNotes(
                  event.target.value
                )
              }
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