import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runRemind } from "@/lib/push.functions";

async function handle(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await runRemind();
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "Remind failed" },
      { status: 500 },
    );
  }
}

export const Route = createFileRoute("/api/cron/remind")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});
