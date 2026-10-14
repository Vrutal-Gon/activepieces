# Marketing · flujos F5 a F14 · v0.2 (diagramas aprobados por el founder, 2026-10-02)

Segundo lote de 10 flujos, solo en draw.io: [MARKETING_flujos_v0.2.drawio](MARKETING_flujos_v0.2.drawio), una página por flujo. Mismo estilo y mismas reglas que [MARKETING_flujos_v0.1.md](MARKETING_flujos_v0.1.md): línea recta, un bloque hace una sola cosa, lo condicional vive dentro del bloque, y no se nombran herramientas hasta aprobar el proceso.

**Método (2026-10-02):** se diseñan 10 flujos en draw.io; tras aprobarlos, se construyen en Activepieces **de uno en uno**. No se construye nada antes de la aprobación.

## Los 10 flujos

| Flujo | Rol | Tarea | Patrón | Riesgo | Aprobación | Entrega |
|---|---|---|---|---|---|---|
| F5 · Ficha comparativa de competidores | marketing_analyst | A1 TSK-000178 | AGENT | bajo | no | CompetitorCard *(nuevo)* |
| F6 · Puntuar un lead y proponer su estado | marketing_analyst | A4 VRL-MKT-A01 | RULES | medio | solo el paso a MQL | Lead |
| F7 · Diagnóstico por canal frente a su objetivo | marketing_analyst | A6 TSK-000189 | LLM | bajo | no | ChannelDiagnosis *(nuevo)* |
| F8 · Informe semanal de marketing | marketing_analyst | A8 TSK-000081 | LLM | bajo | no (interno) | WeeklyReport *(nuevo)* |
| F9 · Tendencias de búsqueda y competidores | search_marketing | S1 TSK-000163 | AGENT | bajo | no | OpportunityList *(nuevo)* |
| F10 · Asignar keywords a páginas | search_marketing | S4 TSK-000128 | LLM | bajo | no | ContentBrief |
| F11 · Auditoría técnica del sitio | search_marketing | S6 TSK-000119 | SCRIPT | bajo | no | SiteFinding *(nuevo)* |
| F12 · Calendario editorial a 4 semanas | content_promotion | C1 VRL-MKT-C01 | LLM | bajo | no | EditorialPlan *(nuevo)* |
| F13 · ContentBrief de cada pieza | content_promotion | C2 TSK-000197 | LLM | bajo | no | ContentBrief |
| F14 · Adaptar una pieza aprobada a cada canal | content_promotion | C5 VRL-MKT-C02 | LLM | medio | cada adaptación | ContentDraft |

**Por qué estas 10.** Tres roles, distintas tareas y distintos patrones. Quedan fuera las que tienen bloqueo legal o de cuenta (S5, S7 a S9, C7). Las demás tareas de los roles entran en lotes siguientes.

## Cómo se encadenan
Los flujos ya diseñados y los nuevos forman una cadena con un mismo contrato entre eslabones:

```
F4 KeywordSet → F12 calendario → F13 ContentBrief → F1 ContentDraft → F14 adaptación por canal → F2 publicar
F3 foto semanal → F7 diagnóstico → F8 informe semanal
F4 KeywordSet → F10 keyword→página → F13 ContentBrief
```

## Bloques y contratos
- **Contratos que ya existen:** MetricsSnapshot, KeywordSet, ContentBrief, ContentDraft, Lead, ApprovalRequest, RunRecord.
- **Contratos nuevos (6):** CompetitorCard, ChannelDiagnosis, WeeklyReport, OpportunityList, SiteFinding, EditorialPlan. Se definen al construir cada flujo, no antes.
- **Se reutilizan siempre:** Recibe · programación, Escribir en la hoja, Deja rastro. «Pide permiso» aparece en F6 y F14.

## Notas por flujo que conviene aprobar
- **F6:** el paso «Pide permiso» solo se activa si la decisión propone MQL; esa condición vive dentro del bloque, no es una rama. La regla de aprobación se mantiene mientras el umbral de intención no esté calibrado con datos del piloto (LAB 11).
- **F9 y F11:** necesitan Search Console, que hoy no está disponible (sin web verificada). El diseño es válido; la construcción espera esa fuente.
- **F13:** la «prueba» del brief debe citar su fuente. Si no hay, queda vacía: el rol nunca inventa cifras ni casos.
- **F14:** es de cara al público, así que cada adaptación pasa por «Pide permiso».
- **F5, F7, F8:** F7 y F8 dependen de F3 (la foto semanal), que hoy solo tiene HubSpot como fuente.

## A decidir al aprobar
1. ¿Entran los 10, o se quita o se cambia alguno?
2. ¿Cuál se construye primero en Activepieces? Propuesta: el de menos dependencias externas, **F13** (ContentBrief), que solo necesita la hoja y el modelo.
