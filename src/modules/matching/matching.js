import { distanceKm, estimateEtaMinutes } from '../location/location';

export function getMatchingLocals(
  locals,
  zoneId,
  zones,
  targetLocation = null,
  radiusKm = 3
) {
  const zone = zones.find(z => z.id === zoneId);
  const destination = targetLocation || zone?.center;
  return locals
    .filter(
      local =>
        local.available &&
        (local.zones.includes(zoneId) ||
          distanceKm(local.location, destination) <= radiusKm)
    )
    .map(l => {
      const km = distanceKm(l.location, destination);
      return { ...l, distanceKm: km, etaMinutes: estimateEtaMinutes(km) };
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function statusLabel(status){ return ({ searching:'Buscando local', pending:'Esperando aceptación', matched:'Local asignado', in_progress:'Sesión activa', completed:'Completado', cancelled:'Cancelado' })[status] || status; }
