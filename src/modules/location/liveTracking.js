export const GOOD_ACCURACY_M = 30;
export const ACCEPTABLE_ACCURACY_M = 60;
export const MAX_ACCEPTED_ACCURACY_M = 100;
export const MAX_REASONABLE_JUMP_M = 120;

export function metersBetween(a, b) {
  if (!a || !b) return 0;

  const R = 6371000;
  const toRad = value => value * Math.PI / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    R *
    Math.atan2(
      Math.sqrt(x),
      Math.sqrt(1 - x)
    )
  );
}

export function smoothLocation(previous, next) {
  if (!previous) return next;

  const previousAccuracy =
    previous.accuracy || 999;

  const nextAccuracy =
    next.accuracy || 999;

  const movedMeters =
    metersBetween(previous, next);

  // Descartar saltos grandes con una lectura GPS mucho peor
  if (
    nextAccuracy >
      previousAccuracy * 1.8 &&
    movedMeters >
      MAX_REASONABLE_JUMP_M
  ) {
    return {
      ...previous,
      ignoredAt:
        new Date().toISOString(),
      ignoredReason:
        `Lectura descartada: salto ${Math.round(
          movedMeters
        )} m con precisión ${Math.round(
          nextAccuracy
        )} m`,
    };
  }

  // Cuanto mejor sea la precisión,
  // más confiamos en la nueva lectura.
  const weight =
    nextAccuracy <= GOOD_ACCURACY_M
      ? 0.85
      : nextAccuracy <=
        ACCEPTABLE_ACCURACY_M
      ? 0.65
      : 0.45;

  return {
    ...next,

    lat:
      previous.lat *
        (1 - weight) +
      next.lat * weight,

    lng:
      previous.lng *
        (1 - weight) +
      next.lng * weight,

    rawLat: next.lat,
    rawLng: next.lng,

    smoothed: true,

    movedMeters:
      Math.round(movedMeters),
  };
}

export function qualityFromAccuracy(
  accuracy
) {
  if (
    accuracy === undefined ||
    accuracy === null
  ) {
    return {
      label: 'Sin señal',
      className: 'qualityBad',
      hint:
        'Esperando lectura GPS.',
    };
  }

  if (accuracy <= 10) {
    return {
      label: 'Excelente',
      className:
        'qualityExcellent',
      hint:
        'Precisión ideal para guiar al cliente.',
    };
  }

  if (
    accuracy <=
    GOOD_ACCURACY_M
  ) {
    return {
      label: 'Buena',
      className: 'qualityGood',
      hint:
        'Suficiente para ubicación en directo.',
    };
  }

  if (
    accuracy <=
    ACCEPTABLE_ACCURACY_M
  ) {
    return {
      label: 'Aceptable',
      className: 'qualityOk',
      hint:
        'Puede variar algunos metros.',
    };
  }

  return {
    label: 'Baja',
    className: 'qualityBad',
    hint:
      'Muévete a exterior, ventana o desactiva ahorro de batería.',
  };
}

export function normalizePosition(
  position
) {
  return {
    lat:
      position.coords.latitude,

    lng:
      position.coords.longitude,

    accuracy:
      Math.round(
        position.coords.accuracy ||
          999
      ),

    altitude:
      position.coords.altitude,

    altitudeAccuracy:
      position.coords
        .altitudeAccuracy,

    heading:
      position.coords.heading,

    speed:
      position.coords.speed,

    capturedAt:
      new Date().toISOString(),
  };
}

export function processLocationCandidate(
  previous,
  candidate,
  {
    force = false,
  } = {}
) {
  const accuracy =
    candidate.accuracy || 999;

  if (
    !force &&
    accuracy >
      MAX_ACCEPTED_ACCURACY_M
  ) {
    return {
      accepted: false,

      reason:
        `Lectura ignorada: precisión ${accuracy} m. Esperando mejor señal GPS.`,
    };
  }

  const improved =
    smoothLocation(
      previous,
      candidate
    );

  if (improved.ignoredReason) {
    return {
      accepted: false,
      reason:
        improved.ignoredReason,
    };
  }

  return {
    accepted: true,
    location: improved,
    quality:
      qualityFromAccuracy(
        improved.accuracy
      ),
  };
}

export function startOptimizedTracking({
  initialLocation = null,
  onLocation,
  onRejected,
  onError,
}) {
  if (!navigator.geolocation) {
    throw new Error(
      'Geolocalización no disponible en este navegador'
    );
  }

  let lastAccepted =
    initialLocation;

  const watchId =
    navigator.geolocation.watchPosition(
      position => {
        const candidate =
          normalizePosition(position);

        const result =
          processLocationCandidate(
            lastAccepted,
            candidate
          );

        if (!result.accepted) {
          onRejected?.(
            result.reason,
            candidate
          );

          return;
        }

        lastAccepted =
          result.location;

        onLocation?.(
          result.location,
          result.quality
        );
      },

      error => {
        onError?.(error);
      },

      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );

  return watchId;
}

export function stopOptimizedTracking(
  watchId
) {
  if (
    watchId !== null &&
    watchId !== undefined &&
    navigator.geolocation
  ) {
    navigator.geolocation.clearWatch(
      watchId
    );
  }
}