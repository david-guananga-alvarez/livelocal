import React, { useEffect, useMemo, useState } from 'react';

import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';

import L from 'leaflet';

import ActivityLayer from './ActivityLayer';

import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 41.3874, lng: 2.1686 };
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const padDatePart = value => String(value).padStart(2, '0');

function toDateInputValue(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(
    date.getDate()
  )}`;
}

function toTimeInputValue(date) {
  return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}
let lastNominatimRequestAt = 0;
let nominatimQueue = Promise.resolve();

function fetchNominatim(path) {
  const request = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    lastNominatimRequestAt = Date.now();
    return fetch(`${NOMINATIM_URL}${path}`, {
      headers: { 'Accept-Language': 'es' },
    });
  });

  nominatimQueue = request.catch(() => {});
  return request;
}

const targetIcon = new L.Icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

function MapController({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 16);
  }, [map, position]);

  return null;
}

function LocationMarker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });

  return position ? (
    <Marker
      position={[position.lat, position.lng]}
      icon={targetIcon}
      draggable
      eventHandlers={{
        dragend(event) {
          const point = event.target.getLatLng();
          onChange({ lat: point.lat, lng: point.lng });
        },
      }}
    />
  ) : null;
}

async function reverseGeocode(position) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(position.lat),
    lon: String(position.lng),
    zoom: '18',
  });
  const response = await fetchNominatim(`/reverse?${params}`);

  if (!response.ok) throw new Error('No se pudo obtener la dirección');
  const result = await response.json();
  return result.display_name || 'Punto seleccionado en el mapa';
}

export default function LocationPickerMap({ value, address, onChange }) {
  const [query, setQuery] = useState(address || '');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showActivities, setShowActivities] = useState(false);
  const [activityStatus, setActivityStatus] = useState({
    state: 'idle',
    count: 0,
  });
  const [activityTimeMode, setActivityTimeMode] = useState('today');
  const [activityDate, setActivityDate] = useState(() =>
    toDateInputValue(new Date())
  );
  const [activityTime, setActivityTime] = useState(() =>
    toTimeInputValue(new Date())
  );

  const activityTimeRange = useMemo(() => {
    const now = new Date();

    if (activityTimeMode === 'next-hours') {
      return {
        start: now,
        end: new Date(now.getTime() + 3 * 60 * 60 * 1000),
      };
    }

    if (activityTimeMode === 'custom') {
      const start = new Date(`${activityDate}T${activityTime || '00:00'}`);
      return {
        start,
        end: new Date(start.getTime() + 3 * 60 * 60 * 1000),
      };
    }

    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { start: now, end };
  }, [activityDate, activityTime, activityTimeMode]);

  useEffect(() => {
    setQuery(address || '');
  }, [address]);

  async function searchAddress(event) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (cleanQuery.length < 3) {
      setError('Escribe al menos 3 caracteres.');
      return;
    }

    setStatus('searching');
    setError('');
    setResults([]);

    try {
      const params = new URLSearchParams({
        format: 'jsonv2',
        q: cleanQuery,
        limit: '5',
        addressdetails: '1',
      });
      const response = await fetchNominatim(`/search?${params}`);
      if (!response.ok) throw new Error('No se pudo buscar la dirección');
      const data = await response.json();
      setResults(data);
      if (!data.length) setError('No encontramos esa dirección. Prueba con más detalle.');
    } catch (searchError) {
      console.error('Error buscando dirección:', searchError);
      setError('La búsqueda no está disponible ahora mismo. Puedes marcar el punto en el mapa.');
    } finally {
      setStatus('idle');
    }
  }

  function selectResult(result) {
    const nextAddress = result.display_name;
    setQuery(nextAddress);
    setResults([]);
    onChange(
      { lat: Number(result.lat), lng: Number(result.lon) },
      nextAddress
    );
  }

  async function selectMapPoint(position) {
    setStatus('resolving');
    setError('');
    onChange(position, 'Buscando dirección…');

    try {
      onChange(position, await reverseGeocode(position));
    } catch (reverseError) {
      console.error('Error resolviendo dirección:', reverseError);
      onChange(position, `${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
      setError('No pudimos obtener el nombre de la calle, pero el punto quedó seleccionado.');
    } finally {
      setStatus('idle');
    }
  }

  function selectActivity(position, nextAddress) {
    setQuery(nextAddress);
    setResults([]);
    setError('');
    onChange(position, nextAddress);
  }

  return (
    <div className="locationPicker">
      <form className="addressSearch" onSubmit={searchAddress}>
        <label htmlFor="request-address">Dirección de destino</label>
        <div className="addressSearchRow">
          <input
            id="request-address"
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Calle, número, ciudad…"
            autoComplete="street-address"
          />
          <button type="submit" disabled={status === 'searching'}>
            {status === 'searching' ? 'Buscando…' : 'Buscar'}
          </button>
        </div>

        {results.length > 0 && (
          <ul className="addressResults">
            {results.map(result => (
              <li key={result.place_id}>
                <button type="button" onClick={() => selectResult(result)}>
                  {result.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <small className="error">{error}</small>}
      </form>

      <div className="activityLayerControl">
        <label>
          <input
            type="checkbox"
            checked={showActivities}
            onChange={event => setShowActivities(event.target.checked)}
          />
          Mostrar actividades cercanas
        </label>
        {showActivities && activityStatus.state === 'loading' && (
          <small>Cargando agenda…</small>
        )}
        {showActivities && activityStatus.state === 'ready' && (
          <small>{activityStatus.count} actividades vigentes disponibles</small>
        )}
        {showActivities && activityStatus.state === 'error' && (
          <small className="error">No se pudo cargar la agenda.</small>
        )}
      </div>

      {showActivities && (
        <div className="activityTimeFilters">
          <div className="activityTimePresets" role="group" aria-label="Cuándo">
            <button
              type="button"
              className={activityTimeMode === 'today' ? 'active' : ''}
              onClick={() => setActivityTimeMode('today')}
            >
              Hoy
            </button>
            <button
              type="button"
              className={activityTimeMode === 'next-hours' ? 'active' : ''}
              onClick={() => setActivityTimeMode('next-hours')}
            >
              Próximas 3 horas
            </button>
            <button
              type="button"
              className={activityTimeMode === 'custom' ? 'active' : ''}
              onClick={() => setActivityTimeMode('custom')}
            >
              Fecha y hora
            </button>
          </div>

          {activityTimeMode === 'custom' && (
            <div className="activityDateTimeInputs">
              <label>
                Fecha
                <input
                  type="date"
                  value={activityDate}
                  min={toDateInputValue(new Date())}
                  onChange={event => setActivityDate(event.target.value)}
                />
              </label>
              <label>
                Hora
                <input
                  type="time"
                  value={activityTime}
                  onChange={event => setActivityTime(event.target.value)}
                />
              </label>
              <small>Se mostrarán las actividades que empiezan durante las 3 horas siguientes.</small>
            </div>
          )}
        </div>
      )}

      <div className="locationPickerMap">
        <MapContainer
          center={[value?.lat ?? DEFAULT_CENTER.lat, value?.lng ?? DEFAULT_CENTER.lng]}
          zoom={value ? 16 : 13}
          scrollWheelZoom
          style={{ width: '100%', height: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapController position={value} />
          <ActivityLayer
            enabled={showActivities}
            rangeStart={activityTimeRange.start}
            rangeEnd={activityTimeRange.end}
            onSelect={selectActivity}
            onStatusChange={setActivityStatus}
          />
          <LocationMarker position={value} onChange={selectMapPoint} />
        </MapContainer>
      </div>

      <small className="muted">
        {status === 'resolving'
          ? 'Obteniendo la dirección del punto…'
          : 'También puedes pulsar el mapa o arrastrar el marcador.'}
      </small>
      <small className="muted">
        Búsqueda de direcciones © OpenStreetMap contributors
      </small>
      {showActivities && (
        <small className="muted">
          Actividades: Ajuntament de Barcelona · Open Data BCN (CC BY 4.0)
        </small>
      )}
    </div>
  );
}
