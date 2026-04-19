import { NextResponse } from "next/server";
import { z } from "zod";

import { openChromeSession } from "@/lib/browser-session";

const browserSessionSchema = z.object({
  mode: z.enum(["home", "login", "post-ad"])
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const payload = browserSessionSchema.parse(json);
    const session = await openChromeSession(payload.mode);

    return NextResponse.json({
      ok: true,
      ...session
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Tarayici acilamadi."
      },
      { status: 500 }
    );
  }
}
