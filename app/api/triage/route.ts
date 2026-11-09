import { inputSchema, triage } from "../../../lib/engine";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length")) > 32000) return Response.json({ error: "Message too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 16000) return Response.json({ error: "Message too large." }, { status: 413 });
    const parsed = inputSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: parsed.error.issues.map(i => i.message).join(" ") }, { status: 400 });
    return Response.json(triage(parsed.data), { headers: { "Cache-Control": "no-store" } });
  } catch { return Response.json({ error: "Unable to read the request. Check the message and try again." }, { status: 400 }); }
}
