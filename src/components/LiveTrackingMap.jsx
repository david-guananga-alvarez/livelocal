import React from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
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

export default function LiveTrackingMap({
  localLocation,
}) {
  if (
    !localLocation ||
    !Number.isFinite(
      Number(localLocation.lat)
    ) ||
    !Number.isFinite(
      Number(localLocation.lng)
    )
  ) {
    return (
      <div className="emptyLocation">
        Esperando ubicación del Local...
      </div>
    );
  }

  const position = [
    Number(localLocation.lat),
    Number(localLocation.lng),
  ];

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
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker
          position={position}
          icon={localIcon}
        >
          <Popup>
            Local en directo
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}