const DATASET_URL =
  'https://opendata-ajuntament.barcelona.cat/data/api/action/datastore_search?resource_id=877ccf66-9106-4ae2-be51-95a9f6469e4c&limit=6000';

const AGENDA_URL = 'https://guia.barcelona.cat/ca/agenda';
const MAX_FUTURE_DAYS = 30;

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

  return {
    id: String(event.register_id).replace(/^\uFEFF/, ''),
    title: event.name,
    category: 'Activitat',
    startDate: event.start_date,
    endDate: event.end_date,
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
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + MAX_FUTURE_DAYS);

    const activities = sourceEvents
      .filter(event => {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date || event.start_date);
        return (
          Number.isFinite(startDate.getTime()) &&
          Number.isFinite(endDate.getTime()) &&
          endDate >= now &&
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
