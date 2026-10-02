import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mapDirectorSchedule, scheduleAuthorized, scheduleRange } from "@/lib/nbrain-schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", "Vary": "Authorization" };

export async function GET(request: NextRequest) {
  if (!scheduleAuthorized(request.headers.get("authorization"), process.env.NK_BRAIN_SCHEDULE_TOKEN)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  const range = scheduleRange(request.nextUrl.searchParams.get("from"), request.nextUrl.searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "from/to must be real ISO dates covering at most 93 days" }, { status: 400, headers });
  try {
    const admin = createAdminClient();
    const includeHistory = request.nextUrl.searchParams.get("include_history") === "1";
    let query = admin.from("consultations")
      .select("id,name,parent_phone,subject,consult_date,consult_time,consult_type,location,parent_consult_date,parent_consult_time,parent_location,status,consult_done", { count: "exact" })
      .in("status", includeHistory ? ["active", "pending", "completed", "cancelled"] : ["active", "pending"])
      .or(`and(consult_date.gte.${range.from},consult_date.lte.${range.to}),and(parent_consult_date.gte.${range.from},parent_consult_date.lte.${range.to})`)
      .order("id")
      .limit(1000);
    if (!includeHistory) query = query.eq("consult_done", false);
    const { data, count, error } = await query;
    if (error) return NextResponse.json({ error: "Schedule unavailable" }, { status: 503, headers });
    if (count === null || count > 1000) return NextResponse.json({ error: "Schedule range too large; request a shorter range" }, { status: 422, headers });
    return NextResponse.json({ items: mapDirectorSchedule(data ?? [], range, includeHistory), fetched_at: new Date().toISOString(), source: "registration" }, { headers });
  } catch {
    return NextResponse.json({ error: "Schedule unavailable" }, { status: 503, headers });
  }
}
