import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  startOptimizedTracking,
  stopOptimizedTracking,
} from '../location/liveTracking';

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

import LiveTrackingMap from '../../components/LiveTrackingMap';

import SessionWorkspace from '../session/SessionWorkspace';

import {
  getRequests,
  acceptRequest,
  updateRequestStatus,
} from '../requests/requestsService';

import { supabase } from '../auth/supabaseClient';
import { useAuth } from '../auth/AuthProvider';

import {
  goOnline,
  goOffline,
  getLocalStatus,
  updateLocalLocation,
} from './localService';

const LOCATION_HEARTBEAT_MS = 5000;

export default function LocalView({ state, setState }) {
  const { user } = useAuth();

  const local = {
    id: user?.id,

    name:
      user?.user_metadata?.full_name ||
      user?.email ||
      'Local',

    zones:
      state.locals[0]?.zones ?? [],

    rating:
      state.locals[0]?.rating ?? 5,

    location:
      state.locals[0]?.location ?? null,
  };

  const [geoStatus, setGeoStatus] =
    useState('');

  const [isOnline, setIsOnline] =
    useState(false);

  const [
    onlineLoading,
    setOnlineLoading,
  ] = useState(true);

  // --------------------------------------------------
  // REFERENCIAS GPS
  // --------------------------------------------------

  const watchIdRef = useRef(null);

  const lastTrackedLocationRef =
    useRef(null);

  const locationHeartbeatRef =
    useRef(null);

  // --------------------------------------------------
  // TRACKING GPS OPTIMIZADO + HEARTBEAT
  // --------------------------------------------------

  useEffect(() => {
    if (!isOnline || !user?.id) {
      if (watchIdRef.current != null) {
        stopOptimizedTracking(
          watchIdRef.current
        );

        watchIdRef.current = null;
      }

      if (
        locationHeartbeatRef.current != null
      ) {
        window.clearInterval(
          locationHeartbeatRef.current
        );

        locationHeartbeatRef.current = null;
      }

      return;
    }

    if (watchIdRef.current == null) {
      try {
        watchIdRef.current =
          startOptimizedTracking({
            initialLocation:
              lastTrackedLocationRef.current ||
              local.location,

            onLocation: async (
              location,
              quality
            ) => {
              lastTrackedLocationRef.current =
                location;

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
                `Ubicación en directo · precisión ${location.accuracy} m · calidad ${quality.label}`
              );

              try {
                await updateLocalLocation(
                  user.id,
                  location
                );
              } catch (error) {
                console.error(
                  'Error guardando ubicación optimizada en Supabase:',
                  error
                );
              }
            },

            onRejected: reason => {
              setGeoStatus(reason);
            },

            onError: error => {
              console.error(
                'Error en tracking optimizado:',
                error
              );

              setGeoStatus(
                error?.message ||
                  'No se pudo actualizar la ubicación'
              );
            },
          });

        console.log(
          'Tracking GPS optimizado iniciado:',
          watchIdRef.current
        );
      } catch (error) {
        console.error(
          'No se pudo iniciar tracking optimizado:',
          error
        );
      }
    }

    if (
      locationHeartbeatRef.current == null
    ) {
      locationHeartbeatRef.current =
        window.setInterval(
          async () => {
            const location =
              lastTrackedLocationRef.current;

            if (
              !location ||
              !user?.id
            ) {
              return;
            }

            try {
              await updateLocalLocation(
                user.id,
                location
              );

              console.log(
                'Heartbeat GPS enviado:',
                {
                  lat: location.lat,
                  lng: location.lng,
                  accuracy:
                    location.accuracy,
                  at:
                    new Date().toISOString(),
                }
              );
            } catch (error) {
              console.error(
                'Error enviando heartbeat GPS:',
                error
              );
            }
          },
          LOCATION_HEARTBEAT_MS
        );
    }

    return () => {
      if (
        watchIdRef.current != null
      ) {
        stopOptimizedTracking(
          watchIdRef.current
        );

        watchIdRef.current = null;
      }

      if (
        locationHeartbeatRef.current != null
      ) {
        window.clearInterval(
          locationHeartbeatRef.current
        );

        locationHeartbeatRef.current = null;
      }
    };
  }, [isOnline, user?.id]);

  // --------------------------------------------------
  // CARGAR ESTADO ONLINE/OFFLINE
  // --------------------------------------------------

  useEffect(() => {
    async function loadLocalStatus() {
      if (!user?.id) {
        setOnlineLoading(false);
        return;
      }

      try {
        const data =
          await getLocalStatus(
            user.id
          );

        setIsOnline(
          Boolean(
            data?.is_online
          )
        );

        if (
          data?.latitude != null &&
          data?.longitude != null
        ) {
          const location = {
            lat: data.latitude,
            lng: data.longitude,
            accuracy:
              data.accuracy ??
              null,
          };

          lastTrackedLocationRef.current =
            location;

          setState(prev => ({
            ...prev,

            locals:
              prev.locals.map(
                (
                  storedLocal,
                  index
                ) =>
                  index === 0
                    ? {
                        ...storedLocal,
                        location,
                      }
                    : storedLocal
              ),
          }));

          setGeoStatus(
            data.is_online
              ? `Ubicación activa${
                  data.accuracy !=
                  null
                    ? ` · precisión ${Math.round(
                        data.accuracy
                      )} m`
                    : ''
                }`
              : ''
          );
        }
      } catch (error) {
        console.error(
          'Error cargando estado del Local:',
          error
        );
      } finally {
        setOnlineLoading(false);
      }
    }

    loadLocalStatus();
  }, [user?.id]);

  // --------------------------------------------------
  // CARGAR PETICIONES DESDE SUPABASE
  // --------------------------------------------------

  useEffect(() => {
    async function loadRequests() {
      try {
        const rows =
          await getRequests();

        const mappedRequests =
          rows.map(row => {
            const zoneData =
              zones.find(
                zone =>
                  zone.id ===
                  row.zone
              );

            return {
              id:
                row.id,

              clientId:
                row.client_id,

              localId:
                row.local_id,

              zoneId:
                row.zone,

              zoneName:
                zoneData?.name ??
                row.zone,

              zoneCenter:
                zoneData?.center ??
                null,

              duration:
                row.duration_minutes,

              price:
                row.duration_minutes ===
                15
                  ? 15
                  : row.duration_minutes ===
                    30
                  ? 25
                  : 35,

              notes:
                row.description,

              status:
                row.status,

              createdAt:
                row.created_at,

              candidateLocalIds:
                [],

              bestEta:
                zoneData?.eta ??
                null,

              bestDistanceKm:
                null,
            };
          });

        setState(prev => ({
          ...prev,

          requests:
            mappedRequests,
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
    if (!supabase) {
      return;
    }

    const channel =
      supabase
        .channel(
          'requests-realtime'
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema:
              'public',
            table:
              'requests',
          },

          payload => {
            console.log(
              'Cambio realtime en requests:',
              payload
            );

            const row =
              payload.new;

            if (!row?.id) {
              return;
            }

            const zoneData =
              zones.find(
                zone =>
                  zone.id ===
                  row.zone
              );

            const mappedRequest = {
              id:
                row.id,

              clientId:
                row.client_id,

              localId:
                row.local_id,

              zoneId:
                row.zone,

              zoneName:
                zoneData?.name ??
                row.zone,

              zoneCenter:
                zoneData?.center ??
                null,

              duration:
                row.duration_minutes,

              price:
                row.duration_minutes ===
                15
                  ? 15
                  : row.duration_minutes ===
                    30
                  ? 25
                  : 35,

              notes:
                row.description,

              status:
                row.status,

              createdAt:
                row.created_at,

              candidateLocalIds:
                [],

              bestEta:
                zoneData?.eta ??
                null,

              bestDistanceKm:
                null,
            };

            setState(prev => {
              const exists =
                prev.requests.some(
                  request =>
                    request.id ===
                    row.id
                );

              if (exists) {
                return {
                  ...prev,

                  requests:
                    prev.requests.map(
                      request =>
                        request.id ===
                        row.id
                          ? {
                              ...request,
                              ...mappedRequest,
                            }
                          : request
                    ),
                };
              }

              return {
                ...prev,

                requests: [
                  ...prev.requests,
                  mappedRequest,
                ],
              };
            });
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, []);

  // --------------------------------------------------
  // PETICIONES + DISTANCIA
  // --------------------------------------------------

  const enrichedRequests =
    useMemo(() => {
      return state.requests.map(
        request => {
          const zoneCenter =
            request.zoneCenter ||
            zones.find(
              zone =>
                zone.id ===
                request.zoneId
            )?.center;

          const km =
            distanceKm(
              local.location,
              zoneCenter
            );

          return {
            ...request,

            distanceKm:
              km,

            etaMinutes:
              estimateEtaMinutes(
                km
              ),
          };
        }
      );
    }, [
      state.requests,
      local.location,
    ]);

  // --------------------------------------------------
  // ESTADOS ACTIVOS
  // --------------------------------------------------

  const activeLocalStatuses = [
    'matched',
    'on_the_way',
    'arrived',
    'in_progress',
  ];

  // --------------------------------------------------
  // SERVICIO ACTIVO DEL LOCAL
  // --------------------------------------------------

  const mine = enrichedRequests
    .filter(
      request =>
        request.localId === local.id &&
        activeLocalStatuses.includes(
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
    )[0];

  // --------------------------------------------------
  // SOLICITUDES ENTRANTES
  // --------------------------------------------------

  const incoming =
    enrichedRequests.filter(
      request =>
        !mine &&

        isOnline &&

        request.status ===
          'pending' &&

        request.clientId &&

        request.clientId !==
          user?.id &&

        (
          local.zones.includes(
            request.zoneId
          ) ||
          request.distanceKm <=
            3
        )
    );

  // --------------------------------------------------
  // ONLINE
  // --------------------------------------------------

  async function handleGoOnline() {
    if (!user?.id) {
      return;
    }

    try {
      setOnlineLoading(true);

      const location =
        await getBrowserLocation();

      lastTrackedLocationRef.current =
        location;

      await goOnline(
        user.id,
        location
      );

      setState(prev => ({
        ...prev,

        locals:
          prev.locals.map(
            (
              storedLocal,
              index
            ) =>
              index === 0
                ? {
                    ...storedLocal,
                    location,
                  }
                : storedLocal
          ),
      }));

      setGeoStatus(
        `Ubicación activa · precisión ${Math.round(
          location.accuracy
        )} m`
      );

      setIsOnline(true);
    } catch (error) {
      console.error(
        'Error poniendo Local online:',
        error
      );

      alert(
        'No se pudo activar el modo Local'
      );
    } finally {
      setOnlineLoading(false);
    }
  }

  // --------------------------------------------------
  // OFFLINE
  // --------------------------------------------------

  async function handleGoOffline() {
    if (!user?.id) {
      return;
    }

    try {
      setOnlineLoading(true);

      await goOffline(
        user.id
      );

      setIsOnline(false);

      setGeoStatus('');

      lastTrackedLocationRef.current =
        null;
    } catch (error) {
      console.error(
        'Error poniendo Local offline:',
        error
      );

      alert(
        'No se pudo desconectar el Local'
      );
    } finally {
      setOnlineLoading(false);
    }
  }

  // --------------------------------------------------
  // ACEPTAR
  // --------------------------------------------------

  async function accept(
    request
  ) {
    if (mine) {
      alert(
        'Ya tienes un servicio activo'
      );
      return;
    }

    try {
      await acceptRequest(
        request.id,
        local.id
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
                      'matched',

                    localId:
                      local.id,

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
  // matched -> on_the_way
  // --------------------------------------------------

  async function startRoute(
    request
  ) {
    try {
      await updateRequestStatus(
        request.id,
        'on_the_way'
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
                      'on_the_way',
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
  // on_the_way -> arrived
  // --------------------------------------------------

  async function markArrived(
    request
  ) {
    try {
      await updateRequestStatus(
        request.id,
        'arrived'
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
                      'arrived',
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
  // CANCELAR
  // --------------------------------------------------

  async function cancelService(
    request
  ) {
    const confirmed =
      window.confirm(
        '¿Quieres cancelar este servicio?'
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
        'Error cancelando servicio:',
        error
      );

      alert(
        'No se pudo cancelar el servicio'
      );
    }
  }

  // --------------------------------------------------
  // arrived -> in_progress
  // --------------------------------------------------

  async function startSession(
    request
  ) {
    try {
      await updateRequestStatus(
        request.id,
        'in_progress'
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
                      'in_progress',
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
  // ACTUALIZAR UBICACIÓN MANUAL
  // --------------------------------------------------

  async function updateLocation() {
    setGeoStatus(
      'Pidiendo permiso de ubicación...'
    );

    try {
      const location =
        await getBrowserLocation();

      lastTrackedLocationRef.current =
        location;

      setState(prev => ({
        ...prev,

        locals:
          prev.locals.map(
            (
              storedLocal,
              index
            ) =>
              index === 0
                ? {
                    ...storedLocal,
                    location,
                  }
                : storedLocal
          ),
      }));

      if (isOnline) {
        await updateLocalLocation(
          user.id,
          location
        );
      }

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
  // SERVICIO ACTIVO
  // --------------------------------------------------

  if (mine) {
    return (
      <div className="stack">

        <section className="hero compact">

          <p className="eyebrow">
            Local
          </p>

          <h1>
            {statusLabel(
              mine.status
            )}
          </h1>

          <p>
            {mine.zoneName} ·{' '}
            {mine.duration} min ·{' '}
            {mine.price} € ·{' '}
            {formatDistance(
              mine.distanceKm
            )}
          </p>

          {isOnline &&
            local.location && (

              <small>
                GPS compartido · Lat{' '}
                {local.location.lat.toFixed(
                  6
                )}
                {' · '}
                Lng{' '}
                {local.location.lng.toFixed(
                  6
                )}
                {' · '}
                precisión{' '}
                {Math.round(
                  local.location
                    .accuracy ?? 0
                )}{' '}
                m
              </small>
            )}

          {geoStatus && (
            <small>
              {geoStatus}
            </small>
          )}

          {/* MAPA DEL LOCAL */}

          {isOnline &&
            local.location && (

              <div
                className="activeRequestMap"
                style={{
                  marginTop:
                    '18px',
                  width:
                    '100%',
                }}
              >
                <LiveTrackingMap
                  localLocation={
                    local.location
                  }
                />
              </div>
            )}

          {/* MATCHED */}

          {mine.status ===
            'matched' && (

            <button
              onClick={() =>
                startRoute(
                  mine
                )
              }
            >
              <Play size={16} />

              Iniciar desplazamiento
            </button>
          )}

          {/* ON THE WAY */}

          {mine.status ===
            'on_the_way' && (

            <div className="stack">

              <p className="statusLine">
                Te estás desplazando
                hacia el punto
                solicitado.
              </p>

              <button
                onClick={() =>
                  markArrived(
                    mine
                  )
                }
              >
                <LocateFixed
                  size={16}
                />

                He llegado
              </button>

            </div>
          )}

          {/* ARRIVED */}

          {mine.status ===
            'arrived' && (

            <div className="stack">

              <p className="statusLine">
                Has llegado al punto
                solicitado.
              </p>

              <p className="hint">
                Tu ubicación continúa
                compartiéndose mientras
                estés Online.
              </p>

              <button
                onClick={() =>
                  startSession(
                    mine
                  )
                }
              >
                <Video
                  size={16}
                />

                Entrar en sesión
              </button>

            </div>
          )}

          {/* CANCELACIÓN */}

          {[
            'matched',
            'on_the_way',
          ].includes(
            mine.status
          ) && (

            <button
              className="danger"
              onClick={() =>
                cancelService(
                  mine
                )
              }
            >
              Cancelar servicio
            </button>
          )}

        </section>

        {/* SESIÓN */}

        {mine.status ===
          'in_progress' && (

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
  // LOCAL SIN SERVICIO ACTIVO
  // --------------------------------------------------

  return (
    <div className="stack">

      <section className="hero compact">

        <p className="eyebrow">
          Local
        </p>

        <h1>
          {local.name}
        </h1>

        <p>
          Zonas:{' '}
          {local.zones.join(
            ', '
          )}{' '}
          · ⭐ {local.rating}
        </p>

        {onlineLoading ? (

          <p className="muted">
            Comprobando disponibilidad...
          </p>

        ) : isOnline ? (

          <div className="stack">

            <p className="statusLine">
              🟢 Estás ONLINE
            </p>

            <button
              className="danger"
              onClick={
                handleGoOffline
              }
            >
              Desconectarme
            </button>

            <button
              onClick={
                updateLocation
              }
            >
              <LocateFixed
                size={16}
              />

              Actualizar ubicación
            </button>

            {geoStatus && (
              <small>
                {geoStatus}
              </small>
            )}

            {local.location && (

              <small>
                Lat{' '}
                {local.location.lat.toFixed(
                  6
                )}
                {' · '}
                Lng{' '}
                {local.location.lng.toFixed(
                  6
                )}
              </small>
            )}

            {/* MAPA DEL LOCAL ONLINE */}

            {local.location && (

              <div
                className="activeRequestMap"
                style={{
                  marginTop:
                    '16px',
                  width:
                    '100%',
                }}
              >
                <LiveTrackingMap
                  localLocation={
                    local.location
                  }
                />
              </div>
            )}

          </div>

        ) : (

          <div className="stack">

            <p className="statusLine">
              ⚪ Estás OFFLINE
            </p>

            <button
              className="primary"
              onClick={
                handleGoOnline
              }
            >
              <LocateFixed
                size={16}
              />

              Conectarme como Local
            </button>

          </div>
        )}

      </section>

      {isOnline ? (

        <section className="card">

          <h2>
            Solicitudes entrantes
          </h2>

          {incoming.length ===
          0 ? (

            <p className="muted">
              No hay solicitudes
              compatibles ahora.
            </p>

          ) : (

            incoming.map(
              request => (

                <div
                  className="requestCard"
                  key={request.id}
                >

                  <div>

                    <b>
                      {request.zoneName}
                    </b>

                    <span>
                      {request.duration}{' '}
                      min ·{' '}
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
                      accept(
                        request
                      )
                    }
                  >
                    <UserCheck
                      size={16}
                    />

                    Aceptar
                  </button>

                </div>
              )
            )
          )}

        </section>

      ) : (

        <section className="card">

          <p className="muted">
            Conéctate como Local
            para recibir solicitudes.
          </p>

        </section>
      )}

    </div>
  );
}