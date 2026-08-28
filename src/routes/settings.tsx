import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/lib/workouts.functions";
import { LOCAL_SETTINGS_FILE } from "@/lib/settings-file";
import { LOCAL_LOG_FILE } from "@/lib/workouts";

export const Route = createFileRoute("/settings")({
  loader: () => getDashboard(),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, stats } = Route.useLoaderData();

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
              the log — edit, commit, push. The send-to address is not shown here.
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
                <dd className="font-medium">{settings.reminderToSet ? "On file" : "Not set"}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted">
              {stats.daysSince == null
                ? "No sessions on the board yet."
                : `Last session was ${stats.daysSince} day${stats.daysSince === 1 ? "" : "s"} ago.`}
              {settings.reminderEnabled && stats.due ? " Due on the water." : ""}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
