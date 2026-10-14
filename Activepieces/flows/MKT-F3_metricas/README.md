# MKT-F3 · Foto semanal de métricas

`marketing_analyst` · TSK-001293 · diseño en [MARKETING_flujos_v0.1.md](../MARKETING_flujos_v0.1.md) (F3).

```
Recibe (lunes 08:00) → Calcula semana → Consulta clave de HubSpot (Vault) → Consulta HubSpot → Ordena MetricsSnapshot → Ejecuta hoja → Deja rastro
```

| Archivo | Qué es |
|---|---|
| `F3-metricas.template.json` | Plantilla para importar en Activepieces |
| `blocks/calcula-ventana-semanal.step.ts` | Paso Code: da la semana anterior completa, de lunes 00:00 a lunes 00:00 hora de Madrid. HubSpot no entiende fechas relativas, por eso va antes de la consulta. Probado con verano, invierno y la semana del cambio de hora |
| `blocks/ordena-metricsnapshot.step.ts` | Paso Code: contactos de HubSpot → una fila `MetricsSnapshot` por canal (también con 0). Probado: falla, sin escribir nada, si la respuesta no tiene el formato esperado o si hay más contactos de los que caben en una consulta |

## Qué mide la v1

**Una sola métrica: `new_contacts`**, contactos nuevos de HubSpot en la semana, por canal. El canal sale de la propiedad `hs_analytics_source` (fuente original), que existe en el portal «Vrutal Labs»:

| `hs_analytics_source` | `channel` |
|---|---|
| ORGANIC_SEARCH | `seo` |
| PAID_SEARCH | `sem` |
| EMAIL_MARKETING | `email` |
| SOCIAL_MEDIA, PAID_SOCIAL | `linkedin` si el detalle dice LinkedIn; si no, `social` |
| DIRECT_TRAFFIC | `web` |
| cualquier otra o vacía | `other` |

Solo se piden a HubSpot dos propiedades (`hs_analytics_source` y su detalle): ni nombres ni emails.

**Qué queda fuera, a propósito:** LinkedIn (necesita la API de Community Management, no solicitada), GA4 y Google Ads (sin pieza nativa), Search Console (sin web verificada). Leads y MQL por canal: cuando se compruebe que las propiedades de ciclo de vida existen.

**Nota de diseño (sin construir):** si se adopta Postiz para publicar (ver `MKT-F2_linkedin/README.md`), su endpoint `GET /public/v1/analytics` da métricas de los posts publicados en todos los canales conectados (LinkedIn incluido) con una sola integración — cerraría la parte de LinkedIn de la deuda de abajo sin pedir la API de Community Management por separado. GA4/Ads/Search Console seguirían fuera (Postiz no los cubre). Pendiente confirmar en el spike qué campos exactos devuelve ese endpoint antes de diseñar el paso `Consulta · Postiz`.

**Etiquetado interno (`tags_ia`, decidido 2026-10-07):** cuando F3 incorpore el detalle por publicación de Postiz, debería cruzarlo por `brief_id`+`channel` con el `tags_ia` que F14 ya puso en `Borradores`/`Publicaciones` (`#tema:…`, `#formato:…`) y agregar el rendimiento por etiqueta — ese agregado alimenta el propio `Decide` de F12/F14 (qué tema o formato repetir), **no una pantalla para el cliente**: `tags_ia` y cualquier vista agrupada por etiqueta quedan fuera de lo que lee `authenticated` (mismo criterio que el catálogo, ver nota en `MKT-F14_adaptacion/README.md`).

**UTM (decidido 2026-10-09, ver `MKT-F14_adaptacion/README.md`):** a diferencia de `tags_ia`, los UTM **sí** son la pieza que falta para cerrar media deuda de arriba — GA4 y Google Ads devuelven el tráfico agrupado por `utm_campaign`/`utm_source`/`utm_content` en sus propios informes. El día que F3 incorpore esa pieza nativa (sigue sin pieza hoy, deuda sin cambios), podrá agrupar por esos mismos campos y enlazar tráfico real con la pieza que lo generó — por eso `ContentDraft` guarda los 5 valores por separado, no solo la URL final concatenada.

## Puesta en marcha (una vez)

### 1. La pestaña `Métricas`

En la hoja `Vrutal-labs · Marketing`, crea una pestaña **`Métricas`** y pega esto en la celda A1 (tabuladores):

```
period_start	period_end	channel	metric	value	source
```

### 2. Clave de HubSpot — resuelto 2026-10-10, deuda pagada

La deuda de arriba ("Antes del primer cliente: pieza propia de solo lectura") se paga ya, no se aplaza: HubSpot además discontinuó las apps públicas tradicionales (exige su CLI y un proyecto nuevo), así que seguir con la pieza nativa OAuth2 habría sido más trabajo para construir justo lo que había que sustituir.

**Patrón nuevo**: el token de HubSpot se guarda como cualquier otra integración del cliente — Vault del Supabase de Vrutal-lab, vía `integration-save-key`, visible y gestionable desde VrutalOS → Integraciones (ya tenía una entrada `hubspot` desde el principio del proyecto). Activepieces ya no tiene una "Connection" de HubSpot: `step_2` del flujo lee la clave con una llamada HTTP a la Edge Function `integration-get-key` (nueva, `VrutalOS/supabase/functions/`), y `step_3` llama a HubSpot directamente con esa clave — las dos como pieza HTTP genérica, no la pieza nativa de HubSpot.

**Confirmado en vivo 2026-10-10** — HubSpot ya no deja crear "Apps privadas" (deprecadas, empujan al CLI/Developer Projects, que es mucho más de lo que hace falta aquí). La vía real, sin CLI:

1. En HubSpot: **Configuración → Integraciones → Service Keys → Crear**. Scope mínimo: `crm.objects.contacts.read` (principio de mínimo privilegio — ni lectura de más, ni escritura). Copia el token.
2. En VrutalOS (de Vrutal-lab) → Integraciones → HubSpot → pega ese token → "Probar y guardar". Se prueba contra `GET /crm/v3/objects/contacts?limit=1` antes de guardarlo (mismo mecanismo que ya existía) — el texto de ayuda de ese campo ya dice "Service Key", no "Aplicación privada" (`app/src/lib/providers.ts`, corregido 2026-10-10).
3. **Antes de poder guardar nada**, `integration-save-key` necesita el secret `APP_ORIGINS` puesto (Supabase → Edge Functions → `integration-save-key` → Secrets) con el origen **exacto** desde donde abres VrutalOS — en local, `http://localhost:5173`. **Dos fallos reales ya vistos, para no repetirlos:**
   - El secret va en **dos campos separados** (Nombre: `APP_ORIGINS`, Valor: `http://localhost:5173`) — si el valor incluye `APP_ORIGINS=` por delante, no coincide con ningún origen real y el navegador lo ve como "CORS error" en vez de un mensaje claro de error.
   - Sin barra final, sin espacios, sin comillas — una sola variación rompe la comparación exacta.
4. Genera un secreto nuevo (`openssl rand -hex 24`) y ponlo en dos sitios, **el mismo valor en los dos**:
   - Secret `AP_INTEGRATION_TOKEN` de la Edge Function `integration-get-key` (Supabase → Edge Functions → Secrets).
   - Cabecera `X-AP-Token` de `step_2` del flujo, en el campo de la plantilla que hoy dice `PENDIENTE_GENERAR_SECRETO_AP_INTEGRATION_TOKEN`.

**Pendiente, al trasladar a producción (VPS)**: `APP_ORIGINS` (y cualquier otro secret puesto con el valor de `localhost` durante esta fase local) hay que actualizarlo al dominio real del cliente (`https://<slug>.vrutal-labs.com`, sin puerto) en cada Edge Function que lo use — `integration-save-key`, `integration-social-connect`, `support-ticket-send`, `support-ticket-list`. Ninguno de estos secrets viaja solo: hay que repasarlos todos juntos, no uno a uno de memoria, para no dejar ninguno apuntando a `localhost` en producción.

Ya no hace falta CLI de HubSpot, app pública, ni redirect URI — todo el riesgo de "sin verificar" de la versión anterior de este README queda cerrado con este cambio.

### 3. Importar el flujo

1. **Flujos → Importar** → `F3-metricas.template.json`.
2. Asigna los pasos en rojo, y **revisa después de elegir cada hoja que los campos sigan como abajo** (Activepieces puede reiniciarlos al importar):

| Paso | Qué eliges o compruebas |
|---|---|
| `step_2` Consulta · clave de HubSpot (Vault) | Pieza HTTP genérica, sin conexión que elegir. Cabecera `X-AP-Token`: pega el secreto real (ver punto 2 de arriba) en vez del marcador |
| `step_3` Consulta · HubSpot | Pieza HTTP genérica, sin conexión que elegir — la cabecera `Authorization` ya trae `Bearer {{step_2.body.key}}`. Solo revisa que la URL sigue siendo `https://api.hubapi.com/crm/v3/objects/contacts/search` |
| `step_5` Ejecuta · escribir | Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Métricas`. **Rows Data Format = `JSON`** y en el campo, solo `{{step_4.rows}}` (la lista, no texto) |
| `step_6` Deja rastro | Misma conexión y hoja → pestaña `Rastro`. Por letra: A `{{trigger.timestamp}}` · B `MKT-F3 métricas` · C `TSK-001293` · D `ok` · E `{{step_4.total}} contactos nuevos del {{step_1.period_start}} al {{step_1.period_end}}` |

3. **Probar flujo.** Deben aparecer 7 filas en `Métricas` (una por canal, `metric = new_contacts`, `source = hubspot`) y una en `Rastro`. Si la semana pasada no entró ningún contacto, las 7 filas valen 0: es correcto.
4. **No publiques** hasta estar live: se ejecutaría cada lunes a las 08:00 (hora de Madrid).

## Catálogo (Vrutal 1st)

| Qué | Cuál |
|---|---|
| Tarea | TSK-001293, patrón `API` |
| Contratos nuevos | `ReportWindow@1`, `MetricsSnapshot@1` |
| Bloques nuevos | `Calcula · ventana semanal` (normalize), `Consulta · clave de HubSpot (Vault)` (context, 2026-10-10), `Consulta · contactos nuevos (HubSpot)` (context), `Ordena · a MetricsSnapshot (HubSpot)` (normalize) |
| Bloques reutilizados | `Programación` (otra hora), `Escribir en la hoja`, `Deja rastro` |

## Deuda declarada (2026-10-02)

| Deuda | Hoy | Debe ser | Se paga |
|---|---|---|---|
| ~~**HubSpot con escritura**~~ | ~~Conexión OAuth2 de la pieza nativa, con permisos de lectura y escritura~~ | ~~Conexión de solo lectura (pieza propia)~~ | **Pagada 2026-10-10**: token de App privada, scope `crm.objects.contacts.read`, guardado en el Vault vía VrutalOS → Integraciones |
| **Métrica única** | Solo `new_contacts` | Leads y MQL por canal, más LinkedIn (vía Postiz si se adopta), Search Console y GA4 | Cuando existan las fuentes |
| **Salida en hoja** | Pestaña `Métricas` | Tabla en la base de VrutalOS del cliente | Antes del primer cliente |
