import React from 'react';
import { Check, ChevronDown, ListChecks, Play } from 'lucide-react';
import { Button, EmptyState, StatusBadge } from '../../../components/ui/Primitives';

const statusMeta = {
  pending: { label: 'Pendiente', tone: 'neutral' },
  in_progress: { label: 'En curso', tone: 'brand' },
  completed: { label: 'Finalizada', tone: 'success' },
};

export default function SessionSuggestionQueue({
  suggestions,
  activeSuggestion,
  progressingPointId,
  expanded,
  onToggle,
  onProgress,
}) {
  return (
    <section className={`sessionSuggestionQueue ${expanded ? 'isExpanded' : ''}`} aria-labelledby="session-suggestions-title">
      <button
        type="button"
        className="sessionSuggestionQueueHeader"
        aria-expanded={expanded}
        aria-controls="session-suggestions-list"
        onClick={onToggle}
      >
        <div className="sessionSuggestionHeading">
          <span className="sessionSuggestionGrabber" aria-hidden="true" />
          <div>
            <p className="stepLabel">Plan del cliente</p>
            <h4 id="session-suggestions-title">Sugerencias de la sesión</h4>
          </div>
        </div>
        <span className="sessionSuggestionHeaderMeta">
          <StatusBadge tone={suggestions.length ? 'brand' : 'neutral'}>{suggestions.length}</StatusBadge>
          <ChevronDown size={18} aria-hidden="true" />
        </span>
      </button>
      <div id="session-suggestions-list" className="sessionSuggestionQueueBody" aria-live="polite">
        {!suggestions.length ? (
          <EmptyState icon={<ListChecks size={20} />} title="Sin acciones pendientes" description="Las sugerencias que comparta el cliente aparecerán aquí." />
        ) : (
          <div className="sessionSuggestionList">
            {suggestions.map((point, index) => {
              const meta = statusMeta[point.progressStatus] || statusMeta.pending;
              return (
                <article key={point.id} className={`sessionSuggestionCard sessionSuggestionCard-${point.progressStatus}`}>
                  <div className="sessionSuggestionNumber" aria-hidden="true">{point.progressStatus === 'completed' ? <Check size={15} /> : index + 1}</div>
                  <div className="sessionSuggestionBody">
                    <div className="sessionSuggestionTitleRow">
                      <strong>{point.title || 'Sugerencia del cliente'}</strong>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </div>
                    <small>{point.type === 'route' ? `Ruta · ${point.route.length} puntos` : point.type === 'place' ? 'Comercio o lugar' : 'Punto concreto'}</small>
                    {point.instruction && <p>{point.instruction}</p>}
                  </div>
                  {point.progressStatus === 'pending' && (
                    <Button size="sm" disabled={Boolean(activeSuggestion) || Boolean(progressingPointId)} loading={progressingPointId === point.id} aria-label={`Iniciar ${point.title || 'sugerencia del cliente'}`} onClick={() => onProgress(point, 'in_progress')}>
                      {progressingPointId !== point.id && <Play size={14} aria-hidden="true" />}{progressingPointId === point.id ? 'Iniciando…' : 'Iniciar'}
                    </Button>
                  )}
                  {point.progressStatus === 'in_progress' && (
                    <Button size="sm" disabled={Boolean(progressingPointId)} loading={progressingPointId === point.id} aria-label={`Finalizar ${point.title || 'sugerencia del cliente'}`} onClick={() => onProgress(point, 'completed')}>
                      {progressingPointId === point.id ? 'Finalizando…' : 'Finalizar'}
                    </Button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
