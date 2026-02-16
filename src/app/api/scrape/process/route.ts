import { NextResponse } from "next/server";

function isAuthorized(request: Request): boolean {
  const incoming = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET;

  if (!expected) {
    return false;
  }

  return incoming === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    message: "Stub de pipeline listo. Implementación en Fase 2.",
  });
}
