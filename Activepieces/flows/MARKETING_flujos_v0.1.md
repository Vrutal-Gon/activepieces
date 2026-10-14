# Marketing · primeros 4 flujos y sus bloques · v0.1

Diseño **antes** de construir. Fuente: [MARKETING_roles_propuesta_v0.1.md](../../docs/producto/MARKETING_roles_propuesta_v0.1.md) y las decisiones del founder (2026-10-01). Cliente 0: Vrutal-labs.

Diagramas en draw.io (gratis y open source): [MARKETING_flujos_v0.1.drawio](MARKETING_flujos_v0.1.drawio), una página por flujo. Ábrelo con la app de escritorio, la extensión de VS Code o app.diagrams.net.

Reglas:
- Cada flujo es una **línea recta** de bloques. Nunca hay ramas en la composición: si algo depende de una condición, la condición vive dentro de un bloque.
- Un bloque hace una sola cosa y entrega un **contrato**.
- Toda acción de cara al público pasa por **Pide permiso**. El aprobador es el founder, único por ahora.
- Los prompts no viven en la BBDD del cliente (D-02). Solo usan campos estructurados del cliente: ICP, voz y diccionario. Nunca texto libre del cliente.

---

## Los 4 flujos

### F1 · Redactar una pieza desde su brief
`content_promotion` · C3 TSK-000010 + C4 TSK-000057 (revisión de voz en el mismo recorrido)

Diagrama: página **F1** de [MARKETING_flujos_v0.1.drawio](MARKETING_flujos_v0.1.drawio).

- **Resultado**: un `ContentDraft` con `voice_check = ok | issues` y las incidencias concretas anotadas.
- **Sin ramas**: si la voz falla, el borrador sigue adelante marcado con sus incidencias. Lo ves al aprobar en F2.
- **Riesgo**: medio. Es reversible y no publica nada.

### F2 · Programar el post de LinkedIn
`content_promotion` · C6 VRL-MKT-C03 · **primera acción irreversible del sistema**

Diagrama: página **F2** de [MARKETING_flujos_v0.1.drawio](MARKETING_flujos_v0.1.drawio).

- La API de LinkedIn no programa publicaciones. El flujo espera hasta la fecha y entonces publica, dentro de **Ejecuta**.
- Si no apruebas, el flujo termina en **Pide permiso** y no publica nada.

### F3 · Foto semanal de métricas
`marketing_analyst` · A5 VRL-MKT-A02

Diagrama: página **F3** de [MARKETING_flujos_v0.1.drawio](MARKETING_flujos_v0.1.drawio).

- Solo lectura en las fuentes. Escribe en una hoja que lees tú.
- GA4 necesita web con analítica. Si todavía no existe, ese paso queda vacío y no rompe el flujo.

### F4 · Palabras clave por dolor del ICP
`search_marketing` · S2 TSK-000161

Diagrama: página **F4** de [MARKETING_flujos_v0.1.drawio](MARKETING_flujos_v0.1.drawio).

- Solo lectura. Alimenta los briefs de F1.
- Los volúmenes salen del Keyword Planner, que necesita cuenta de Google Ads. Hasta tenerla, el `KeywordSet` sale sin volumen.

---

## Bloques: 16 piezas para 4 flujos

| Bloque | Tipo | Qué hace | Herramienta probable | F1 | F2 | F3 | F4 |
|---|---|---|---|:-:|:-:|:-:|:-:|
| Programación | Recibe | Arranca a una hora fija | Schedule (nativo) | | | ● | ● |
| Fila marcada en la hoja | Recibe | Arranca cuando una fila cambia de estado | Google Sheets (trigger) | ● | ● | | |
| A ContentBrief | Ordena | Fila → contrato ContentBrief | Code step | ● | | | |
| A post LinkedIn | Ordena | ContentDraft → texto final + fecha | Code step | | ● | | |
| A MetricsSnapshot | Ordena | N fuentes → filas homogéneas | Code step | | | ● | |
| A KeywordSet | Ordena | Keywords + volúmenes → contrato | Code step | | | | ● |
| Memoria de marca | Consulta | Voz, diccionario y fuentes | Memoria del Cuore (Qdrant) | ● | | | |
| Perfil del cliente | Consulta | ICP, competidores, dolores del catálogo | Supabase del cliente | | | | ● |
| Calendario | Consulta | Fecha prevista de la pieza | Google Sheets | | ● | | |
| LinkedIn página | Consulta | Seguidores, impresiones, interacciones | LinkedIn | | | ● | |
| HubSpot | Consulta | Contactos nuevos y actividad | HubSpot (nativo) | | | ● | |
| GA4 | Consulta | Sesiones y conversiones | Google Analytics | | | ● | |
| Volúmenes de búsqueda | Consulta | Volumen e intención por keyword | Google Ads Keyword Planner | | | | ● |
| Redactar | Decide | ContentBrief → ContentDraft | LLM | ● | | | |
| Control de voz | Decide | Borrador → ok / incidencias | LLM | ● | | | |
| Keywords por dolor | Decide | ICP → lista de keywords | LLM | | | | ● |
| Aprobación del founder | Pide permiso | Aprobar o rechazar con un clic | Approval (nativo) + email | | ● | | |
| Escribir en la hoja | Ejecuta | Añadir o actualizar filas | Google Sheets (nativo) | | | ● | ● |
| Crear documento | Ejecuta | Borrador en un Google Doc | Google Docs (nativo) | ● | | | |
| Publicar en LinkedIn | Ejecuta | Esperar a la fecha y publicar | LinkedIn (nativo) + Delay | | ● | | |
| Deja rastro | Deja rastro | Qué hizo, cuándo, con qué y por qué | Supabase del cliente (`run_log`) | ● | ● | ● | ● |

**Se repiten**: «Deja rastro» en los 4 flujos; «Escribir en la hoja» y «Fila marcada» en 2 cada uno; el LLM en 3 bloques de decisión. Esos 4 se construyen primero.

## Contratos

| Contrato | Campos |
|---|---|
| **ContentBrief** | `brief_id`, `objective`, `audience`, `key_message`, `evidence` (cifra o caso + fuente), `cta`, `target_keyword`, `channel` |
| **ContentDraft** | `brief_id`, `channel`, `body`, `version`, `voice_check` (ok\|issues), `voice_issues[]`, `status` (draft\|approved\|scheduled\|published), `publish_at` |
| **MetricsSnapshot** | `period_start`, `period_end`, `channel`, `metric`, `value`, `source` |
| **KeywordSet** | `keyword`, `icp_pain`, `intent`, `monthly_volume`, `difficulty`, `owner` (seo\|sem) |
| **RunRecord** | `flow`, `task_code`, `started_at`, `outcome` (ok\|error\|rejected), `inputs_ref`, `outputs_ref`, `approval_by` |

## Conexiones que necesitará Vrutal-labs

Las meterás tú en Integraciones de VrutalOS (Anexo B, § 5). Hasta que exista esa pantalla, van directamente como conexiones de Activepieces en `lab`.

| Conexión | Para | Bloqueo |
|---|---|---|
| Google (Sheets, Docs, GA4) | F1, F2, F3, F4 | — |
| LinkedIn, página de empresa | F2, F3 | Necesita página de empresa con permisos de administrador |
| HubSpot | F3 | — |
| Proveedor de LLM | F1, F4 | Decisión pendiente |
| Google Ads (Keyword Planner) | F4 | Cuenta de Ads. F4 funciona sin ella, sin volúmenes |

## Orden de construcción

1. **Bloques comunes**: Deja rastro, Escribir en la hoja, Fila marcada, LLM.
2. **F3** (métricas): solo lectura. Es el más seguro para estrenar la instancia.
3. **F4** (keywords): solo lectura. Estrena el LLM.
4. **F1** (redactar): estrena la memoria de marca.
5. **F2** (LinkedIn): estrena Pide permiso y la primera acción irreversible. Se prueba primero en sombra: se construye el post y no se publica.
