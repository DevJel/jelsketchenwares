// The only place the dashboards talk to the store API.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Calls the store API. Returns the parsed JSON, or throws an ApiError with a message fit to show. */
export async function api(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Could not reach the store. Check your connection and try again.');
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    // Not JSON: fall through to the generic message below.
  }
  if (!response.ok) {
    const message = data && typeof data.error === 'string' ? data.error : 'Something went wrong. Please try again.';
    throw new ApiError(response.status, message);
  }
  return data;
}
