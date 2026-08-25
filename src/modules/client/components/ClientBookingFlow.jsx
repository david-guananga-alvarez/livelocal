import React from 'react';
import { MapPin, Search } from 'lucide-react';
import LocationPickerMap from '../../../components/LocationPickerMap';
import { Button, Card, StatusBadge } from '../../../components/ui/Primitives';
import { prices } from '../../../data/seed';
import { formatDistance } from '../../location/location';

const stepTitles = ['¿Dónde necesitas un Local?', '¿Qué necesitas?', 'Confirma tu solicitud'];

export default function ClientBookingFlow({
  step,
  targetLocation,
  targetAddress,
  matches,
  duration,
  notes,
  isSubmitting,
  onLocationChange,
  onDurationChange,
  onNotesChange,
  onStepChange,
  onContinue,
  onSubmit,
}) {
  const hasDestination = Boolean(targetLocation && targetAddress);

  return (
    <Card className="bookingCard clientBookingFlow" aria-labelledby="booking-title">
      <header className="bookingHeader">
        <div>
          <p className="stepLabel">Solicitud nueva</p>
          <h2 id="booking-title">{stepTitles[step - 1]}</h2>
        </div>
        <div className="bookingSteps" aria-label={`Paso ${step} de 3`}>
          {[1, 2, 3].map(item => <span key={item} className={item <= step ? 'active' : ''}>{item}</span>)}
        </div>
      </header>

      {step === 1 && (
        <div className="bookingPanel locationPickerSection">
          <div className="bookingIntro">
            <StatusBadge tone="brand" icon={<MapPin size={13} />}>Destino</StatusBadge>
            <h3>Busca o marca el punto exacto</h3>
            <p className="muted">Escribe una dirección o selecciónala directamente en el mapa.</p>
          </div>
          <LocationPickerMap value={targetLocation} address={targetAddress} onChange={onLocationChange} />
          {hasDestination && (
            <div className="selectedAddress" role="status">
              <MapPin size={18} aria-hidden="true" />
              <span>{targetAddress}</span>
            </div>
          )}
          <Button size="lg" className="big bookingNext" onClick={onContinue} disabled={!hasDestination}>
            Continuar con este destino
          </Button>
        </div>
      )}

      {step > 1 && (
        <div className="coverageBox compactCoverage clientDestinationSummary">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <b>{targetAddress || 'Selecciona un destino'}</b>
            <span>{matches.length} locales cercanos{matches[0] && ` · ETA ${matches[0].etaMinutes} min`}</span>
            {matches[0] && <small>Más cercano: {matches[0].name}, {formatDistance(matches[0].distanceKm)}</small>}
          </div>
          <button type="button" className="textButton" onClick={() => onStepChange(1)}>Cambiar</button>
        </div>
      )}

      {step === 2 && (
        <div className="bookingPanel clientDetailsPanel">
          <div className="formRow bookingDetails">
            <label>
              Duración
              <select value={duration} onChange={event => onDurationChange(+event.target.value)}>
                <option value="15">15 min · 15 €</option>
                <option value="30">30 min · 25 €</option>
                <option value="45">45 min · 35 €</option>
              </select>
            </label>
            <label>
              Instrucciones
              <textarea value={notes} onChange={event => onNotesChange(event.target.value)} />
            </label>
          </div>
          <div className="bookingActions">
            <Button variant="secondary" onClick={() => onStepChange(1)}>Atrás</Button>
            <Button onClick={() => onStepChange(3)}>Revisar solicitud</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bookingPanel clientConfirmationPanel">
          <div className="requestSummary" aria-label="Resumen de la solicitud">
            <StatusBadge tone="success">Listo para solicitar</StatusBadge>
            <b>{targetAddress || 'Selecciona el destino en el mapa'}</b>
            <span>{duration} min · {prices[duration]} €</span>
            {notes && <small>{notes}</small>}
          </div>
          <Button size="lg" className="big" loading={isSubmitting} onClick={onSubmit} disabled={!hasDestination}>
            {!isSubmitting && <Search size={18} aria-hidden="true" />}
            {isSubmitting ? 'Creando solicitud…' : 'Pedir local ahora'}
          </Button>
          <Button variant="secondary" size="lg" className="big" onClick={() => onStepChange(2)} disabled={isSubmitting}>Modificar detalles</Button>
        </div>
      )}
    </Card>
  );
}
