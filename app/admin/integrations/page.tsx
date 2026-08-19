import type { Metadata } from "next";
import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getIntegrationHealth,
  type HealthCheckItem,
  type HealthStatus,
} from "@/lib/integration-health";

export const metadata: Metadata = {
  title: "Integrations",
};

export const dynamic = "force-dynamic";

function statusIcon(status: HealthStatus) {
  switch (status) {
    case "ok":
      return <CheckCircle2 className="size-4 text-emerald-700 dark:text-emerald-400" />;
    case "warn":
      return <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />;
    case "error":
    case "missing":
      return <XCircle className="size-4 text-red-600 dark:text-red-400" />;
  }
}

function statusLabel(status: HealthStatus): string {
  switch (status) {
    case "ok":
      return "OK";
    case "warn":
      return "Warning";
    case "missing":
      return "Missing";
    case "error":
      return "Error";
  }
}

function HealthTable({ title, items }: { title: string; items: HealthCheckItem[] }) {
  return (
    <Card className="rounded-none shadow-none">
      <CardHeader className="px-4 pt-4 sm:px-6 sm:pt-6">
        <CardTitle className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground font-normal">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-2 sm:pb-4">
        <ul className="divide-y divide-foreground/8">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 px-4 py-3 sm:px-6"
            >
              <span className="mt-0.5 shrink-0">{statusIcon(item.status)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] tracking-[0.14em] uppercase text-muted-foreground">
                    {statusLabel(item.status)}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                {item.valuePreview ? (
                  <p className="mt-1 font-mono text-[11px] text-foreground/70 break-all">
                    {item.valuePreview}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default async function AdminIntegrationsPage() {
  const health = await getIntegrationHealth();

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Env var presence and live Heartland connectivity — secrets are never shown in full.
            Run the Secure Submit script from{" "}
            <a href="/admin/certification" className="underline underline-offset-2">
              Certification
            </a>
            , not public checkout.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm border border-foreground/10 px-3 py-2">
          <Activity className="size-4 shrink-0" strokeWidth={1.5} />
          <span className="text-muted-foreground">Overall</span>
          <span className="font-medium">{statusLabel(health.overall)}</span>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        Checked {new Date(health.checkedAt).toLocaleString()} · Refresh this page after a Vercel
        redeploy to re-check.
      </p>

      {health.tips.length > 0 ? (
        <section className="border border-foreground/10 bg-muted/30 px-4 py-4 sm:px-5 space-y-2">
          <p className="text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
            Next steps
          </p>
          <ul className="space-y-1.5 text-sm">
            {health.tips.map((tip) => (
              <li key={tip} className="flex gap-2">
                <span className="text-muted-foreground shrink-0">·</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <HealthTable title="Environment variables" items={health.env} />
        <HealthTable title="Live checks" items={health.live} />
      </div>
    </div>
  );
}
