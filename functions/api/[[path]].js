import { handle } from '../_shared/app.js';

// Cloudflare Pages Function: every request to /api/* is handled by the store router.
export const onRequest = ({ request, env }) => handle(request, env);
