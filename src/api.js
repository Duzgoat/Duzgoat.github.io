// Point this at your Cloudflare tunnel URL in production
// For local dev it hits localhost
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'
