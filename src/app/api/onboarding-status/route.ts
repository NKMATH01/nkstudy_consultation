import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  try {
    const { registrationId, status } = await req.json();

    if (!registrationId) {
      return NextResponse.json({ error: "Missing registrationId" }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("registrations")
      .update({ onboarding_status: status })
      .eq("id", registrationId);

    if (error) {
      // If column doesn't exist, try to handle gracefully
      console.error("[Onboarding] Status update failed:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
