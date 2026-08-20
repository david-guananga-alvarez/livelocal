const DATASET_URL =
  'https://opendata-ajuntament.barcelona.cat/data/dataset/a25e60cd-3083-4252-9fce-81f733871cb1/resource/da9e71de-0f8e-417d-928a-56380bfd0231/download';

const AGENDA_URL = 'https://guia.barcelona.cat/ca/agenda';
const MAX_FUTURE_DAYS = 30;

function getSourceUrl(event) {
  const web = event.values?.find(
    value => value.attribute_type === 'url' && value.url_value
  );
  return web?.url_value || AGENDA_URL;
}

function getCategory(event) {
  return (
    event.classifications_data?.find(
      item => item.level === 1 && item.full_path?.startsWith('Tipologia AG')
    )?.name || 'Activitat'
  );
}

function normalizeEvent(event) {
  const coordinates = event.geo_epgs_4326_latlon;
  if (!coordinates?.lat || !coordinates?.lon) return null;

  const mainAddress =
    event.addresses?.find(address => address.main_address) || event.addresses?.[0];

  return {
    id: String(event.register_id),
    title: event.name,
    category: getCategory(event),
    startDate: event.start_date,
    endDate: event.end_date,
    address:
      mainAddress?.place ||
      [mainAddress?.road_name, mainAddress?.street_number_1]
        .filter(Boolean)
        .join(' ') ||
      'Barcelona',
    district: mainAddress?.district_name || null,
    latitude: Number(coordinates.lat),
    longitude: Number(coordinates.lon),
    free: event.tickets_data?.some(ticket => ticket.name === 'Lliure') || false,
    sourceUrl: getSourceUrl(event),
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

    const sourceEvents = await sourceResponse.json();
    const now = new Date();
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + MAX_FUTURE_DAYS);

    const activities = sourceEvents
      .filter(event => {
        const startDate = new Date(event.start_date);
        const endDate = new Date(event.end_date || event.start_date);
        return (
          event.status === 'published' &&
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
