// Operator-only deployment variable. A malformed configured value stays closed.
// This blocks new dispatch; it does not drain requests already admitted.
export function maintenanceResponse(request, env = {}, routeOwner = 'edge') {
  const mode = env.CHECKIN_MAINTENANCE;
  if (mode === undefined || mode === '0') return null;

  return new Response(request.method === 'HEAD' ? null : JSON.stringify({
    status: 'maintenance',
    acceptingBusinessRequests: false,
    message: 'Temporarily unavailable. Please try again shortly.',
  }), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Retry-After': '60',
      'X-Checkin-Maintenance': '1',
      'X-Checkin-Route-Owner': routeOwner,
    },
  });
}
