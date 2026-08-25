import React from 'react';
import { CheckCircle, Clock3, MapPin, Navigation, Radio } from 'lucide-react';
import LiveTrackingMap from '../../../components/LiveTrackingMap';
import ServiceProgress from '../../../components/ServiceProgress';
import { Button, StatusBadge } from '../../../components/ui/Primitives';
import { statusLabel } from '../../matching/matching';
import SessionWorkspace from '../../session/SessionWorkspace';

function ServiceMessage({ request, local }) {
  if (request.status === 'pending') return <div className="serviceNotice isSearching"><span className="servicePulse" aria-hidden="true" /><div><b>Buscando un Local cercano</b><small>Te avisaremos en cuanto alguien acepte.</small></div></div>;
  if (request.status === 'matched') return <div className="serviceNotice"><CheckCircle size={18} /><div><b>{local?.name || 'Local encontrado'}</b><small>Preparándose para iniciar el desplazamiento.</small></div></div>;
  if (request.status === 'on_the_way') return <div className="serviceNotice"><Navigation size={18} /><div><b>Tu Local está de camino</b><small>Su posición se actualiza en tiempo real.</small></div></div>;
  if (request.status === 'arrived') return <div className="serviceNotice"><CheckCircle size={18} /><div><b>Tu Local ha llegado</b><small>La sesión puede comenzar en cualquier momento.</small></div></div>;
  return null;
}

export default function ClientActiveService({ requests, state, setState, onCancel, onComplete }) {
  return (
    <section className="clientActiveServices" aria-labelledby="client-active-title">
      <header className="activeServicesTitle">
        <div><p className="stepLabel">Servicio actual</p><h1 id="client-active-title">Todo bajo control</h1></div>
        <StatusBadge tone="brand">{requests.length} activo{requests.length === 1 ? '' : 's'}</StatusBadge>
      </header>
      {requests.map(request => {
        const local = state.locals.find(item => item.id === request.localId);
        const hasValidLocalLocation = Number.isFinite(Number(request.liveLocalLocation?.lat)) && Number.isFinite(Number(request.liveLocalLocation?.lng));
        const showLiveTracking = hasValidLocalLocation && ['matched', 'on_the_way', 'arrived', 'in_progress'].includes(request.status);
        return (
          <article className={`clientServiceSurface serviceStatus-${request.status}`} key={request.id}>
            <header className="serviceSummaryHeader">
              <div className="serviceSummaryAddress"><MapPin size={17} aria-hidden="true" /><div><small>Destino</small><h2>{request.zoneName}</h2></div></div>
              <div className="serviceSummaryMeta">
                <StatusBadge tone={request.status === 'in_progress' ? 'success' : 'brand'} icon={<Radio size={12} />}>{statusLabel(request.status)}</StatusBadge>
                <span><Clock3 size={14} />{request.duration} min</span><b>{request.price} €</b>
              </div>
            </header>
            <ServiceProgress status={request.status} compact />
            {request.status !== 'in_progress' && (
              <div className={`clientServicePreSession ${showLiveTracking ? 'hasMap' : ''}`}>
                <div className="clientServiceInfo">
                  <ServiceMessage request={request} local={local} />
                  {showLiveTracking && (
                    <details className="gpsDisclosure">
                      <summary>Información de ubicación</summary>
                      <div><span>Lat {Number(request.liveLocalLocation.lat).toFixed(6)}</span><span>Lng {Number(request.liveLocalLocation.lng).toFixed(6)}</span><span>Precisión {Math.round(request.liveLocalLocation.accuracy ?? 0)} m</span>{request.liveLocalLocation.updatedAt && <span>Actualizado {new Date(request.liveLocalLocation.updatedAt).toLocaleTimeString()}</span>}</div>
                    </details>
                  )}
                  {['pending', 'matched', 'on_the_way'].includes(request.status) && <Button variant="ghost" className="serviceCancelButton" onClick={() => onCancel(request)}>Cancelar solicitud</Button>}
                </div>
                {showLiveTracking && <div className="clientServiceMap"><LiveTrackingMap localLocation={request.liveLocalLocation} /></div>}
              </div>
            )}
            {request.status === 'in_progress' && (
              <div className="clientServiceSession">
                <SessionWorkspace request={request} state={state} setState={setState} role="Cliente" />
                <div className="serviceCompletionBar"><span>Cuando hayas terminado, cierra el servicio.</span><Button variant="secondary" onClick={() => onComplete(request)}>Finalizar servicio</Button></div>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
