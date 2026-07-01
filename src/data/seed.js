export const zones = [
  { id: 'gothic', name: 'Gòtic', coverage: 'Alta', eta: 4, locals: 3, center: { lat: 41.3839, lng: 2.1763 } },
  { id: 'born', name: 'Born', coverage: 'Alta', eta: 6, locals: 2, center: { lat: 41.3852, lng: 2.1836 } },
  { id: 'barceloneta', name: 'Barceloneta', coverage: 'Media', eta: 9, locals: 1, center: { lat: 41.3792, lng: 2.1896 } },
  { id: 'gracia', name: 'Gràcia', coverage: 'Media', eta: 12, locals: 1, center: { lat: 41.4036, lng: 2.1587 } },
  { id: 'poblenou', name: 'Poblenou', coverage: 'Baja', eta: 18, locals: 0, center: { lat: 41.4035, lng: 2.2036 } },
  { id: 'sagrada', name: 'Sagrada Família', coverage: 'Alta', eta: 7, locals: 2, center: { lat: 41.4036, lng: 2.1744 } },
];
export const initialLocals = [
  { id: 'local-marc', name: 'Marc', rating: 4.9, available: true, zones: ['gothic','born','sagrada'], languages: ['ES','CA','EN'], location: { lat: 41.386, lng: 2.176, accuracy: 40, capturedAt: new Date().toISOString() } },
  { id: 'local-laia', name: 'Laia', rating: 4.8, available: true, zones: ['barceloneta','born'], languages: ['ES','EN'], location: { lat: 41.379, lng: 2.188, accuracy: 35, capturedAt: new Date().toISOString() } },
  { id: 'local-joan', name: 'Joan', rating: 4.7, available: true, zones: ['gracia','gothic'], languages: ['CA','ES'], location: { lat: 41.402, lng: 2.160, accuracy: 60, capturedAt: new Date().toISOString() } },
];
export const prices = { 15: 15, 30: 25, 45: 35 };
