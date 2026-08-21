const DATASET_URL =
  'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id=877ccf66-9106-4ae2-be51-95a9f6469e4c&limit=6000';

const AGENDA_URL = 'https://guia.barcelona.cat/ca/agenda';
const MAX_FUTURE_DAYS = 30;
const barcelonaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getTemporalMetadata(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate || startDate);
  const durationDays = Math.max(0, Math.round((end - start) / 86400000));
  const sameDay =
    String(startDate).slice(0, 10) ===
    String(endDate || startDate).slice(0, 10);

  if (sameDay) {
    return {
      temporalType: 'point',
      temporalLabel: 'Actividad puntual',
      durationDays: 0,
    };
  }
  if (durationDays <= 30) {
    return { temporalType: 'multi-day', temporalLabel: 'Varios días', durationDays };
  }
  if (durationDays <= 90) {
    return { temporalType: 'seasonal', temporalLabel: 'Temporada', durationDays };
  }
  return {
    temporalType: 'long-running',
    temporalLabel: 'Larga duración',
    durationDays,
  };
}

function normalizeEvent(event) {
  const latitude = Number(event.geo_epgs_4326_lat);
  const longitude = Number(event.geo_epgs_4326_lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const streetNumber = event.addresses_start_street_number
    ? String(event.addresses_start_street_number)
    : '';
  const address = [event.addresses_road_name, streetNumber]
    .filter(Boolean)
    .join(' ');
  const endDate = event.end_date || event.start_date;

  return {
    id: String(event.register_id).replace(/^\uFEFF/, ''),
    title: event.name,
    category: 'Activitat',
    startDate: event.start_date,
    endDate,
    ...getTemporalMetadata(event.start_date, endDate),
    address: address || event.addresses_district_name || 'Barcelona',
    district: event.addresses_district_name || null,
    latitude,
    longitude,
    free: false,
    sourceUrl: AGENDA_URL,
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sourceResponse = await fetch(DATASET_URL, {
      headers: { Accept: 'application/json' },
    });

    if (!sourceResponse.ok) {
      throw new Error(`Open Data BCN respondió ${sourceResponse.status}`);
    }

    const sourceData = await sourceResponse.json();
    if (!sourceData.success || !Array.isArray(sourceData.result?.records)) {
      throw new Error('Open Data BCN devolvió una respuesta inválida');
    }

    const sourceEvents = sourceData.result.records;
    const today = barcelonaDateFormatter.format(new Date());
    const horizon = addDays(today, MAX_FUTURE_DAYS);

    const activities = sourceEvents
      .filter(event => {
        const startDate = String(event.start_date || '').slice(0, 10);
        const endDate = String(event.end_date || event.start_date || '').slice(
          0,
          10
        );
        return (
          /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
          /^\d{4}-\d{2}-\d{2}$/.test(endDate) &&
          endDate >= today &&
          startDate <= horizon
        );
      })
      .map(normalizeEvent)
      .filter(Boolean)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    response.setHeader(
      'Cache-Control',
      'public, s-maxage=21600, stale-while-revalidate=86400'
    );
    return response.status(200).json({
      activities,
      source: 'Open Data BCN / GuiaBCN',
      license: 'CC BY 4.0',
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error loading Open Data BCN activities:', error);
    return response.status(502).json({
      error: 'No se pudo cargar la agenda de actividades',
    });
  }
};
