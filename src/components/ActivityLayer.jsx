import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, useMapEvents } from 'react-leaflet';

import { getActivities } from '../modules/activities/activitiesService';

const MAX_VISIBLE_PRIMARY = 100;
const MAX_VISIBLE_EXTENDED = 50;

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
});

const temporalPriority = {
  point: 0,
  'multi-day': 1,
  seasonal: 2,
  'long-running': 3,
};

function formatActivityDates(activity) {
  const start = dateFormatter.format(new Date(activity.startDate));
  if (activity.temporalType === 'point') return `Sólo el ${start}`;
  return `Del ${start} al ${dateFormatter.format(new Date(activity.endDate))}`;
}

export default function ActivityLayer({
  enabled,
  rangeStart,
  rangeEnd,
  startsOnSelectedDate,
  includeExtended,
  onSelect,
  onStatusChange,
}) {
  const [activities, setActivities] = useState([]);
  const [bounds, setBounds] = useState(null);

  const map = useMapEvents({
    moveend() {
      setBounds(map.getBounds());
    },
    zoomend() {
      setBounds(map.getBounds());
    },
  });

  useEffect(() => {
    setBounds(map.getBounds());
  }, [map]);

  useEffect(() => {
    if (!enabled) {
      onStatusChange({ state: 'idle', count: 0 });
      return;
    }

    let active = true;
    onStatusChange({ state: 'loading', count: 0 });
    getActivities()
      .then(data => {
        if (!active) return;
        setActivities(data);
      })
      .catch(error => {
        console.error('Error cargando actividades:', error);
        if (active) onStatusChange({ state: 'error', count: 0 });
      });

    return () => {
      active = false;
    };
  }, [enabled, onStatusChange]);

  const filteredActivities = useMemo(() => {
    const startTime = rangeStart?.getTime();
    const endTime = rangeEnd?.getTime();
    if (!enabled || !Number.isFinite(startTime) || !Number.isFinite(endTime)) {
      return [];
    }

    return activities
      .filter(activity => {
        const activityStart = new Date(activity.startDate).getTime();
        const activityEnd = new Date(
          activity.endDate || activity.startDate
        ).getTime();
        const matchesDate = startsOnSelectedDate
          ? activityStart >= startTime && activityStart <= endTime
          : activityStart <= endTime && activityEnd >= startTime;
        const matchesDuration =
          includeExtended ||
          !['seasonal', 'long-running'].includes(activity.temporalType);
        return (
          Number.isFinite(activityStart) &&
          Number.isFinite(activityEnd) &&
          matchesDate &&
          matchesDuration
        );
      })
      .sort((a, b) => {
        const priority =
          (temporalPriority[a.temporalType] ?? 4) -
          (temporalPriority[b.temporalType] ?? 4);
        return priority || new Date(a.startDate) - new Date(b.startDate);
      });
  }, [
    activities,
    enabled,
    includeExtended,
    rangeEnd,
    rangeStart,
    startsOnSelectedDate,
  ]);

  useEffect(() => {
    if (enabled && activities.length) {
      const extendedCount = filteredActivities.filter(activity =>
        ['seasonal', 'long-running'].includes(activity.temporalType)
      ).length;
      onStatusChange({
        state: 'ready',
        count: filteredActivities.length,
        primaryCount: filteredActivities.length - extendedCount,
        extendedCount,
      });
    }
  }, [activities.length, enabled, filteredActivities.length, onStatusChange]);

  const visibleActivities = useMemo(() => {
    if (!enabled || !bounds) return [];
    const inBounds = filteredActivities.filter(activity =>
      bounds.contains([activity.latitude, activity.longitude])
    );
    const primary = inBounds.filter(activity =>
      ['point', 'multi-day'].includes(activity.temporalType)
    );
    const extended = inBounds.filter(activity =>
      ['seasonal', 'long-running'].includes(activity.temporalType)
    );
    return [
      ...primary.slice(0, MAX_VISIBLE_PRIMARY),
      ...extended.slice(0, MAX_VISIBLE_EXTENDED),
    ];
  }, [bounds, enabled, filteredActivities]);

  return visibleActivities.map(activity => (
    <CircleMarker
      key={activity.id}
      center={[activity.latitude, activity.longitude]}
      radius={7}
      pathOptions={{
        color: activity.temporalType === 'point' ? '#6d28d9' : '#0369a1',
        fillColor: activity.temporalType === 'point' ? '#8b5cf6' : '#0ea5e9',
        fillOpacity: 0.85,
        weight: 2,
      }}
      bubblingMouseEvents={false}
    >
      <Popup className="activityPopup">
        <div className="activityPopupContent">
          <span className={`activityCategory activityCategory-${activity.temporalType}`}>
            {activity.temporalLabel || activity.category}
          </span>
          <b>{activity.title}</b>
          <span>{formatActivityDates(activity)}</span>
          <span>{activity.address}</span>
          {activity.free && <span className="activityFree">Gratuita</span>}
          <button
            type="button"
            onClick={() =>
              onSelect(
                { lat: activity.latitude, lng: activity.longitude },
                `${activity.title} · ${activity.address}`
              )
            }
          >
            Buscar un local aquí
          </button>
          <a href={activity.sourceUrl} target="_blank" rel="noreferrer">
            Ver fuente
          </a>
        </div>
      </Popup>
    </CircleMarker>
  ));
}
