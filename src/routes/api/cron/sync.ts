import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runSheetSync } from "@/lib/sheet-sync";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let csv: string | undefined;
  const contentType = request.headers.get("content-type") ?? "";
  if (request.method === "POST" && contentType.includes("json")) {
    try {
      const body = (await request.json()) as { csv?: unknown };
      if (typeof body.csv === "string" && body.csv.trim()) csv = body.csv;
    } catch {
      return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
    }
  } else if (request.method === "POST") {
    const text = await request.text();
    if (text.trim()) csv = text;
  }

  try {
    const result = await runSheetSync({ csv, force: Boolean(csv) });
    return Response.json(result, { status: 200 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/cron/sync")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
