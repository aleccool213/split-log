import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { WorkoutForm } from "@/components/workout-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/log")({
  component: LogPage,
});

function LogPage() {
  return (
    <AppShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">New session</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Log a row</h1>
          <p className="mt-2 text-muted">
            Same numbers the PM5 shows: meters, work time, rate. Split and watts fill in from there.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Concept 2</CardTitle>
            <CardDescription>Time as m:ss.s — 20:28.0 or 7:28.4</CardDescription>
          </CardHeader>
          <CardContent>
            <WorkoutForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
