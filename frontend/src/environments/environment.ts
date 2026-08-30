export const environment = {
  production: false,
  apiUrl: 'http://localhost:8001/api/v1',
  mapboxToken: (typeof window !== 'undefined' && (window as any).__env?.MAPBOX_ACCESS_TOKEN) || '',
};

