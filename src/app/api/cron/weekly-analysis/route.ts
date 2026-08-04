import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDetectorForUser } from "@/lib/actions/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const cronHeader = request.headers.get("x-cron-secret") ?? "";
  const expected = process.env.CRON_SECRET ?? "";
  const valid =
    expected !== "" &&
    (cronHeader === expected || authHeader === `Bearer ${expected}`);

  if (!valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await db.user.findMany({ select: { id: true } });
  let created = 0;
  for (const u of users) {
    try {
      created += await runDetectorForUser(u.id);
    } catch {
      // no dejar que un usuario rompa el cron
    }
  }

  return NextResponse.json({ ok: true, users: users.length, created });
}
