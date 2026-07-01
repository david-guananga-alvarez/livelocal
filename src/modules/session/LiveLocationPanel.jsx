import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LocateFixed, MapPin, Navigation, Square, Gauge, Crosshair } from 'lucide-react';
import { distanceKm, estimateEtaMinutes, formatDistance, getBrowserLocation } from '../location/location';

const GOOD_ACCURACY_M = 30;
const ACCEPTABLE_ACCURACY_M = 60;
const MAX_ACCEPTED_ACCURACY_M = 100;
const MAX_REASONABLE_JUMP_M = 120;

function metersBetween(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const toRad = (value) => value * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function smoothLocation(previous, next) {
  if (!previous) return next;

  const previousAccuracy = previous.accuracy || 999;
  const nextAccuracy = next.accuracy || 999;
  const movedMeters = metersBetween(previous, next);

  // If the new fix is much worse and jumps unrealistically, keep the previous location.
  if (nextAccuracy > previousAccuracy * 1.8 && movedMeters > MAX_REASONABLE_JUMP_M) {
    return {
      ...previous,
      ignoredAt: new Date().toISOString(),
      ignoredReason: `Lectura descartada: salto ${Math.round(movedMeters)} m con precisión ${nextAccuracy} m`,
    };
  }

  // Adaptive smoothing: trust good GPS fixes more, smooth weak fixes more.
  const weight = nextAccuracy <= GOOD_ACCURACY_M ? 0.85 : nextAccuracy <= ACCEPTABLE_ACCURACY_M ? 0.65 : 0.45;

  return {
    ...next,
    lat: previous.lat * (1 - weight) + next.lat * weight,
    lng: previous.lng * (1 - weight) + next.lng * weight,
    rawLat: next.lat,
    rawLng: next.lng,
    smoothed: true,
    movedMeters: Math.round(movedMeters),
  };
}

function qualityFromAccuracy(accuracy) {
  if (!accuracy && accuracy !== 0) return { label: 'Sin señal', className: 'qualityBad', hint: 'Esperando lectura GPS.' };
  if (accuracy <= 10) return { label: 'Excelente', className: 'qualityExcellent', hint: 'Precisión ideal para guiar al cliente.' };
  if (accuracy <= GOOD_ACCURACY_M) return { label: 'Buena', className: 'qualityGood', hint: 'Suficiente para ubicación en directo.' };
  if (accuracy <= ACCEPTABLE_ACCURACY_M) return { label: 'Aceptable', className: 'qualityOk', hint: 'Puede variar algunos metros.' };
  return { label: 'Baja', className: 'qualityBad', hint: 'Muévete a exterior, ventana o desactiva ahorro de batería.' };
}

function normalizePosition(pos) {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: Math.round(pos.coords.accuracy || 999),
    altitude: pos.coords.altitude,
    altitudeAccuracy: pos.coords.altitudeAccuracy,
    heading: pos.coords.heading,
    speed: pos.coords.speed,
    capturedAt: new Date().toISOString(),
  };
}

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

  function acceptCandidate(candidate, { force = false } = {}) {
    const accuracy = candidate.accuracy || 999;

    if (!force && accuracy > MAX_ACCEPTED_ACCURACY_M) {
      const message = `Lectura ignorada: precisión ${accuracy} m. Esperando mejor señal GPS.`;
      setLastIgnored(message);
      setStatus(message);
      return;
    }

    const improved = smoothLocation(lastAcceptedRef.current, candidate);
    if (improved.ignoredReason) {
      setLastIgnored(improved.ignoredReason);
      setStatus(improved.ignoredReason);
      return;
    }

    saveLocation(improved);
    const q = qualityFromAccuracy(improved.accuracy);
    setStatus(`GPS actualizado · precisión ${improved.accuracy} m · calidad ${q.label}`);
  }

  async function shareOnce() {
    setStatus('Solicitando ubicación precisa...');
    try {
      const location = await getBrowserLocation({
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      });
      acceptCandidate(location, { force: true });
    } catch (error) {
      setStatus(error?.message || 'No se pudo obtener la ubicación');
    }
  }

  function startLiveTracking() {
    if (!navigator.geolocation) {
      setStatus('Geolocalización no disponible en este navegador');
      return;
    }

    if (watchIdRef.current != null) return;

    setStatus('Buscando señal GPS precisa... Mantén el móvil con ubicación precisa activada.');
    setTracking(true);
    setLastIgnored('');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const candidate = normalizePosition(pos);
        acceptCandidate(candidate);
      },
      (error) => {
        setStatus(error?.message || 'Error al compartir ubicación');
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }

  function stopLiveTracking() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setTracking(false);
    setStatus('GPS en directo detenido');
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
