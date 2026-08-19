import React, { useEffect } from 'react';

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

// --------------------------------------------------
// ICONOS LEAFLET
// --------------------------------------------------

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',

  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',

  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// --------------------------------------------------
// AJUSTAR MAPA CUANDO CAMBIAN LAS POSICIONES
// --------------------------------------------------

function MapUpdater({
  target,
  localLocation,
}) {
  const map = useMap();

  useEffect(() => {
    if (
      !target ||
      !localLocation
    ) {
      return;
    }

    const bounds =
      L.latLngBounds([
        [
          target.lat,
          target.lng,
        ],
        [
          localLocation.lat,
          localLocation.lng,
        ],
      ]);

    map.fitBounds(
      bounds,
      {
        padding: [50, 50],
        maxZoom: 17,
      }
    );
  }, [
    target?.lat,
    target?.lng,
    localLocation?.lat,
    localLocation?.lng,
  ]);

  return null;
}

export default function LiveTrackingMap({
  target,
  localLocation,
}) {
  if (!target) {
    return (
      <div className="emptyLocation">
        No hay destino disponible.
      </div>
    );
  }

  const center =
    localLocation
      ? [
          localLocation.lat,
          localLocation.lng,
        ]
      : [
          target.lat,
          target.lng,
        ];

  return (
    <div
      style={{
        height: '320px',
        width: '100%',
        borderRadius: '16px',
        overflow: 'hidden',
      }}
    >
      <MapContainer
        center={center}
        zoom={16}
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* DESTINO */}

        <Marker
          position={[
            target.lat,
            target.lng,
          ]}
        >
          <Popup>
            Punto solicitado
          </Popup>
        </Marker>

        {/* LOCAL */}

        {localLocation && (
          <Marker
            position={[
              localLocation.lat,
              localLocation.lng,
            ]}
          >
            <Popup>
              Local en directo
            </Popup>
          </Marker>
        )}

        <MapUpdater
          target={target}
          localLocation={
            localLocation
          }
        />
      </MapContainer>
    </div>
  );
}