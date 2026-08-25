import React from 'react';
import { MapPin, UserCheck } from 'lucide-react';
import { Button, Card, EmptyState, StatusBadge } from '../../../components/ui/Primitives';
import { formatDistance } from '../../location/location';

export default function IncomingRequestList({ isOnline, requests, onAccept }) {
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
        <div className="incomingList">
          {requests.map(request => (
            <article className="requestCard incomingRequest" key={request.id}>
              <div className="incomingRequestContent">
                <b>{request.zoneName}</b>
                <div className="incomingRequestMetrics">
                  <span>{request.duration} min</span><span>{request.price} €</span><span>{formatDistance(request.distanceKm)}</span><span>ETA {request.etaMinutes ?? '—'} min</span>
                </div>
                {request.notes && <small>{request.notes}</small>}
              </div>
              <Button onClick={() => onAccept(request)}><UserCheck size={16} aria-hidden="true" />Aceptar</Button>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
