import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard, sendNudge } from "@/lib/workouts.functions";
import { LOCAL_SETTINGS_FILE } from "@/lib/settings-file";
import { LOCAL_LOG_FILE } from "@/lib/workouts";

export const Route = createFileRoute("/settings")({
  loader: () => getDashboard(),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, stats } = Route.useLoaderData();
  const router = useRouter();
  const nudgeFn = useServerFn(sendNudge);
  const [nudging, setNudging] = useState(false);

  async function onNudge() {
    setNudging(true);
    try {
      const result = await nudgeFn();
      if (result && "loginRequired" in result && result.loginRequired) {
        redirectToLoginIfRequired({
          ok: false,
          data: null,
          loginRequired: true,
          loginUrl: result.loginUrl,
        });
        return;
      }
      if (!result.ok) {
        toast.error(result.error ?? "Could not send");
        return;
      }
      toast.success("Nudge sent.");
      await router.invalidate({ sync: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setNudging(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Settings</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Source & reminders</h1>
          <p className="mt-2 text-muted">
            The board is public. Workouts and reminder prefs live in the repo — edit a file, push, and it shows up.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log file</CardTitle>
            <CardDescription>
              Source of truth is <span className="font-mono text-fg">{LOCAL_LOG_FILE}</span>. Columns: Date,
              Description, Work Time, Distance (m), Stroke Rate, Pace, Watts, Calories, Avg HR, Notes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted">
              {settings.lastSyncedAt
                ? `Last pulled ${new Date(settings.lastSyncedAt).toLocaleString("en-CA")}.`
                : "Waiting on the first pull."}{" "}
              Edit the CSV, push to GitHub, and the next deploy shows the new rows.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Off-the-water reminder</CardTitle>
            <CardDescription>
              Source of truth is <span className="font-mono text-fg">{LOCAL_SETTINGS_FILE}</span>. Same workflow as
              the log — edit, commit, push.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Send reminders</dt>
                <dd className="font-medium">{settings.reminderEnabled ? "On" : "Off"}</dd>
              </div>
              <div>
                <dt className="text-muted">Quiet for</dt>
                <dd className="font-medium">
                  {settings.reminderDays} day{settings.reminderDays === 1 ? "" : "s"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Send to</dt>
                <dd className="font-medium font-mono">
                  {settings.reminderTo || "not set — add reminderTo in the file"}
                </dd>
              </div>
            </dl>
            <p className="text-sm text-muted">
              {stats.daysSince == null
                ? "No sessions on the board yet."
                : `Last session was ${stats.daysSince} day${stats.daysSince === 1 ? "" : "s"} ago.`}
              {settings.reminderEnabled && stats.due ? " Due on the water." : ""}
            </p>
            <pre className="overflow-x-auto rounded-lg bg-surface px-4 py-3 text-xs text-fg">
{`{
  "reminderEnabled": ${settings.reminderEnabled},
  "reminderDays": ${settings.reminderDays},
  "reminderTo": "${settings.reminderTo}"
}`}
            </pre>
            <div>
              <Button onClick={onNudge} variant="outline" disabled={nudging}>
                {nudging ? "Sending…" : "Send a test nudge"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
