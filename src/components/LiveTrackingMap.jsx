import React, { useMemo } from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMapEvents,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';
import ActivityLayer from './ActivityLayer';

// --------------------------------------------------
// ICONO DEL LOCAL
// --------------------------------------------------

const localIcon = new L.Icon({
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',

  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',

  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',

  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const pointIcons = new Map(
  ['pending', 'in_progress', 'completed'].map(status => [
    status,
    new L.DivIcon({
      className: `sessionPointMarker sessionPointMarker-${status}`,
      html: '<span aria-hidden="true">!</span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    }),
  ])
);

const ignoreActivityStatus = () => {};

function MapClickHandler({ mode, onSelect, onRouteVertex }) {
  useMapEvents({
    click(event) {
      const location = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (mode === 'point') onSelect?.(location);
      if (mode === 'route') onRouteVertex?.(location);
    },
  });
  return null;
}

export default function LiveTrackingMap({
  localLocation,
  targetLocation,
  sessionPoints = [],
  interactionMode = 'explore',
  draftRoute = [],
  onPointSelected,
  onPlaceSelected,
  onRouteVertex,
  onDeletePoint,
}) {
  const activityRange = useMemo(() => {
    const start = new Date();
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }, []);
  const validLocation = location => location && Number.isFinite(Number(location.lat)) && Number.isFinite(Number(location.lng));
  const centerLocation = validLocation(localLocation)
    ? localLocation
    : sessionPoints.find(point => validLocation(point.location))?.location || targetLocation;

  if (!validLocation(centerLocation)) {
    return (
      <div className="emptyLocation">
        Esperando una ubicación para mostrar el mapa...
      </div>
    );
  }

  const position = [Number(centerLocation.lat), Number(centerLocation.lng)];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
      }}
    >
      <MapContainer
        center={position}
        zoom={17}
        scrollWheelZoom
        style={{
          width: '100%',
          height: '100%',
          minHeight: '440px',
        }}
      >
        <MapClickHandler mode={interactionMode} onSelect={onPointSelected} onRouteVertex={onRouteVertex} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ActivityLayer
          enabled={interactionMode === 'place'}
          rangeStart={activityRange.start}
          rangeEnd={activityRange.end}
          startsOnSelectedDate={false}
          includeExtended
          onSelect={(location, label, activity) => onPlaceSelected?.({
            location,
            title: activity?.title || label,
            instruction: activity?.address || '',
          })}
          onStatusChange={ignoreActivityStatus}
          actionLabel="Sugerir este lugar"
        />

        {validLocation(localLocation) && (
          <Marker position={[Number(localLocation.lat), Number(localLocation.lng)]} icon={localIcon}>
            <Popup>Local en directo</Popup>
          </Marker>
        )}
        {sessionPoints.map((point, index) => (
          <React.Fragment key={point.id}>
            {point.type === 'route' && point.route.length > 1 && (
              <Polyline positions={point.route.map(vertex => [vertex.lat, vertex.lng])} pathOptions={{ color: '#7c3aed', weight: 6, opacity: 0.82 }} />
            )}
            <Marker position={[point.location.lat, point.location.lng]} icon={pointIcons.get(point.progressStatus) || pointIcons.get('pending')}>
              <Popup>
                <strong>{point.title || (point.type === 'route' ? `Ruta ${index + 1}` : `Punto ${index + 1}`)}</strong>
                <span className={`suggestionStatus suggestionStatus-${point.progressStatus}`}>
                  {point.progressStatus === 'in_progress' ? 'En curso' : point.progressStatus === 'completed' ? 'Finalizada' : 'Pendiente'}
                </span>
                <p>{point.instruction || (point.type === 'route' ? 'Sigue la ruta sugerida' : 'Dirígete a este punto')}</p>
                {onDeletePoint && point.progressStatus === 'pending' && <button type="button" className="linkButton" onClick={() => onDeletePoint(point.id)}>Eliminar sugerencia</button>}
              </Popup>
            </Marker>
          </React.Fragment>
        ))}
        {draftRoute.length > 1 && (
          <Polyline positions={draftRoute.map(vertex => [vertex.lat, vertex.lng])} pathOptions={{ color: '#2563eb', weight: 5, dashArray: '10 8' }} />
        )}
        {draftRoute.map((vertex, index) => (
          <CircleMarker key={`${vertex.lat}-${vertex.lng}-${index}`} center={[vertex.lat, vertex.lng]} radius={6} pathOptions={{ color: '#fff', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }} />
        ))}
      </MapContainer>
    </div>
  );
}
