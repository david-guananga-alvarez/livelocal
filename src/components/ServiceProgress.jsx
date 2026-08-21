import React from 'react';

const steps = [
  ['pending', 'Buscando'],
  ['matched', 'Asignado'],
  ['on_the_way', 'En camino'],
  ['arrived', 'Ha llegado'],
  ['in_progress', 'Sesión'],
  ['completed', 'Completado'],
];

export default function ServiceProgress({ status }) {
  const current = steps.findIndex(([value]) => value === status);
  const cancelled = status === 'cancelled';

  return (
    <div className="serviceProgress" aria-label={`Progreso: ${cancelled ? 'Cancelado' : steps[current]?.[1] || status}`}>
      {steps.map(([value, label], index) => (
        <div className={index < current ? 'done' : index === current ? 'current' : ''} key={value}>
          <span aria-hidden="true">{index < current ? '✓' : index + 1}</span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}
