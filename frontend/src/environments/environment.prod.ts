export const environment = {
  production: true,
  apiUrl: 'http://localhost:8001/api/v1',
  mapboxToken: (typeof window !== 'undefined' && (window as any).__env?.MAPBOX_ACCESS_TOKEN) || '',
};

