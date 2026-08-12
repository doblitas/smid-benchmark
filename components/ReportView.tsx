import type { ReportData } from "@/lib/types";

function money(n: number) {
  return `USD ${Math.round(n).toLocaleString("es-BO")}`;
}

function num(n: number) {
  return n.toLocaleString("es-BO");
}

export function ReportView({ report }: { report: ReportData }) {
  const client = report.input.clientBrand;
  const competitor = report.input.competitors[0] || "Competidor";

  return (
    <div className="space-y-8">
      <div className="border-l-4 border-amber-700 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Impresiones e inversión son <strong>estimaciones</strong>. Las creatividades y
        campañas reflejan la actividad observada en el periodo.
        {report.mode === "demo" ? " Este reporte es una muestra ilustrativa." : ""}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label={`Inversión est. ${client}`}
          value={
            report.summary.clientSpendTotal > 0
              ? money(report.summary.clientSpendTotal)
              : "Sin datos"
          }
        />
        <Kpi
          label={`Inversión est. ${competitor}`}
          value={
            report.summary.competitorSpendTotal > 0
              ? money(report.summary.competitorSpendTotal)
              : "Sin datos"
          }
        />
        <Kpi
          label="SOV est. medios externos"
          value={
            report.externalSov.length > 0
              ? `${report.summary.clientShareExternal}% / ${report.summary.competitorShareExternal}%`
              : "Sin datos"
          }
          hint={`${client} / ${competitor}`}
        />
        <Kpi
          label="SOV est. paid owned"
          value={
            report.paidSov.some((r) => r.activeAds > 0)
              ? `${report.summary.clientSharePaid}% / ${report.summary.competitorSharePaid}%`
              : "Sin datos"
          }
          hint={`${client} / ${competitor}`}
        />
      </div>

      <Section title="1. Temáticas de comunicación">
        <Table
          headers={["Marca", "Campaña", "Tema", "Producto", "Oferta", "Plataformas"]}
          rows={report.themes.map((t) => [
            t.brand,
            t.campaign,
            t.theme,
            t.product,
            t.offer,
            t.platforms,
          ])}
        />
      </Section>

      <Section title="2. SOV impresiones · medios externos digitales">
        <Table
          headers={["Marca", "Medio", "Formato", "Apariciones", "Imp. estimadas", "Confianza"]}
          rows={report.externalSov.map((r) => [
            r.brand,
            r.medium,
            r.format,
            String(r.appearances),
            num(r.estimatedImpressions),
            r.confidence,
          ])}
        />
      </Section>

      <Section title="3. SOV impresiones · medios propios de pago">
        <Table
          headers={["Marca", "Plataforma", "Anuncios act.", "Continuidad", "Imp. estimadas"]}
          rows={report.paidSov.map((r) => [
            r.brand,
            r.platform,
            String(r.activeAds),
            `${r.continuity}%`,
            num(r.estimatedImpressions),
          ])}
        />
      </Section>

      <Section title="4. Inversión estimada · Meta Ads y Google Ads">
        <Table
          headers={["Marca", "Plataforma", "Estimado", "Rango", "Confianza"]}
          rows={report.spend.map((r) => [
            r.brand,
            r.platform,
            money(r.estimatedSpendUsd),
            `${money(r.rangeLow)} – ${money(r.rangeHigh)}`,
            r.confidence,
          ])}
        />
      </Section>

      <Section title="Hallazgos">
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          {report.findings.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Section>

      <Section title="Metodología">
        <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--muted)]">
          {report.methodologyNotes.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[var(--paper)] p-4">
      <div className="text-xs text-[var(--muted)]">{label}</div>
      <div className="mt-2 font-serif text-2xl text-[var(--ink)]">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-2xl text-[var(--ink)]">{title}</h2>
      <div className="border border-[var(--line)] bg-[var(--paper)] p-4">{children}</div>
    </section>
  );
}

function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-[var(--line)] px-2 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={`${row[0]}-${idx}`}>
              {row.map((cell, cellIdx) => (
                <td key={`${idx}-${cellIdx}`} className="border-b border-[var(--line)] px-2 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
