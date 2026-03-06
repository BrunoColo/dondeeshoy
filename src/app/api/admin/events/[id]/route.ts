import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCookie } from "@/lib/admin-auth";
import { getEventById, updateEvent, deleteEvent, UpdateEventData } from "@/lib/admin-queries";

const updateEventSchema = z
  .object({
    name: z.string().min(1).max(500).optional(),
    description: z.string().max(5000).nullable().optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    venueName: z.string().min(1).max(500).optional(),
    venueAddress: z.string().max(500).nullable().optional(),
    latitude: z.string().nullable().optional(),
    longitude: z.string().nullable().optional(),
    city: z.string().min(1).max(100).optional(),
    department: z.string().min(1).max(100).optional(),
    eventType: z.string().min(1).max(50).optional(),
    musicGenre: z.string().max(100).nullable().optional(),
    imageUrl: z.string().url().max(2000).nullable().optional(),
    ticketUrl: z.string().url().max(2000).nullable().optional(),
    priceMin: z.number().min(0).nullable().optional(),
    priceMax: z.number().min(0).nullable().optional(),
    currency: z.string().max(10).optional(),
    isFree: z.boolean().optional(),
    ageRestriction: z.number().int().min(0).max(99).nullable().optional(),
    status: z.enum(["active", "cancelled", "past"]).optional(),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const event = await getEventById(id);
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(event);
  } catch (error) {
    console.error("Error getting event:", error);
    return NextResponse.json({ error: "Failed to get event" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }
    const updated = await updateEvent(id, parsed.data as UpdateEventData);
    if (!updated) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAuthenticated = await verifyCookie();
  if (!isAuthenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteEvent(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
