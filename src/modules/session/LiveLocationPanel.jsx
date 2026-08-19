import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation, Square, Gauge, Crosshair } from 'lucide-react';
import { distanceKm, estimateEtaMinutes, formatDistance, getBrowserLocation } from '../location/location';
import {
  qualityFromAccuracy,
  normalizePosition,
  processLocationCandidate,
  startOptimizedTracking,
  stopOptimizedTracking,
} from '../location/liveTracking';


export default function LiveLocationPanel({ request, state, setState, role }) {
  const [status, setStatus] = useState('');
  const [tracking, setTracking] = useState(false);
  const [lastIgnored, setLastIgnored] = useState('');
  const watchIdRef = useRef(null);
  const lastAcceptedRef = useRef(request?.liveLocation || null);
  const isLocal = role === 'Local';
  const liveLocation = request?.liveLocation;
  const quality = qualityFromAccuracy(liveLocation?.accuracy);
  const distanceToTarget = distanceKm(liveLocation, request?.zoneCenter);
  const eta = estimateEtaMinutes(distanceToTarget);

  const mapsUrl = useMemo(() => {
    if (!liveLocation) return null;
    const lat = Number(liveLocation.lat).toFixed(7);
    const lng = Number(liveLocation.lng).toFixed(7);
    return `https://maps.google.com/maps?q=${lat},${lng}&z=19&output=embed`;
  }, [liveLocation?.lat, liveLocation?.lng]);

  function saveLocation(location) {
    lastAcceptedRef.current = location;
    setState(prev => ({
      ...prev,
      requests: prev.requests.map(r => r.id === request.id ? {
        ...r,
        liveLocation: {
          ...location,
          sharedBy: role,
          updatedAt: new Date().toISOString(),
        }
      } : r)
    }));
  }

function acceptCandidate(
  candidate,
  { force = false } = {}
) {
  const result =
    processLocationCandidate(
      lastAcceptedRef.current,
      candidate,
      { force }
    );

  if (!result.accepted) {
    setLastIgnored(
      result.reason
    );

    setStatus(
      result.reason
    );

    return;
  }

  const improved =
    result.location;

  saveLocation(improved);

  setStatus(
    `GPS actualizado · precisión ${
      improved.accuracy
    } m · calidad ${
      result.quality.label
    }`
  );
}

  function startLiveTracking() {
  if (
    watchIdRef.current != null
  ) {
    return;
  }

  setStatus(
    'Buscando señal GPS precisa... Mantén el móvil con ubicación precisa activada.'
  );

  setTracking(true);
  setLastIgnored('');

  try {
    watchIdRef.current =
      startOptimizedTracking({
        initialLocation:
          lastAcceptedRef.current,

        onLocation: (
          location,
          quality
        ) => {
          saveLocation(location);

          setStatus(
            `GPS actualizado · precisión ${
              location.accuracy
            } m · calidad ${
              quality.label
            }`
          );
        },

        onRejected: reason => {
          setLastIgnored(reason);
          setStatus(reason);
        },

        onError: error => {
          setStatus(
            error?.message ||
              'Error al compartir ubicación'
          );

          setTracking(false);
        },
      });
  } catch (error) {
    setStatus(
      error?.message ||
        'No se pudo iniciar el GPS'
    );

    setTracking(false);
  }
}

  function stopLiveTracking() {
  stopOptimizedTracking(
    watchIdRef.current
  );

  watchIdRef.current = null;

  setTracking(false);

  setStatus(
    'GPS en directo detenido'
  );
}

  useEffect(() => {
    lastAcceptedRef.current = request?.liveLocation || null;
  }, [request?.id]);

  useEffect(() => () => stopLiveTracking(), []);

  return (
    <section className="card liveLocationCard">
      <div className="sectionHeader">
        <div>
          <h3>GPS del local en directo</h3>
          <p className="muted">Ubicación exacta visible solo durante esta sesión.</p>
        </div>
        <Navigation size={20} />
      </div>

      {isLocal ? (
        <div className="locationActions">
          <button onClick={shareOnce}><LocateFixed size={16}/> Compartir ubicación precisa</button>
          <button className="primary" onClick={startLiveTracking} disabled={tracking}><Navigation size={16}/> Activar tracking optimizado</button>
          <button className="danger" onClick={stopLiveTracking}><Square size={16}/> Detener GPS</button>
        </div>
      ) : (
        <p className="hint">Cuando el local active su GPS, verás su posición exacta en Google Maps. La app descarta lecturas malas y suaviza saltos.</p>
      )}

      {status && <p className="hint">{status}</p>}
      {lastIgnored && <p className="hint warningHint">{lastIgnored}</p>}

      {liveLocation ? (
        <div className="locationBox googleLocationBox">
          <div className="locationQualityRow">
            <div className={`qualityPill ${quality.className}`}>
              <Gauge size={15}/>
              Precisión {quality.label}: {liveLocation.accuracy} m
            </div>
            <div className="qualityHint"><Crosshair size={15}/> {quality.hint}</div>
          </div>

          <div className="locationMeta">
            <div>
              <b><MapPin size={15}/> Local en directo</b>
              <span>Lat {liveLocation.lat.toFixed(7)} · Lng {liveLocation.lng.toFixed(7)}</span>
              <small>Actualizado {new Date(liveLocation.updatedAt || liveLocation.capturedAt).toLocaleTimeString()}</small>
              {liveLocation.smoothed && <small>Posición estabilizada · último movimiento {liveLocation.movedMeters ?? 0} m</small>}
            </div>
            <div>
              <b>Respecto a {request.zoneName}</b>
              <span>{formatDistance(distanceToTarget)} · ETA {eta ?? '—'} min</span>
              {liveLocation.speed != null && <small>Velocidad GPS: {(liveLocation.speed * 3.6).toFixed(1)} km/h</small>}
              {liveLocation.heading != null && <small>Dirección GPS: {Math.round(liveLocation.heading)}°</small>}
            </div>
          </div>

          <div className="googleMapFrameWrap">
            <iframe
              key={mapsUrl}
              title="Ubicación exacta del local en Google Maps"
              src={mapsUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="emptyLocation">GPS todavía no activado por el local.</div>
      )}
    </section>
  );
}
