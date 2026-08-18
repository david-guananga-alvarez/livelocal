import React, { useEffect, useMemo, useState } from 'react';
import {
  UserCheck,
  Play,
  LocateFixed,
  Video,
} from 'lucide-react';

import { zones } from '../../data/seed';
import { statusLabel } from '../matching/matching';

import {
  distanceKm,
  estimateEtaMinutes,
  formatDistance,
  getBrowserLocation,
} from '../location/location';

import SessionWorkspace from '../session/SessionWorkspace';

import {
  getRequests,
  acceptRequest,
  updateRequestStatus,
} from '../requests/requestsService';

import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

export default function LocalView({ state, setState }) {
  const { user } = useAuth();

  const local = {
    id: user?.id,
    name:
      user?.user_metadata?.full_name ||
      user?.email ||
      'Local',
    zones: state.locals[0]?.zones ?? [],
    rating: state.locals[0]?.rating ?? 5,
    location: state.locals[0]?.location ?? null,
  };

  const [geoStatus, setGeoStatus] = useState('');

  // --------------------------------------------------
  // CARGAR PETICIONES DESDE SUPABASE
  // --------------------------------------------------

  useEffect(() => {
    async function loadRequests() {
      try {
        const rows = await getRequests();

        const mappedRequests = rows.map(row => {
          const zoneData = zones.find(
            z => z.id === row.zone
          );

          return {
            id: row.id,
            clientId: row.client_id,
            localId: row.local_id,

            zoneId: row.zone,
            zoneName:
              zoneData?.name ?? row.zone,
            zoneCenter:
              zoneData?.center ?? null,

            duration: row.duration_minutes,

            price:
              row.duration_minutes === 15
                ? 15
                : row.duration_minutes === 30
                ? 25
                : 35,

            notes: row.description,
            status: row.status,
            createdAt: row.created_at,

            candidateLocalIds: [],
            bestEta: zoneData?.eta ?? null,
            bestDistanceKm: null,
          };
        });

        setState(prev => ({
          ...prev,
          requests: mappedRequests,
        }));
      } catch (error) {
        console.error(
          'Error cargando peticiones desde Supabase:',
          error
        );
      }
    }

    loadRequests();
  }, []);

  // --------------------------------------------------
  // REALTIME REQUESTS
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
        },
        payload => {
          console.log(
            'Cambio realtime en requests:',
            payload
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // --------------------------------------------------
  // PETICIONES + DISTANCIA
  // --------------------------------------------------

  const enrichedRequests = useMemo(() => {
    return state.requests.map(request => {
      const zoneCenter =
        request.zoneCenter ||
        zones.find(
          z => z.id === request.zoneId
        )?.center;

      const km = distanceKm(
        local.location,
        zoneCenter
      );

      return {
        ...request,
        distanceKm: km,
        etaMinutes:
          estimateEtaMinutes(km),
      };
    });
  }, [state.requests, local.location]);

  // Peticiones pendientes de OTROS usuarios
  const incoming = enrichedRequests.filter(
    request =>
      request.status === 'pending' &&
      request.clientId &&
      request.clientId !== user?.id &&
      (
        local.zones.includes(
          request.zoneId
        ) ||
        request.distanceKm <= 3
      )
  );

  // Petición que este Local tiene asignada
  const mine = enrichedRequests.find(
    request =>
      request.localId === local.id &&
      request.status !== 'completed' &&
      request.status !== 'cancelled'
  );

  // --------------------------------------------------
  // ACEPTAR
  // pending -> matched
  // --------------------------------------------------

  async function accept(request) {
    try {
      await acceptRequest(
        request.id,
        local.id
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'matched',
                localId: local.id,
                acceptedAt:
                  new Date().toLocaleString(),
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error aceptando petición:',
        error
      );

      alert(
        'No se pudo aceptar la petición'
      );
    }
  }

  // --------------------------------------------------
  // INICIAR DESPLAZAMIENTO
  // matched -> on_the_way
  // --------------------------------------------------

  async function startRoute(request) {
    try {
      await updateRequestStatus(
        request.id,
        'on_the_way'
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'on_the_way',
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error iniciando desplazamiento:',
        error
      );

      alert(
        'No se pudo iniciar el desplazamiento'
      );
    }
  }

  // --------------------------------------------------
  // MARCAR LLEGADA
  // on_the_way -> arrived
  // --------------------------------------------------

  async function markArrived(request) {
    try {
      await updateRequestStatus(
        request.id,
        'arrived'
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'arrived',
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error marcando llegada:',
        error
      );

      alert(
        'No se pudo marcar la llegada'
      );
    }
  }

  // --------------------------------------------------
  // CANCELAR SERVICIO
  // matched / on_the_way -> cancelled
  // --------------------------------------------------

  async function cancelService(request) {
    const confirmed = window.confirm(
      '¿Quieres cancelar este servicio?'
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
        'Error cancelando servicio:',
        error
      );

      alert(
        'No se pudo cancelar el servicio'
      );
    }
  }

  // --------------------------------------------------
  // INICIAR SESIÓN
  // arrived -> in_progress
  // --------------------------------------------------

  async function startSession(request) {
    try {
      await updateRequestStatus(
        request.id,
        'in_progress'
      );

      setState(prev => ({
        ...prev,
        requests: prev.requests.map(current =>
          current.id === request.id
            ? {
                ...current,
                status: 'in_progress',
              }
            : current
        ),
      }));
    } catch (error) {
      console.error(
        'Error iniciando sesión:',
        error
      );

      alert(
        'No se pudo iniciar la sesión'
      );
    }
  }

  // --------------------------------------------------
  // ACTUALIZAR UBICACIÓN
  // --------------------------------------------------

  async function updateLocation() {
    setGeoStatus(
      'Pidiendo permiso de ubicación...'
    );

    try {
      const location =
        await getBrowserLocation();

      setState(prev => ({
        ...prev,
        locals: prev.locals.map(
          (storedLocal, index) =>
            index === 0
              ? {
                  ...storedLocal,
                  location,
                }
              : storedLocal
        ),
      }));

      setGeoStatus(
        `Ubicación actualizada · precisión ${Math.round(
          location.accuracy
        )} m`
      );
    } catch (error) {
      setGeoStatus(
        error?.message ||
          'No se pudo obtener la ubicación'
      );
    }
  }

  // --------------------------------------------------
  // LOCAL CON SERVICIO ACTIVO
  // --------------------------------------------------

  if (mine) {
    return (
      <div className="stack">
        <section className="hero compact">
          <p className="eyebrow">
            Local
          </p>

          <h1>
            {statusLabel(mine.status)}
          </h1>

          <p>
            {mine.zoneName} ·{' '}
            {mine.duration} min ·{' '}
            {mine.price} € ·{' '}
            {formatDistance(
              mine.distanceKm
            )}
          </p>

          {mine.status === 'matched' && (
            <button
              onClick={() =>
                startRoute(mine)
              }
            >
              <Play size={16} />
              Iniciar desplazamiento
            </button>
          )}

          {mine.status === 'on_the_way' && (
            <div className="stack">
              <p className="statusLine">
                Te estás desplazando hacia
                el punto solicitado.
              </p>

              <button
                onClick={() =>
                  markArrived(mine)
                }
              >
                <LocateFixed size={16} />
                He llegado
              </button>
            </div>
          )}

          {mine.status === 'arrived' && (
            <div className="stack">
              <p className="statusLine">
                Has llegado al punto solicitado.
              </p>

              <button
                onClick={() =>
                  startSession(mine)
                }
              >
                <Video size={16} />
                Entrar en sesión
              </button>
            </div>
          )}

          {['matched', 'on_the_way'].includes(
            mine.status
          ) && (
            <button
              className="danger"
              onClick={() =>
                cancelService(mine)
              }
            >
              Cancelar servicio
            </button>
          )}
        </section>

        {mine.status === 'in_progress' && (
          <SessionWorkspace
            request={mine}
            state={state}
            setState={setState}
            role="Local"
          />
        )}
      </div>
    );
  }

  // --------------------------------------------------
  // LOCAL DISPONIBLE
  // --------------------------------------------------

  return (
    <div className="stack">
      <section className="hero compact">
        <p className="eyebrow">
          Local conectado
        </p>

        <h1>{local.name}</h1>

        <p>
          Zonas:{' '}
          {local.zones.join(', ')} · ⭐{' '}
          {local.rating}
        </p>

        <div className="geoActions">
          <button
            onClick={updateLocation}
          >
            <LocateFixed size={16} />
            Usar mi ubicación actual
          </button>

          {geoStatus && (
            <small>
              {geoStatus}
            </small>
          )}

          {local.location && (
            <small>
              Lat{' '}
              {local.location.lat.toFixed(4)}
              , Lng{' '}
              {local.location.lng.toFixed(4)}
            </small>
          )}
        </div>
      </section>

      <section className="card">
        <h2>
          Solicitudes entrantes
        </h2>

        {incoming.length === 0 ? (
          <p className="muted">
            No hay solicitudes compatibles
            ahora.
          </p>
        ) : (
          incoming.map(request => (
            <div
              className="requestCard"
              key={request.id}
            >
              <div>
                <b>
                  {request.zoneName}
                </b>

                <span>
                  {request.duration} min ·{' '}
                  {request.price} € ·{' '}
                  {formatDistance(
                    request.distanceKm
                  )}{' '}
                  ·{' '}
                  {request.etaMinutes ??
                    '—'}{' '}
                  min
                </span>

                <small>
                  {request.notes}
                </small>
              </div>

              <button
                onClick={() =>
                  accept(request)
                }
              >
                <UserCheck size={16} />
                Aceptar
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}