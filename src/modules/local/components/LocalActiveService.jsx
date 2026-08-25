import React from 'react';
import { Clock3, LocateFixed, MapPin, Navigation, Video } from 'lucide-react';
import LiveTrackingMap from '../../../components/LiveTrackingMap';
import ServiceProgress from '../../../components/ServiceProgress';
import { Button, StatusBadge } from '../../../components/ui/Primitives';
import { statusLabel } from '../../matching/matching';
import { formatDistance } from '../../location/location';
import SessionWorkspace from '../../session/SessionWorkspace';

export default function LocalActiveService({ request, isOnline, location, geoStatus, state, setState, onStartRoute, onMarkArrived, onStartSession, onCancel }) {
  const nextAction = request.status === 'matched'
    ? { label: 'Iniciar desplazamiento', icon: Navigation, onClick: () => onStartRoute(request) }
    : request.status === 'on_the_way'
      ? { label: 'He llegado', icon: LocateFixed, onClick: () => onMarkArrived(request) }
      : request.status === 'arrived'
        ? { label: 'Entrar en sesión', icon: Video, onClick: () => onStartSession(request) }
        : null;
  const NextIcon = nextAction?.icon;

  return (
    <section className={`localActiveService status-${request.status}`} aria-labelledby="local-service-title">
      <header className="localServiceHeader">
        <div className="localServiceDestination"><MapPin size={18} /><div><p className="stepLabel">Servicio actual</p><h1 id="local-service-title">{request.zoneName}</h1></div></div>
        <div className="localServiceMetrics"><StatusBadge tone={request.status === 'in_progress' ? 'success' : 'brand'}>{statusLabel(request.status)}</StatusBadge><span><Clock3 size={14} />{request.duration} min</span><span>{formatDistance(request.distanceKm)}</span><b>{request.price} €</b></div>
      </header>
      <ServiceProgress status={request.status} compact />
      {request.status !== 'in_progress' && (
        <div className={`localServiceOperations ${isOnline && location ? 'hasMap' : ''}`}>
          {isOnline && location && <div className="localServiceMap"><LiveTrackingMap localLocation={location} /></div>}
          <aside className="localServiceActionPanel">
            <StatusBadge tone={isOnline ? 'success' : 'warning'}>{isOnline ? 'GPS compartido' : 'GPS desconectado'}</StatusBadge>
            <h2>{request.status === 'matched' ? 'Prepárate para salir' : request.status === 'on_the_way' ? 'Dirígete al destino' : 'Ya puedes iniciar la sesión'}</h2>
            <p>{request.status === 'matched' ? 'Revisa el destino antes de comenzar.' : request.status === 'on_the_way' ? 'Marca tu llegada cuando estés en el punto acordado.' : 'El cliente recibirá acceso al mapa, cámara y chat.'}</p>
            {(geoStatus || location) && <details className="gpsDisclosure"><summary>Estado de ubicación</summary><div>{geoStatus && <span>{geoStatus}</span>}{location && <><span>Lat {location.lat.toFixed(6)}</span><span>Lng {location.lng.toFixed(6)}</span><span>Precisión {Math.round(location.accuracy ?? 0)} m</span></>}</div></details>}
            {nextAction && <Button size="lg" className="localNextAction" onClick={nextAction.onClick}><NextIcon size={17} aria-hidden="true" />{nextAction.label}</Button>}
            {['matched', 'on_the_way'].includes(request.status) && <Button variant="ghost" className="serviceCancelButton" onClick={() => onCancel(request)}>Cancelar servicio</Button>}
          </aside>
        </div>
      )}
      {request.status === 'in_progress' && <SessionWorkspace request={request} state={state} setState={setState} role="Local" />}
    </section>
  );
}
