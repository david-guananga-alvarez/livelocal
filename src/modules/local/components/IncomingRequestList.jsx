import React, { useState } from 'react';
import { MapPin, UserCheck } from 'lucide-react';
import { Button, Card, EmptyState, StatusBadge } from '../../../components/ui/Primitives';
import { formatDistance } from '../../location/location';

export default function IncomingRequestList({ isOnline, requests, onAccept }) {
  const [acceptingId, setAcceptingId] = useState(null);

  async function handleAccept(request) {
    if (acceptingId) return;
    setAcceptingId(request.id);
    try {
      await onAccept(request);
    } finally {
      setAcceptingId(null);
    }
  }

  if (!isOnline) {
    return <Card><EmptyState icon={<MapPin size={20} />} title="Estás desconectado" description="Conéctate como Local para recibir solicitudes cerca de ti." /></Card>;
  }

  return (
    <Card className="localIncomingCard" aria-labelledby="incoming-title">
      <div className="sectionHeader localIncomingHeader">
        <div><p className="stepLabel">Cerca de ti</p><h2 id="incoming-title">Solicitudes disponibles</h2></div>
        <StatusBadge tone={requests.length ? 'brand' : 'neutral'}>{requests.length} {requests.length === 1 ? 'solicitud' : 'solicitudes'}</StatusBadge>
      </div>
      {requests.length === 0 ? (
        <EmptyState icon={<MapPin size={20} />} title="Todo tranquilo por ahora" description="Las nuevas solicitudes compatibles aparecerán aquí automáticamente." />
      ) : (
        <div className="incomingList" aria-live="polite" aria-busy={Boolean(acceptingId) || undefined}>
          {requests.map(request => (
            <article className="requestCard incomingRequest" key={request.id}>
              <div className="incomingRequestContent">
                <b>{request.zoneName}</b>
                <div className="incomingRequestMetrics" aria-label="Datos del servicio">
                  <span aria-label={`Duración ${request.duration} minutos`}>{request.duration} min</span><span aria-label={`Precio ${request.price} euros`}>{request.price} €</span><span aria-label={`Distancia ${formatDistance(request.distanceKm)}`}>{formatDistance(request.distanceKm)}</span><span aria-label={`Llegada estimada ${request.etaMinutes ?? 'no disponible'} minutos`}>ETA {request.etaMinutes ?? '—'} min</span>
                </div>
                {request.notes && <small>{request.notes}</small>}
              </div>
              <Button loading={acceptingId === request.id} disabled={Boolean(acceptingId)} aria-label={`Aceptar solicitud para ${request.zoneName}`} onClick={() => handleAccept(request)}><UserCheck size={16} aria-hidden="true" />{acceptingId === request.id ? 'Aceptando…' : 'Aceptar'}</Button>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
