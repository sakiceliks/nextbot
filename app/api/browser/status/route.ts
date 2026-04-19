import { NextResponse } from "next/server";

import { detectSahibindenAuthStatus } from "@/lib/browser-auth";

export async function GET() {
  try {
    const result = await detectSahibindenAuthStatus();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "unknown",
        browserRunning: false,
        message: error instanceof Error ? error.message : "Oturum durumu kontrol edilemedi.",
        logs: []
      },
      { status: 500 }
    );
  }
}
