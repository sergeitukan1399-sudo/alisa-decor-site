// Cloudflare Worker entry: /api/* goes to the same handlers as Pages Functions, everything else is static assets.
import { onRequest as order } from '../functions/api/order.js';
import { onRequest as tg } from '../functions/api/tg.js';

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/order') return order({ request, env, ctx });
    if (pathname === '/api/tg') return tg({ request, env, ctx });
    return env.ASSETS.fetch(request);
  },
};
