import React from 'react';
import { LocateFixed, Radio, WifiOff } from 'lucide-react';
import LiveTrackingMap from '../../../components/LiveTrackingMap';
import { Button, StatusBadge } from '../../../components/ui/Primitives';

export default function LocalAvailabilityPanel({ isOnline, loading, geoStatus, location, onGoOnline, onGoOffline, onUpdateLocation }) {
  return (
    <section className={`hero compact localAvailability ${isOnline ? 'isOnline' : 'isOffline'}`}>
      <div className="localAvailabilityIntro">
        <div>
          <p className="eyebrow">Tu disponibilidad</p>
          <h1>{isOnline ? 'Estás disponible' : 'Empieza cuando quieras'}</h1>
          <p>{isOnline ? 'Recibirás solicitudes cercanas en tiempo real.' : 'Conéctate para recibir solicitudes cerca de ti.'}</p>
        </div>
        <StatusBadge tone={isOnline ? 'success' : 'neutral'} icon={isOnline ? <Radio size={13} /> : <WifiOff size={13} />}>
          {isOnline ? 'Disponible' : 'No disponible'}
        </StatusBadge>
      </div>

      {loading ? (
        <div className="localAvailabilityLoading" role="status"><span className="spinner" aria-hidden="true" /> Comprobando disponibilidad…</div>
      ) : isOnline ? (
        <div className="localStatusPanel">
          <div className="localStatusActions">
            <Button variant="secondary" onClick={onGoOffline}>Desconectarme</Button>
            <Button onClick={onUpdateLocation}><LocateFixed size={16} aria-hidden="true" />Actualizar ubicación</Button>
          </div>
          <div className="localLocationStatus" aria-live="polite">
            {geoStatus && <small>{geoStatus}</small>}
            {location && <small>Lat {location.lat.toFixed(6)} · Lng {location.lng.toFixed(6)}</small>}
          </div>
          {location && <div className="activeRequestMap localAvailabilityMap"><LiveTrackingMap localLocation={location} /></div>}
        </div>
      ) : (
        <div className="localStatusPanel">
          <Button size="lg" onClick={onGoOnline}><LocateFixed size={17} aria-hidden="true" />Empezar a recibir solicitudes</Button>
        </div>
      )}
    </section>
  );
}
