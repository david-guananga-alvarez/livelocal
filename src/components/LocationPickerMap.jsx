import React from 'react';

import {
  MapContainer,
  Marker,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';

import L from 'leaflet';

import 'leaflet/dist/leaflet.css';

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

function LocationMarker({ position, onChange }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    },
  });

  return position ? (
    <Marker
      position={[position.lat, position.lng]}
      icon={targetIcon}
    />
  ) : null;
}

export default function LocationPickerMap({
  center,
  value,
  onChange,
}) {
  return (
    <div className="locationPickerMap">
      <MapContainer
        key={`${center.lat}-${center.lng}`}
        center={[center.lat, center.lng]}
        zoom={16}
        scrollWheelZoom
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <LocationMarker
          position={value}
          onChange={onChange}
        />
      </MapContainer>
    </div>
  );
}
