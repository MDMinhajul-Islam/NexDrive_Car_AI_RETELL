// Liveness probe for Docker HEALTHCHECK and Dokploy. Deliberately does not touch
// the database, so a Supabase outage never marks the container unhealthy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { status: "ok", uptime: Math.round(process.uptime()) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
