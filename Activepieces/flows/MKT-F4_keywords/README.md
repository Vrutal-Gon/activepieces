# MKT-F4 · Keywords por dolor del ICP

`search_marketing` · TSK-000161 · diseño en [MARKETING_flujos_v0.1.md](../MARKETING_flujos_v0.1.md) (F4).

```
Recibe (día 1, 08:00) → Consulta perfil → Decide (Claude) → Ordena KeywordSet → Ejecuta hoja → Deja rastro
```

| Archivo | Qué es |
|---|---|
| `F4-keywords.template.json` | Plantilla para importar en Activepieces |
| `blocks/ordena-keywordset.step.ts` | Bloque «Ordena · a KeywordSet» (paso Code). Probado (2026-10-02): quita duplicados por idioma, neutraliza fórmulas, descarta filas sin idioma es/en y las que rompen la regla de marca (bots, IA como compra), y rechaza respuestas sin JSON |

## Puesta en marcha (una vez)

### 1. La hoja de trabajo de Marketing

En Google Drive, crea una hoja llamada **`Vrutal-labs · Marketing`** con estas 3 pestañas. Los nombres y las cabeceras van exactos, en la fila 1:

| Pestaña | Cabeceras (fila 1) |
|---|---|
| `Perfil` | `campo` · `valor` |
| `Keywords` | `fecha` · `keyword` · `icp_pain` · `intent` · `monthly_volume` · `difficulty` · `owner` · `estado` · `idioma` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

Las cabeceras de las 3 pestañas se escriben a mano en la fila 1. Si falta una, esa columna no se rellena.

En `Perfil`, una fila por dato. Solo datos estructurados de Vrutal; nada de texto libre de cliente. **El ICP es un supuesto de build-up** (aún sin entrevistas a clientes): se afina al crecer. Los criterios de empresa salen del Brief §4.2 y LAB 10 cap. 2; los temas, del founder (2026-10-02).

| campo | valor |
|---|---|
| tipo_empresa | Empresa B2B |
| tamaño_empresa | Menos de 50 empleados |
| facturación | Menos de 40 M€ anuales |
| sector | Todos: el problema es estructural, no sectorial |
| rol_comprador | CEO, propietario o fundador, no técnico y sin tiempo |
| idioma | es |
| idioma | en |
| dolor | Mal clima laboral y rotación de personas |
| dolor | Estrés y agotamiento del equipo por la carga de trabajo |
| dolor | Tareas repetitivas que consumen horas de personas caras de reemplazar |
| dolor | Burocracia y papeleo interno que frena a la empresa |
| dolor | Baja productividad: el equipo no llega a todo |
| miedo | Miedo a que la IA sustituya a las personas del equipo |
| miedo | Riesgos de la IA: seguridad, privacidad de datos y errores |
| miedo | Miedo a gastar en tecnología que luego no funciona |
| no_encaja | Quien quiere implementar IA como proyecto de innovación sin un problema operativo detrás |

Puedes repetir `dolor`, `miedo` e `idioma`: cada `dolor` y `miedo` genera keywords en cada idioma. Regla de marca (LAB 10 cap. 2, LAB 11): la IA solo entra como miedo o riesgo, con `intent` informational; nunca keywords de compra o adopción de IA ni de «chatbot». El prompt la pide y el paso de código la hace cumplir.

### 2. Conexiones en Activepieces (`http://127.0.0.1:18001`)

**Conexiones → Nueva conexión:**

1. **Google Sheets** → «Conectar» → inicia sesión con la cuenta de Google que tiene la hoja → acepta. Nombre: `Google · Vrutal-labs`.
2. **Claude** → pega la API key. ⚠ **Solo para pruebas.** La clave sale de la organización de Anthropic del Gmail personal del founder. Antes del primer cliente: organización de empresa con cuenta de servicio, y clave subida por el Admin del cliente desde Integraciones. Ver la deuda en LAB08 Anexo B § 10.
   - **Formato**: debe empezar por `sk-ant-api03-`. Una clave `sk-ant-usr-…` (ligada al usuario y con caducidad) **no sirve**: la pieza responde «Couldn't load models».
   - **Origen**: console.anthropic.com → workspace `Vrutal-lab` → API keys → nombre `vrutal-lab-activepieces`.
   - **Nombre de la conexión**: `Claude · Vrutal-labs`.
   - La clave queda cifrada en tu instancia (`AP_ENCRYPTION_KEY`). No se guarda en ningún otro sitio.
   - En la consola de Anthropic, ponle un límite de gasto mensual.

### 3. Importar el flujo

1. **Flujos → Importar** → elige `F4-keywords.template.json`.
2. Abre el flujo. Los pasos marcados en rojo esperan tu elección:

| Paso | Qué eliges |
|---|---|
| `step_1` Consulta · perfil | Conexión `Google · Vrutal-labs` → hoja `Vrutal-labs · Marketing` → pestaña `Perfil` |
| `step_2` Decide · Claude | Conexión `Claude · Vrutal-labs`. Modelo: `claude-sonnet-5-5`; si no aparece en la lista, el Sonnet más reciente. `maxTokens` = `8000` |
| `step_4` Ejecuta · escribir | Misma conexión y hoja → pestaña `Keywords`. **Rows Data Format = `JSON`** y, en el campo JSON, solo `{{step_3.rows}}` (la **lista**; no `rows_json`, que es texto y acaba entero en una celda) |
| `step_5` Deja rastro | Misma conexión y hoja → pestaña `Rastro`. Los campos aparecen por letra de columna: A `{{trigger.timestamp}}` · B `MKT-F4 keywords` · C `TSK-000161` · D `ok` · E `{{step_3.count}} keywords propuestas, {{step_3.discarded}} descartadas` |

**Al importar, Activepieces puede reiniciar los campos de `step_4` y `step_5`** (los vacía o pone el ejemplo `column1/value1`). Tras elegir hoja y pestaña, revisa que sigan como arriba.

3. **Probar flujo.** Debe haber una fila por keyword en `Keywords` (de 15 a 40 por idioma, `idioma` es o en, `estado = propuesta`) y una fila en `Rastro`.
4. **Publicar.** Desde entonces se ejecuta el día 1 de cada mes a las 08:00 (hora de Madrid).

## Si la ejecución acaba en `INTERNAL_ERROR`

Mira el log del contenedor: `ENOTFOUND lab-flows.localhost` significa que el motor intenta subir la ejecución por la dirección pública (`AP_FRONTEND_URL`), que dentro del contenedor no resuelve y que por LAB08 solo expone `/api/v1/webhooks`. Arreglo, sin abrir ninguna ruta en Traefik: `AP_INTERNAL_URL=http://activepieces:80` en el servicio `activepieces`. Desde 2026-10-02 ya viene en la plantilla `infra/instance/docker-compose.yml`, así que lo llevan todas las instancias. Si lo ves en una instancia antigua, recrea el servicio (desde `infra/instance`):

```
docker compose -p <slug> --env-file clients/<slug>.env up -d activepieces
```

## Deuda declarada (2026-10-02)

F4 v1 es un **brainstorm de Claude** sobre un perfil escrito a mano, sin datos reales de búsqueda. Sirve para estrenar el motor y el LLM, no como investigación de keywords. Tres deudas, decididas por el founder, cada una con su condición de pago:

| Deuda | Hoy | Debe ser | Se paga |
|---|---|---|---|
| **Perfil** | Pestaña `Perfil` de una hoja de Google, escrita por Vrutal | Tabla estructurada en la base de VrutalOS del cliente, editada por su Admin. Los dolores se eligen de una lista cerrada de Vrutal (las tareas del catálogo), no se escriben libres: un texto libre del cliente no puede alimentar un prompt estándar, solo el nivel «a medida» | Antes del primer cliente |
| **Prompt** | Dentro del paso `step_2` del flujo | Guardado en Vrutal 1st e inyectado en ejecución desde el servidor (D-02). Hoy `catalog.job_role_prompt` y `tenant_specialist_prompt` tienen 0 filas y son **por rol**, no por tarea: falta decidir dónde viven los prompts de tarea | Antes del primer cliente externo |
| **Datos de búsqueda** | Ninguno: las keywords salen de la imaginación del modelo | Keyword Planner (volumen y dificultad; necesita cuenta de Google Ads y token de desarrollador) y/o Search Console (consultas reales de la web; hoy es de la tarea S1, TSK-000163, y necesita una web verificada con tráfico) | Cuando haya cuenta de Ads o web con tráfico |

**No presentar F4 a un cliente como investigación de keywords** mientras la tercera deuda siga abierta.

## Qué no hace todavía (a propósito)

- **Volumen y dificultad**: quedan vacíos hasta tener cuenta de Google Ads (Keyword Planner). Ese día se añade un bloque Consulta entre Decide y Ordena.
- **Rastro en la hoja**: en la v1 va a la pestaña `Rastro`. Cuando exista el registro de ejecuciones de VrutalOS (`run_log` en el Supabase del cliente), el bloque «Deja rastro» se cambia por ese, sin tocar el resto.
- **Sin aprobación**: no la necesita. Es solo lectura y propone filas en una hoja interna; nada sale de casa.
