// Turns any axios / network failure into a friendly message + flags the UI can act on.
export function normalizeError(err) {
  // Aborted on purpose (a newer request replaced it): callers ignore these.
  if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') return { status: 0, network: false, canceled: true, fieldErrors: null, message: 'Request cancelled.' };
  if (err?.code === 'NO_API_URL') return { status: 0, network: true, fieldErrors: null, message: 'The API address is not configured. Set EXPO_PUBLIC_API_URL in frontend/.env and restart Expo with: npx expo start -c' };
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (!err?.response) {
    const timeout = err?.code === 'ECONNABORTED';
    return {
      status: 0, network: true, fieldErrors: null,
      message: timeout ? 'The server took too long to respond. Please try again.' : 'Cannot reach the server. Check your internet connection and that the API is running.',
    };
  }
  return {
    status, network: false, code: data?.code, retryAfterSeconds: data?.retryAfterSeconds, fieldErrors: data?.errors || null,
    message: (typeof data?.message === 'string' && data.message) || (status >= 500 ? 'Something went wrong on our side. Please try again.' : 'Request failed.'),
  };
}
