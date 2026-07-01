import { distanceKm, estimateEtaMinutes } from '../location/location';

export function getMatchingLocals(locals, zoneId, zones, radiusKm = 3) {
  const zone = zones.find(z => z.id === zoneId);
  const zoneCenter = zone?.center;
  return locals
    .filter(l => l.available && (l.zones.includes(zoneId) || distanceKm(l.location, zoneCenter) <= radiusKm))
    .map(l => {
      const km = distanceKm(l.location, zoneCenter);
      return { ...l, distanceKm: km, etaMinutes: estimateEtaMinutes(km) };
    })
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
}

export function statusLabel(status){ return ({ searching:'Buscando local', pending:'Esperando aceptación', matched:'Local asignado', in_progress:'Sesión activa', completed:'Completado', cancelled:'Cancelado' })[status] || status; }
