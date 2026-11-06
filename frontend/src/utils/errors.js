// Turns any axios / network failure into a friendly message + flags the UI can act on.
export function normalizeError(err) {
  // Aborted on purpose (a newer request replaced it): callers ignore these.
  if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return { status: 0, network: false, canceled: true, fieldErrors: null, message: 'Request cancelled.' };
  // Setup instructions are for developers; release builds don't describe their configuration.
  if (err?.code === 'NO_API_URL') return { status: 0, network: true, fieldErrors: null, message: typeof __DEV__ !== 'undefined' && __DEV__ ? 'The API address is not configured. Set EXPO_PUBLIC_API_URL in frontend/.env and restart Expo with: npx expo start -c' : 'The app could not connect. Please update the app or try again later.' };
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (!err?.response) {
    const timeout = err?.code === 'ECONNABORTED';
    return {
      status: 0, network: true, fieldErrors: null,
      message: timeout ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your internet connection and that the API is running.',
    };
  }
  // Not signed in (or the session ran out) anywhere but the sign-in screens themselves: the app
  // opens the sign-in dialog for these, so there is no message to toast.
  const url = String(err?.config?.url || '');
  if (status === 401 && !url.startsWith('/auth/') && !url.startsWith('/v2/')) {
    return { status, network: false, signInRequired: true, fieldErrors: null, message: '' };
  }
  return {
    status, network: false, code: data?.code, retryAfterSeconds: data?.retryAfterSeconds, fieldErrors: data?.errors || null,
    // /v2 rate limits answer { error } instead of { message }.
    message: (typeof data?.message === 'string' && data.message) || (typeof data?.error === 'string' && data.error) || (status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.'),
  };
}
