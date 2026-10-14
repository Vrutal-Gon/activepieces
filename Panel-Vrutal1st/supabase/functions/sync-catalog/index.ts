// Edge Function: pg_cron (`sync-catalog-to-clients`, cada 15 min) empuja el catálogo de
// Vrutal1st a la base de cada cliente — D-06/D-19. Antes solo llevaba flows/reports/kpis;
// luego también `stack` (migración 028): qué sistemas del Stack del cliente tienen un
// `provider_key` real en VrutalOS (`catalog.system_option.provider_key`), para que
// IntegrationsPage.tsx deje de enseñar siempre la lista fija y muestre solo lo habilitado.
//
// Migración 030: además de empujar, ahora también LEE `public.integrations` de la misma
// conexión al cliente y lo reporta de vuelta aquí (`report_tenant_integration_status`) — así
// la ficha del cliente en Vrutal1st (Stack) enseña qué está configurado y validado de
// verdad, no solo qué está permitido. Se eligió este camino (reusar el sync que ya corre
// solo) en vez de un Database Webhook nuevo: el que ya existía para redes sociales
// (integration-social-notify, 022) nunca se llegó a configurar en el dashboard de ningún
// cliente — un paso manual que demostró olvidarse. Sin webhook, sin secreto nuevo.
//
// No existía como archivo en el repo hasta ahora (desplegada a mano, versión 6 en vivo) —
// este archivo nació de la versión 6 real (leída de la función desplegada). Server-to-
// server: se autentica con `x-sync-token` contra Vault, nunca con la anon key (D-19). Una
// base por tenant, conexión directa por `connection_string` (`list_sync_targets`), no vía
// Edge Function del cliente.
import { createClient } from "npm:@supabase/supabase-js@2";
import postgres from "npm:postgres@3.4.4";

interface SyncTarget {
  tenant_id: string;
  tenant_name: string;
  connection_string: string;
}

interface FlowRow {
  job_role_key: string;
  task_code: string;
  task_version: number;
  statement: string;
  autonomy_level: string;
  status: string;
}

interface ReportRow {
  job_role_key: string;
  report_key: string;
  name: string;
  description: string | null;
  status: string;
}

interface KpiRow {
  job_role_key: string;
  report_key: string;
  kpi_key: string;
  name: string;
  explanation: string;
  status: string;
}

interface StackRow {
  provider_key: string;
  system_category: string;
  system_name: string;
}

/** Un especialista contratado en Vrutal1st, tal y como debe existir en la base del cliente.
 *
 * Añadido el 2026-10-13 (migración 031): antes el sync solo BUSCABA los especialistas por
 * `job_role_key` para colgarles sus flujos, y los que no existían hacían que sus flujos se
 * descartaran en silencio. `sdr` y `data_entry_clerk` estaban puestos a mano de cuando se
 * aprovisionó, así que no se notó hasta que Marketing llevaba cuatro días contratado y sin
 * aparecer en la ficha del cliente.
 *
 * `autonomy_level` y `phase` NO vienen aquí a propósito: la autonomía en Vrutal1st es por
 * flujo (`tenant_specialist_flow`), y la fase es el ciclo de vida del especialista en casa
 * del cliente. El sync no los pisa. */
interface SpecialistRow {
  job_role_key: string;
  job_role_version: number;
  display_name: string;
  risk_level: string;
  status: string;
}

interface Payload {
  specialists: SpecialistRow[];
  flows: FlowRow[];
  reports: ReportRow[];
  kpis: KpiRow[];
  stack: StackRow[];
}

interface IntegrationStatusRow {
  provider_key: string;
  status: string;
  validated_at: string | null;
  last_error: string | null;
}

interface PushResult {
  specialists_upserted: number;
  flows_upserted: number;
  flows_disabled: number;
  reports_upserted: number;
  reports_disabled: number;
  kpis_upserted: number;
  kpis_disabled: number;
  stack_upserted: number;
  stack_removed: number;
  skipped: number;
  integrations_read: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // La anon key es pública: verify_jwt no autentica al llamante. Se exige el token de Vault.
  const token = req.headers.get("x-sync-token");
  if (!token) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: leased, error: leaseErr } = await supabase.rpc("sync_acquire_lease", {
    p_token: token,
    p_ttl_seconds: 300,
  });
  if (leaseErr) {
    const unauthorized = leaseErr.code === "42501" || /unauthorized/i.test(leaseErr.message);
    return unauthorized ? json({ error: "unauthorized" }, 401) : json({ error: "lease_failed" }, 500);
  }
  if (!leased) return json({ status: "skipped", reason: "sync_in_progress" }, 409);

  try {
    const { data: targets, error: targetsErr } = await supabase.rpc("list_sync_targets");
    if (targetsErr) return json({ error: targetsErr.message }, 500);

    // Un tenant por invocación, todos en paralelo: cada uno tiene su propia
    // conexión a su base y su propio catch, así que uno roto o lento no
    // retrasa ni tira la corrida de los demás.
    const results = await Promise.all(
      ((targets as SyncTarget[]) ?? []).map(async (target) => {
        const logRow: Record<string, unknown> = {
          tenant_id: target.tenant_id,
          tenant_name: target.tenant_name,
        };
        let result: Record<string, unknown>;
        try {
          const { data: payload, error: payloadErr } = await supabase
            .rpc("get_tenant_sync_payload", { p_tenant_id: target.tenant_id });
          if (payloadErr) throw new Error(`payload: ${payloadErr.message}`);

          const { counts, integrations } = await pushToTenant(target.connection_string, payload as Payload);

          if (integrations.length > 0) {
            const { error: reportErr } = await supabase.rpc("report_tenant_integration_status", {
              p_tenant_id: target.tenant_id,
              p_items: integrations,
            });
            if (reportErr) console.error(`report_tenant_integration_status (${target.tenant_name}):`, reportErr.message);
          }

          Object.assign(logRow, { status: "ok", ...counts });
          result = { tenant: target.tenant_name, status: "ok", ...counts };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          Object.assign(logRow, { status: "error", error_message: message });
          result = { tenant: target.tenant_name, status: "error", message };
        }

        const { error: logErr } = await supabase.from("sync_run_log").insert(logRow);
        if (logErr) {
          result = { tenant: target.tenant_name, status: "log_error", message: logErr.message };
        }
        return result;
      }),
    );

    return json({ synced_at: new Date().toISOString(), results });
  } finally {
    await supabase.rpc("sync_release_lease");
  }
});

async function pushToTenant(
  connectionString: string,
  payload: Payload,
): Promise<{ counts: PushResult; integrations: IntegrationStatusRow[] }> {
  const sql = postgres(connectionString, { max: 1, idle_timeout: 5, connect_timeout: 10 });
  const result: PushResult = {
    specialists_upserted: 0,
    flows_upserted: 0,
    flows_disabled: 0,
    reports_upserted: 0,
    reports_disabled: 0,
    kpis_upserted: 0,
    kpis_disabled: 0,
    stack_upserted: 0,
    stack_removed: 0,
    skipped: 0,
    integrations_read: 0,
  };
  let integrations: IntegrationStatusRow[] = [];

  try {
    // --- especialistas: PRIMERO, porque todo lo demás se cuelga de su id ---
    // Antes de la 031 esto no existía y un especialista contratado que no estuviera en la base
    // del cliente hacía que sus flujos/informes/KPIs se descartaran sin decir nada.
    const specialists = payload.specialists ?? [];
    if (specialists.length > 0) {
      // Un solo parámetro en vez de cinco arrays paralelos: así no hay forma de que queden
      // con longitudes distintas. Dos intentos fallidos el 2026-10-13, los dos por cómo el
      // driver decide el tipo del parámetro:
      //   1. `sql.array(...)` (como el resto del archivo) → «malformed array literal»: la
      //      lista llegaba como un texto con comas.
      //   2. `${JSON.stringify(...)}::jsonb` → «cannot call jsonb_to_recordset on a
      //      non-array»: con el cast a jsonb, Postgres describe el parámetro COMO jsonb, y
      //      entonces el driver codifica la cadena otra vez — queda un jsonb que contiene un
      //      texto, no un array.
      // `cast(... as text)` fija el tipo del parámetro a text sin ambigüedad: el driver manda
      // la cadena tal cual y el SQL la convierte a jsonb una sola vez.
      await sql`
        insert into specialists (job_role_key, job_role_version, display_name, risk_level, status)
        select s.job_role_key, s.job_role_version, s.display_name, s.risk_level, s.status
        from jsonb_to_recordset(cast(${JSON.stringify(specialists)} as text)::jsonb)
          as s(job_role_key text, job_role_version int, display_name text, risk_level text, status text)
        on conflict (job_role_key) do update set
          job_role_version = excluded.job_role_version,
          display_name = excluded.display_name,
          risk_level = excluded.risk_level,
          status = excluded.status,
          updated_at = now()
      `;
      result.specialists_upserted = specialists.length;
    }

    const jobRoleKeys = [
      ...new Set([
        ...payload.flows.map((f) => f.job_role_key),
        ...payload.reports.map((r) => r.job_role_key),
        ...payload.kpis.map((k) => k.job_role_key),
      ]),
    ];

    if (jobRoleKeys.length > 0) {
      const specialistRows = await sql`
        select id, job_role_key from specialists where job_role_key in ${sql(jobRoleKeys)}
      `;
      const specialistIdByRole = new Map(
        specialistRows.map((r) => [r.job_role_key as string, r.id as string]),
      );

      // --- flows (1 upsert en bloque + 1 disable en bloque, en vez de N awaits secuenciales) ---
      const validFlows = payload.flows
        .map((f) => ({ ...f, specialist_id: specialistIdByRole.get(f.job_role_key) }))
        .filter((f): f is FlowRow & { specialist_id: string } => Boolean(f.specialist_id));
      result.skipped += payload.flows.length - validFlows.length;

      if (validFlows.length > 0) {
        await sql`
          insert into catalog_flow_ro (task_key, specialist_id, name, description, autonomy_level, status, task_version, synced_at)
          select t.task_key, t.specialist_id, t.name, null::text, t.autonomy_level, t.status, t.task_version, now()
          from unnest(
            ${sql.array(validFlows.map((f) => f.task_code))}::text[],
            ${sql.array(validFlows.map((f) => f.specialist_id))}::uuid[],
            ${sql.array(validFlows.map((f) => f.statement))}::text[],
            ${sql.array(validFlows.map((f) => f.autonomy_level))}::text[],
            ${sql.array(validFlows.map((f) => f.status))}::text[],
            ${sql.array(validFlows.map((f) => f.task_version))}::int[]
          ) as t(task_key, specialist_id, name, autonomy_level, status, task_version)
          on conflict (specialist_id, task_key) do update set
            name = excluded.name,
            autonomy_level = excluded.autonomy_level,
            status = excluded.status,
            task_version = excluded.task_version,
            synced_at = now()
        `;
        result.flows_upserted = validFlows.length;

        const flowSpecialistIds = [...new Set(validFlows.map((f) => f.specialist_id))];
        const disabledFlows = await sql`
          update catalog_flow_ro cfr
          set status = 'disabled', synced_at = now()
          where cfr.status <> 'disabled'
            and cfr.specialist_id = any(${sql.array(flowSpecialistIds)}::uuid[])
            and not exists (
              select 1 from unnest(
                ${sql.array(validFlows.map((f) => f.specialist_id))}::uuid[],
                ${sql.array(validFlows.map((f) => f.task_code))}::text[]
              ) as seen(specialist_id, task_key)
              where seen.specialist_id = cfr.specialist_id and seen.task_key = cfr.task_key
            )
          returning task_key
        `;
        result.flows_disabled = disabledFlows.length;
      }

      // --- reports ---
      const validReports = payload.reports
        .map((r) => ({ ...r, specialist_id: specialistIdByRole.get(r.job_role_key) }))
        .filter((r): r is ReportRow & { specialist_id: string } => Boolean(r.specialist_id));
      result.skipped += payload.reports.length - validReports.length;

      if (validReports.length > 0) {
        await sql`
          insert into catalog_report_ro (report_key, specialist_id, name, description, status, synced_at)
          select t.report_key, t.specialist_id, t.name, t.description, t.status, now()
          from unnest(
            ${sql.array(validReports.map((r) => r.report_key))}::text[],
            ${sql.array(validReports.map((r) => r.specialist_id))}::uuid[],
            ${sql.array(validReports.map((r) => r.name))}::text[],
            ${sql.array(validReports.map((r) => r.description))}::text[],
            ${sql.array(validReports.map((r) => r.status))}::text[]
          ) as t(report_key, specialist_id, name, description, status)
          on conflict (report_key) do update set
            name = excluded.name,
            description = excluded.description,
            status = excluded.status,
            synced_at = now()
        `;
        result.reports_upserted = validReports.length;

        const reportSpecialistIds = [...new Set(validReports.map((r) => r.specialist_id))];
        const disabledReports = await sql`
          update catalog_report_ro crr
          set status = 'disabled', synced_at = now()
          where crr.status <> 'disabled'
            and crr.specialist_id = any(${sql.array(reportSpecialistIds)}::uuid[])
            and not exists (
              select 1 from unnest(
                ${sql.array(validReports.map((r) => r.specialist_id))}::uuid[],
                ${sql.array(validReports.map((r) => r.report_key))}::text[]
              ) as seen(specialist_id, report_key)
              where seen.specialist_id = crr.specialist_id and seen.report_key = crr.report_key
            )
          returning report_key
        `;
        result.reports_disabled = disabledReports.length;
      }

      // --- kpis ---
      const validKpis = payload.kpis
        .map((k) => ({ ...k, specialist_id: specialistIdByRole.get(k.job_role_key) }))
        .filter((k): k is KpiRow & { specialist_id: string } => Boolean(k.specialist_id));
      result.skipped += payload.kpis.length - validKpis.length;

      if (validKpis.length > 0) {
        await sql`
          insert into catalog_kpi_ro (report_key, kpi_key, specialist_id, name, explanation, status, synced_at)
          select t.report_key, t.kpi_key, t.specialist_id, t.name, t.explanation, t.status, now()
          from unnest(
            ${sql.array(validKpis.map((k) => k.report_key))}::text[],
            ${sql.array(validKpis.map((k) => k.kpi_key))}::text[],
            ${sql.array(validKpis.map((k) => k.specialist_id))}::uuid[],
            ${sql.array(validKpis.map((k) => k.name))}::text[],
            ${sql.array(validKpis.map((k) => k.explanation))}::text[],
            ${sql.array(validKpis.map((k) => k.status))}::text[]
          ) as t(report_key, kpi_key, specialist_id, name, explanation, status)
          on conflict (report_key, kpi_key) do update set
            name = excluded.name,
            explanation = excluded.explanation,
            status = excluded.status,
            synced_at = now()
        `;
        result.kpis_upserted = validKpis.length;

        const kpiSpecialistIds = [...new Set(validKpis.map((k) => k.specialist_id))];
        const disabledKpis = await sql`
          update catalog_kpi_ro ckr
          set status = 'disabled', synced_at = now()
          where ckr.status <> 'disabled'
            and ckr.specialist_id = any(${sql.array(kpiSpecialistIds)}::uuid[])
            and not exists (
              select 1 from unnest(
                ${sql.array(validKpis.map((k) => k.specialist_id))}::uuid[],
                ${sql.array(validKpis.map((k) => k.report_key))}::text[],
                ${sql.array(validKpis.map((k) => k.kpi_key))}::text[]
              ) as seen(specialist_id, report_key, kpi_key)
              where seen.specialist_id = ckr.specialist_id
                and seen.report_key = ckr.report_key
                and seen.kpi_key = ckr.kpi_key
            )
          returning kpi_key
        `;
        result.kpis_disabled = disabledKpis.length;
      }
    }

    // --- stack: qué proveedores de clave puede ofrecer VrutalOS a este cliente ---
    // Guard de existencia: clientes con una plantilla más vieja (sin la migración
    // `2026-10-11_integration_provider_sync.sql`) no deben tumbar el resto del sync.
    const [{ present }] = await sql<[{ present: boolean }]>`
      select to_regclass('public.integration_provider_ro') is not null as present
    `;
    if (present) {
      const stack = payload.stack ?? [];
      if (stack.length > 0) {
        await sql`
          insert into integration_provider_ro (provider_key, system_category, system_name, synced_at)
          select t.provider_key, t.system_category, t.system_name, now()
          from unnest(
            ${sql.array(stack.map((s) => s.provider_key))}::text[],
            ${sql.array(stack.map((s) => s.system_category))}::text[],
            ${sql.array(stack.map((s) => s.system_name))}::text[]
          ) as t(provider_key, system_category, system_name)
          on conflict (provider_key) do update set
            system_category = excluded.system_category,
            system_name = excluded.system_name,
            synced_at = now()
        `;
        const removed = await sql`
          delete from integration_provider_ro
          where provider_key <> all(${sql.array(stack.map((s) => s.provider_key))}::text[])
          returning provider_key
        `;
        result.stack_upserted = stack.length;
        result.stack_removed = removed.length;
      } else {
        const removed = await sql`delete from integration_provider_ro returning provider_key`;
        result.stack_removed = removed.length;
      }
    }

    // --- integraciones: qué tiene configurado el cliente de verdad, para reportar a
    // Vrutal1st (migración 030) — lectura, nunca escritura, de la misma conexión.
    const integrationRows = await sql<
      { provider: string; status: string; validated_at: string | null; last_error: string | null }[]
    >`select provider, status, validated_at, last_error from integrations`;
    integrations = integrationRows.map((r) => ({
      provider_key: r.provider,
      status: r.status,
      validated_at: r.validated_at,
      last_error: r.last_error,
    }));
    result.integrations_read = integrations.length;
  } finally {
    await sql.end({ timeout: 5 });
  }

  return { counts: result, integrations };
}
