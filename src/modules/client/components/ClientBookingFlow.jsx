import React, { useEffect, useRef } from 'react';
import { MapPin, Search } from 'lucide-react';
import LocationPickerMap from '../../../components/LocationPickerMap';
import { Button, Card, StatusBadge } from '../../../components/ui/Primitives';
import { prices } from '../../../data/seed';
import { formatDistance } from '../../location/location';

const stepTitles = ['¿Dónde necesitas un Local?', '¿Qué necesitas?', 'Confirma tu solicitud'];
const stepLabels = ['Destino', 'Detalles', 'Confirmación'];

function BookingHeader({ step, headingRef }) {
  return (
    <header className="bookingHeader">
      <div>
        <p className="stepLabel">Solicitud nueva</p>
        <h2 ref={headingRef} id="booking-title" tabIndex="-1">{stepTitles[step - 1]}</h2>
      </div>
      <div className="bookingSteps" role="list" aria-label={`Paso ${step} de 3`}>
        {[1, 2, 3].map(item => (
          <div key={item} role="listitem" aria-current={item === step ? 'step' : undefined}>
            <span className={item <= step ? 'active' : ''} aria-hidden="true">{item}</span>
            <span className="srOnly">Paso {item}: {stepLabels[item - 1]}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

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
  const bookingTitleRef = useRef(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current === step) return undefined;
    previousStepRef.current = step;
    const focusFrame = requestAnimationFrame(() => bookingTitleRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, [step]);

  return (
    <Card className={`bookingCard clientBookingFlow clientBookingStep-${step}`} aria-labelledby="booking-title" aria-busy={isSubmitting || undefined}>
      {step === 1 ? (
        <div className="clientMapFirst">
          <div className="clientMapCanvas">
            <LocationPickerMap variant="immersive" value={targetLocation} address={targetAddress} onChange={onLocationChange} />
          </div>
          <aside className="clientMapSheet">
            <BookingHeader step={step} headingRef={bookingTitleRef} />
            <div className="bookingIntro">
              <StatusBadge tone="brand" icon={<MapPin size={13} />}>Destino</StatusBadge>
              <h3>¿Dónde necesitas ayuda en directo?</h3>
              <p className="muted">Busca una dirección, elige una actividad o marca el punto exacto.</p>
            </div>
            {hasDestination ? (
              <div className="selectedAddress" role="status" aria-live="polite">
                <MapPin size={18} aria-hidden="true" />
                <div><b>{targetAddress}</b><small>{matches.length} locales cercanos{matches[0] && ` · ETA ${matches[0].etaMinutes} min`}</small></div>
              </div>
            ) : (
              <p className="clientDestinationHint">Selecciona un destino en el mapa para continuar.</p>
            )}
            <Button size="lg" className="big bookingNext" onClick={onContinue} disabled={!hasDestination}>Continuar</Button>
          </aside>
        </div>
      ) : (
        <BookingHeader step={step} headingRef={bookingTitleRef} />
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
            <label htmlFor="request-duration">
              Duración
              <select id="request-duration" value={duration} onChange={event => onDurationChange(+event.target.value)}>
                <option value="15">15 min · 15 €</option>
                <option value="30">30 min · 25 €</option>
                <option value="45">45 min · 35 €</option>
              </select>
            </label>
            <label htmlFor="request-notes">
              Instrucciones
              <textarea id="request-notes" value={notes} maxLength={500} aria-describedby="request-notes-hint" placeholder="Qué quieres que vea o haga el Local" onChange={event => onNotesChange(event.target.value)} />
              <small id="request-notes-hint" className="fieldHint">Opcional · máximo 500 caracteres</small>
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
