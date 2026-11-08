// Request router for /api/*. Pages Functions calls handle(); tests call it directly.
import { adminReady, adminRoutes } from './admin.js';
import { customerRoutes } from './customer.js';
import { HttpError, checkOrigin, clientIp, json, readJson } from './http.js';

const routes = [
  ['GET', '/api/health', async (ctx) => json({ ok: true, database: Boolean(ctx.env.DB), adminSignIn: adminReady(ctx.env) })],
  ...customerRoutes,
  ...adminRoutes,
].map(([method, pattern, handler]) => {
  const names = [];
  const source = pattern.replace(/:([a-z]+)/g, (_, name) => {
    names.push(name);
    return '([^/]+)';
  });
  return { method, regex: new RegExp(`^${source}$`), names, handler };
});

export async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  try {
    const matches = routes.filter((r) => r.regex.test(path));
    if (!matches.length) throw new HttpError(404, 'Not found.');
    const route = matches.find((r) => r.method === request.method);
    if (!route) throw new HttpError(405, 'Method not allowed.', { allow: matches.map((r) => r.method).join(', ') });
    if (path !== '/api/health') {
      if (!env.DB) throw new HttpError(503, 'The store service is not set up yet.');
      if (request.method !== 'GET') checkOrigin(request);
    }
    const found = route.regex.exec(path);
    const params = Object.fromEntries(route.names.map((name, i) => [name, decodeURIComponent(found[i + 1])]));
    let parsed;
    const ctx = {
      request,
      env,
      url,
      params,
      ip: clientIp(request),
      body: async () => (parsed ||= await readJson(request)),
    };
    return await route.handler(ctx);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status, { headers: error.headers });
    console.error('Store API error', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
    return json({ error: 'Something went wrong. Please try again.' }, 500);
  }
}
