export function getBrowserLocation(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible en este navegador'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
        capturedAt: new Date().toISOString(),
      }),
      (err) => reject(err),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  });
}

export function distanceKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function toRad(value) { return value * Math.PI / 180; }

export function formatDistance(km) {
  if (km == null) return 'distancia desconocida';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function estimateEtaMinutes(km) {
  if (km == null) return null;
  const walkingKmh = 4.5;
  return Math.max(3, Math.round((km / walkingKmh) * 60));
}
