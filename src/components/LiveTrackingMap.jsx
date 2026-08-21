import React from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

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

const pointIcon = new L.DivIcon({
  className: 'sessionPointMarker',
  html: '<span aria-hidden="true">!</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function MapClickHandler({ enabled, onSelect }) {
  useMapEvents({
    click(event) {
      if (enabled) onSelect?.({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export default function LiveTrackingMap({
  localLocation,
  targetLocation,
  sessionPoints = [],
  canAddPoint = false,
  onPointSelected,
  onDeletePoint,
}) {
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
        <MapClickHandler enabled={canAddPoint} onSelect={onPointSelected} />
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {validLocation(localLocation) && (
          <Marker position={[Number(localLocation.lat), Number(localLocation.lng)]} icon={localIcon}>
            <Popup>Local en directo</Popup>
          </Marker>
        )}
        {sessionPoints.map((point, index) => (
          <Marker key={point.id} position={[point.location.lat, point.location.lng]} icon={pointIcon}>
            <Popup>
              <strong>Punto {index + 1}</strong>
              <p>{point.instruction || 'Dirígete a este punto'}</p>
              {onDeletePoint && <button type="button" className="linkButton" onClick={() => onDeletePoint(point.id)}>Eliminar punto</button>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
