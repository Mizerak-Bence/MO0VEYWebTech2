const apiBaseUrl =
  typeof window !== 'undefined' && window.location.port === '4200'
    ? 'http://localhost:3001/api'
    : '/api';

export const environment = {
  apiBaseUrl,
} as const;
