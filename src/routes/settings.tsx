import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { redirectToLoginIfRequired } from "@/lib/app-data";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDashboard, sendNudge, updateSettings } from "@/lib/workouts.functions";
import { LOCAL_LOG_FILE } from "@/lib/workouts";

export const Route = createFileRoute("/settings")({
  loader: () => getDashboard(),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, stats } = Route.useLoaderData();
  const router = useRouter();
  const nudgeFn = useServerFn(sendNudge);
  const saveFn = useServerFn(updateSettings);
  const [days, setDays] = useState(String(settings.reminderDays));
  const [enabled, setEnabled] = useState(settings.reminderEnabled);
  const [nudging, setNudging] = useState(false);
  const [saving, setSaving] = useState(false);

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
      toast.success("Nudge sent to your connected Gmail.");
      await router.invalidate({ sync: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setNudging(false);
    }
  }

  async function onSave() {
    const reminderDays = Number(days);
    if (!Number.isFinite(reminderDays) || reminderDays < 1) {
      toast.error("Pick a gap between 1 and 14 days.");
      return;
    }
    setSaving(true);
    try {
      await saveFn({
        data: {
          reminderDays,
          reminderEnabled: enabled,
        },
      });
      toast.success("Reminder settings saved.");
      await router.invalidate({ sync: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Settings</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Source & reminders</h1>
          <p className="mt-2 text-muted">
            The board is public. The log is a file in the repo — add a row, push, and it shows up. No public sync
            button for bots to mash.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log file</CardTitle>
            <CardDescription>
              Source of truth is{" "}
              <span className="font-mono text-fg">{LOCAL_LOG_FILE}</span>. Columns: Date, Description, Work Time,
              Distance (m), Stroke Rate, Pace, Watts, Calories, Avg HR, Notes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {settings.lastSyncedAt
                ? `Last pulled ${new Date(settings.lastSyncedAt).toLocaleString("en-CA")}.`
                : "Waiting on the first pull."}{" "}
              Edit the CSV, push to GitHub, and the next load (or the midnight job) imports the new rows.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Off-the-water reminder</CardTitle>
            <CardDescription>
              Daily check at 6pm Eastern. If you have not rowed in a few days, a short email goes out from your Gmail.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm">Send reminders</span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={
                  enabled
                    ? "h-7 w-12 rounded-full bg-primary p-0.5 transition-colors"
                    : "h-7 w-12 rounded-full bg-surface p-0.5 transition-colors"
                }
              >
                <span
                  className={
                    enabled
                      ? "block size-6 translate-x-5 rounded-full bg-primary-fg transition-transform"
                      : "block size-6 translate-x-0 rounded-full bg-fg/70 transition-transform"
                  }
                />
              </button>
            </label>
            <label className="flex flex-col gap-1.5">
              <Label>Quiet for this many days, then nudge</Label>
              <Input
                inputMode="numeric"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="max-w-32"
              />
            </label>
            <p className="text-sm text-muted">
              {stats.daysSince == null
                ? "No sessions on the board yet."
                : `Last session was ${stats.daysSince} day${stats.daysSince === 1 ? "" : "s"} ago.`}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onSave} variant="secondary" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
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
