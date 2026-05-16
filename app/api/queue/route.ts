import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import QueueItem from "@/models/QueueItem";

export async function GET() {
  try {
    await connectDB();
    const items = await QueueItem.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ ok: true, items });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const { items } = await req.json();

    // Upsert items (kuyruğu senkronize et)
    // Bu basit versiyonda tüm kuyruğu gönderip eksikleri ekleyip güncelleyebiliriz.
    for (const item of items) {
      await QueueItem.findOneAndUpdate(
        { queueId: item.id },
        {
          draft: item.draft,
          preview: item.preview,
          status: item.status,
          errorMsg: item.errorMsg,
          addedAt: item.addedAt,
          duration: item.duration,
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await connectDB();
    const { id, clearAll } = await req.json();

    if (clearAll) {
      await QueueItem.deleteMany({});
    } else {
      await QueueItem.deleteOne({ queueId: id });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
