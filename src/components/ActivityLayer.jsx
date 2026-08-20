import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, useMapEvents } from 'react-leaflet';

import { getActivities } from '../modules/activities/activitiesService';

const MAX_VISIBLE_ACTIVITIES = 150;

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ActivityLayer({
  enabled,
  rangeStart,
  rangeEnd,
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

    return activities.filter(activity => {
      const activityStart = new Date(activity.startDate).getTime();
      return activityStart >= startTime && activityStart <= endTime;
    });
  }, [activities, enabled, rangeEnd, rangeStart]);

  useEffect(() => {
    if (enabled && activities.length) {
      onStatusChange({ state: 'ready', count: filteredActivities.length });
    }
  }, [activities.length, enabled, filteredActivities.length, onStatusChange]);

  const visibleActivities = useMemo(() => {
    if (!enabled || !bounds) return [];
    return filteredActivities
      .filter(activity =>
        bounds.contains([activity.latitude, activity.longitude])
      )
      .slice(0, MAX_VISIBLE_ACTIVITIES);
  }, [bounds, enabled, filteredActivities]);

  return visibleActivities.map(activity => (
    <CircleMarker
      key={activity.id}
      center={[activity.latitude, activity.longitude]}
      radius={7}
      pathOptions={{
        color: '#7c3aed',
        fillColor: '#8b5cf6',
        fillOpacity: 0.85,
        weight: 2,
      }}
      bubblingMouseEvents={false}
    >
      <Popup className="activityPopup">
        <div className="activityPopupContent">
          <span className="activityCategory">{activity.category}</span>
          <b>{activity.title}</b>
          <span>{dateFormatter.format(new Date(activity.startDate))}</span>
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
