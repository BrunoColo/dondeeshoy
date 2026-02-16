import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  return NextResponse.json({
    ok: true,
    message: "Endpoint de detalle de evento base operativo.",
    data: { id },
  });
}
