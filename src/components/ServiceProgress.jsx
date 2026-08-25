import React from 'react';

const steps = [
  ['pending', 'Buscando'],
  ['matched', 'Asignado'],
  ['on_the_way', 'En camino'],
  ['arrived', 'Ha llegado'],
  ['in_progress', 'Sesión'],
  ['completed', 'Completado'],
];

export default function ServiceProgress({ status, compact = false }) {
  const current = steps.findIndex(([value]) => value === status);
  const cancelled = status === 'cancelled';

  return (
    <div className={`serviceProgress${compact ? ' isCompact' : ''}${cancelled ? ' isCancelled' : ''}`} aria-label={`Progreso: ${cancelled ? 'Cancelado' : steps[current]?.[1] || status}`}>
      {steps.map(([value, label], index) => (
        <div className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined} key={value}>
          <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
