import { distanceKm, estimateEtaMinutes } from '../location/location';

export function getMatchingLocals(
  locals,
  targetLocation,
  radiusKm = 3
) {
  if (!targetLocation) return [];

  return locals
    .filter(
      local =>
        local.available &&
        distanceKm(local.location, targetLocation) <= radiusKm
    )
    .map(l => {
      const km = distanceKm(l.location, targetLocation);
      return { ...l, distanceKm: km, etaMinutes: estimateEtaMinutes(km) };
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function statusLabel(status){ return ({ searching:'Buscando local', pending:'Esperando aceptación', matched:'Local asignado', in_progress:'Sesión activa', completed:'Completado', cancelled:'Cancelado' })[status] || status; }
