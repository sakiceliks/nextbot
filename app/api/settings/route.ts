import { NextResponse } from "next/server";
import { readSettings, writeSettings } from "@/lib/settings";

export async function GET() {
  try {
    const settings = readSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Okuma hatası" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const updated = writeSettings(body);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Yazma hatası" },
      { status: 500 },
    );
  }
}
