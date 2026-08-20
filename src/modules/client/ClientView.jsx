import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
  CheckCircle,
  MapPin,
  Navigation,
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
import LocationPickerMap from '../../components/LocationPickerMap';
import LiveTrackingMap from '../../components/LiveTrackingMap';

import SessionWorkspace from '../session/SessionWorkspace';

import {
  createRequest,
  updateRequestStatus,
} from '../requests/requestsService';

import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../auth/supabaseClient';

export default function ClientView({
  state,
  setState,
}) {
  const { user } = useAuth();

  const [zone, setZone] =
    useState('gothic');

  const [
    targetLocation,
    setTargetLocation,
  ] = useState(
    () =>
      zones.find(
        item => item.id === 'gothic'
      )?.center ?? null
  );

  const [duration, setDuration] =
    useState(15);

  const [notes, setNotes] =
    useState(
      'Enséñame la zona en directo y responde dudas.'
    );

  // --------------------------------------------------
  // REALTIME REQUESTS
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase || !user?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `client-requests-${user.id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'requests',
        },
        payload => {
          const row = payload.new;

          if (
            row.client_id !== user.id
          ) {
            return;
          }

          setState(prev => ({
            ...prev,

            requests:
              prev.requests.map(
                request =>
                  request.id === row.id
                    ? {
                        ...request,

                        status:
                          row.status,

                        localId:
                          row.local_id,

                        createdAt:
                          row.created_at ??
                          request.createdAt,

                        targetLocation:
                          row.target_latitude != null &&
                          row.target_longitude != null
                            ? {
                                lat: row.target_latitude,
                                lng: row.target_longitude,
                              }
                            : request.targetLocation,
                      }
                    : request
              ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [user?.id]);

  // --------------------------------------------------
  // REALTIME LOCAL LOCATION
  // --------------------------------------------------

  useEffect(() => {
    if (!supabase || !user?.id) {
      return;
    }

    const channel = supabase
      .channel(
        `client-local-position-${user.id}`
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'locals',
        },
        payload => {
          const row = payload.new;

          if (!row?.user_id) {
            return;
          }

          setState(prev => ({
            ...prev,

            requests:
              prev.requests.map(
                request => {
                  if (
                    request.localId !==
                    row.user_id
                  ) {
                    return request;
                  }

                  return {
                    ...request,

                    liveLocalLocation: {
                      lat:
                        row.latitude,

                      lng:
                        row.longitude,

                      accuracy:
                        row.accuracy,

                      updatedAt:
                        row.updated_at,
                    },
                  };
                }
              ),
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [user?.id]);

  // --------------------------------------------------
  // ACTIVE REQUESTS
  // --------------------------------------------------

  const activeClientStatuses = [
    'pending',
    'matched',
    'on_the_way',
    'arrived',
    'in_progress',
  ];

  const activeRequests =
    state.requests
      .filter(
        request =>
          request.clientId ===
            user?.id &&
          activeClientStatuses.includes(
            request.status
          )
      )
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );

  const selectedZone =
    zones.find(
      item =>
        item.id === zone
    );

  const matches =
    useMemo(
      () =>
        getMatchingLocals(
          state.locals,
          zone,
          zones,
          targetLocation
        ),
      [
        state.locals,
        zone,
        targetLocation,
      ]
    );

  function selectZone(zoneId) {
    const nextZone = zones.find(
      item => item.id === zoneId
    );

    setZone(zoneId);
    setTargetLocation(
      nextZone?.center ?? null
    );
  }

  // --------------------------------------------------
  // CREATE REQUEST
  // --------------------------------------------------

  async function requestNow() {
    if (!user?.id) {
      alert(
        'Debes iniciar sesión para crear una petición'
      );

      return;
    }

    if (!selectedZone) {
      alert(
        'No se pudo determinar la zona seleccionada'
      );

      return;
    }

    if (!targetLocation) {
      alert(
        'Selecciona el punto exacto de la solicitud'
      );

      return;
    }

    const best =
      matches[0];

    const request = {
      id:
        crypto.randomUUID(),

      clientId:
        user.id,

      zoneId:
        zone,

      zoneName:
        selectedZone.name,

      zoneCenter:
        selectedZone.center,

      targetLocation,

      duration,

      price:
        prices[duration],

      notes,

      status:
        'pending',

      createdAt:
        new Date().toISOString(),

      localId:
        null,

      candidateLocalIds:
        matches.map(
          local =>
            local.id
        ),

      bestEta:
        best?.etaMinutes ??
        selectedZone.eta,

      bestDistanceKm:
        best?.distanceKm ??
        null,
    };

    try {
      await createRequest(
        request
      );

      setState(prev => ({
        ...prev,

        requests: [
          ...prev.requests,
          request,
        ],
      }));
    } catch (error) {
      console.error(
        'Error creando petición:',
        error
      );

      alert(
        'No se pudo crear la petición'
      );
    }
  }

  // --------------------------------------------------
  // CANCEL
  // --------------------------------------------------

  async function cancelRequest(
    request
  ) {
    const confirmed =
      window.confirm(
        '¿Quieres cancelar esta solicitud?'
      );

    if (!confirmed) {
      return;
    }

    try {
      await updateRequestStatus(
        request.id,
        'cancelled'
      );

      setState(prev => ({
        ...prev,

        requests:
          prev.requests.map(
            current =>
              current.id ===
              request.id
                ? {
                    ...current,
                    status:
                      'cancelled',
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
  // COMPLETE
  // --------------------------------------------------

  async function complete(
    request
  ) {
    try {
      await updateRequestStatus(
        request.id,
        'completed'
      );

      setState(prev => ({
        ...prev,

        requests:
          prev.requests.map(
            current =>
              current.id ===
              request.id
                ? {
                    ...current,
                    status:
                      'completed',
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

      {activeRequests.length > 0 && (
        <section className="card">

          <h2>
            Mis peticiones activas
          </h2>

          <div className="stack">

            {activeRequests.map(
              request => {

                const local =
                  state.locals.find(
                    item =>
                      item.id ===
                      request.localId
                  );

                // --------------------------------------------------
                // VALIDAR POSICIÓN DEL LOCAL
                // --------------------------------------------------

                const hasValidLocalLocation =
                  Number.isFinite(
                    Number(
                      request
                        .liveLocalLocation
                        ?.lat
                    )
                  ) &&
                  Number.isFinite(
                    Number(
                      request
                        .liveLocalLocation
                        ?.lng
                    )
                  );

                const showLiveTracking =
                  hasValidLocalLocation &&
                  [
                    'matched',
                    'on_the_way',
                    'arrived',
                    'in_progress',
                  ].includes(
                    request.status
                  );

                return (
                  <div
                    className="requestCard activeRequestCard"
                    key={request.id}
                  >

                    {/* HEADER */}

                    <div className="activeRequestHeader">

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

                    </div>

                    {/* BODY */}

                    <div className="activeRequestBody">

                      {/* LEFT COLUMN */}

                      <div className="activeRequestInfo">

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

                            <Navigation
                              size={18}
                            />

                            <div>

                              <b>
                                Tu Local está de camino
                              </b>

                              <p>
                                Se está desplazando hacia
                                el punto solicitado.
                              </p>

                            </div>

                          </div>
                        )}

                        {/* GPS INFO */}

                        {showLiveTracking && (

                          <div className="locationBox liveLocationMeta">

                            <b>
                              <MapPin
                                size={15}
                              />
                              {' '}
                              Local en directo
                            </b>

                            <span>
                              Lat{' '}
                              {Number(
                                request
                                  .liveLocalLocation
                                  .lat
                              ).toFixed(
                                6
                              )}
                            </span>

                            <span>
                              Lng{' '}
                              {Number(
                                request
                                  .liveLocalLocation
                                  .lng
                              ).toFixed(
                                6
                              )}
                            </span>

                            <small>
                              Precisión:{' '}
                              {Math.round(
                                request
                                  .liveLocalLocation
                                  .accuracy ??
                                  0
                              )}{' '}
                              m
                            </small>

                            {request
                              .liveLocalLocation
                              .updatedAt && (

                              <small>
                                Actualizado{' '}
                                {new Date(
                                  request
                                    .liveLocalLocation
                                    .updatedAt
                                ).toLocaleTimeString()}
                              </small>
                            )}

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
                                Ya está en el punto solicitado.
                              </p>

                              <small>
                                El Local puede iniciar ahora
                                la sesión.
                              </small>

                            </div>

                          </div>
                        )}

                        {/* ACTIONS */}

                        <div className="requestActions">

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

                        </div>

                      </div>

                      {/* RIGHT COLUMN - MAP */}

                      {showLiveTracking && (

                        <div className="activeRequestMap">

                          <LiveTrackingMap
                            localLocation={
                              request.liveLocalLocation
                            }
                          />

                        </div>
                      )}

                    </div>

                    {/* SESSION FULL WIDTH */}

                    {request.status ===
                      'in_progress' && (

                      <div className="activeRequestSession">

                        <SessionWorkspace
                          request={
                            request
                          }
                          state={
                            state
                          }
                          setState={
                            setState
                          }
                          role="Cliente"
                        />

                        <div className="requestActions">

                          <button
                            className="success"
                            onClick={() =>
                              complete(
                                request
                              )
                            }
                          >
                            Finalizar servicio
                          </button>

                        </div>

                      </div>
                    )}

                  </div>
                );
              }
            )}

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
          onSelect={selectZone}
        />

        <div className="locationPickerSection">
          <div>
            <h3>Marca el punto exacto</h3>
            <p className="muted">
              Pulsa en el mapa para mover el punto de destino.
            </p>
          </div>

          <LocationPickerMap
            center={selectedZone.center}
            value={targetLocation}
            onChange={setTargetLocation}
          />

          {targetLocation && (
            <small className="muted">
              Destino: {targetLocation.lat.toFixed(6)},{' '}
              {targetLocation.lng.toFixed(6)}
            </small>
          )}
        </div>

        <div className="coverageBox">

          <MapPin
            size={18}
          />

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
              onChange={
                event =>
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
              onChange={
                event =>
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

          <Search
            size={18}
          />

          Pedir local ahora

        </button>

      </section>

    </div>
  );
}
