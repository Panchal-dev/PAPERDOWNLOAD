// GET /health — liveness probe with uptime and temp-store stats.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const STARTED_AT = Date.now();

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    environment: process.env.NODE_ENV ?? "development",
    nodeVersion: process.version,
  });
}
