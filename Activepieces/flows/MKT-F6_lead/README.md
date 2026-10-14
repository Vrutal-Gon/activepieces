# MKT-F6 · Puntuar un lead y proponer su estado

`marketing_analyst` · VRL-MKT-A01 · diseño en [MARKETING_flujos_v0.2.drawio](../MARKETING_flujos_v0.2.drawio) (página **F6**).

```
Recibe → Ordena → Consulta → Decide → Pide permiso → Ejecuta → Deja rastro
```

Patrón RULES, riesgo medio, reversible. «Pide permiso» solo se activa si la decisión propone MQL; esa condición vive **dentro** del bloque, no es una rama. El umbral no está calibrado: no inventar pesos.

| Archivo | Qué es |
|---|---|
| `F6.template.json` | Esqueleto importable en Activepieces. El flujo se importa en **borrador** (sin publicar): no se ejecuta solo |

## Puesta en marcha

1. En la hoja `Vrutal-labs · Marketing`, crea estas pestañas (cabeceras exactas en la fila 1):

| Pestaña | Cabeceras |
|---|---|
| `Perfil` | `campo` · `valor` (ya existe) |
| `Leads` | `fecha` · `lead_id` · `source` · `company` · `role` · `status` |
| `Rastro` | `fecha` · `flujo` · `tarea` · `resultado` · `detalle` |

2. Conexiones que ya existen en la instancia: `Google · Vrutal-labs` y `Claude · Vrutal-labs`.
3. **Flujos → Importar** → `F6.template.json`. Los pasos se configuran en este orden:

| Paso | Qué hay que hacer |
|---|---|
| `trigger` Recibe | Copia lista para importar: ya lleva un secreto generado. En la plantilla del repo el valor es un marcador: cámbialo por un secreto aleatorio de 32+ caracteres (`openssl rand -hex 24 | tr -d '
' | clip`). Quien llame envía la cabecera `X-Vrutal-Token` |
| `step_1` Ordena · Lead | Sin configurar: ya valida el contrato. Revisa que `sources` apunte a la salida correcta |
| `step_2` Consulta · ICP + actividad del lead | **Sustituir el paso.** Devolver el ICP (pestaña `Perfil`) y la actividad del lead (HubSpot). Dos lecturas en un bloque: decidir si se separan en dos pasos. |
| `step_3` Decide · reglas ICP + intención → lead o MQL | **Sustituir el paso.** Reglas deterministas (sin LLM) que devuelvan `lead` o `mql`. Pesos y umbral SIN CALIBRAR (LAB 11): fijarlos con datos del piloto, no inventarlos. |
| `step_4` Pide permiso · aprobar el paso a MQL | **Sustituir el paso.** Solo si la decisión es `mql`: pedir aprobación al founder; si es `lead`, pasar sin pedirla. La condición vive dentro del bloque. Fail-closed: sin respuesta, no cambia el estado. |
| `step_5` Ejecuta · actualizar el estado del lead | **Sustituir el paso.** Actualizar el estado del lead (HubSpot u hoja `Leads`). Reversible. |
| `step_6` Deja rastro | Nada que hacer: pestaña `Rastro` y los campos A–E ya vienen puestos. |

4. **Probar flujo** y comprobar la salida de cada paso antes de publicar.

## Pasos pendientes (fallan a propósito)

- **Consulta · ICP + actividad del lead** — Devolver el ICP (pestaña `Perfil`) y la actividad del lead (HubSpot). Dos lecturas en un bloque: decidir si se separan en dos pasos.
- **Decide · reglas ICP + intención → lead o MQL** — Reglas deterministas (sin LLM) que devuelvan `lead` o `mql`. Pesos y umbral SIN CALIBRAR (LAB 11): fijarlos con datos del piloto, no inventarlos.
- **Pide permiso · aprobar el paso a MQL** — Solo si la decisión es `mql`: pedir aprobación al founder; si es `lead`, pasar sin pedirla. La condición vive dentro del bloque. Fail-closed: sin respuesta, no cambia el estado.
- **Ejecuta · actualizar el estado del lead** — Actualizar el estado del lead (HubSpot u hoja `Leads`). Reversible.

## Contratos

- **Lead** (existente; campos propuestos): `lead_id`, `source`, `company`, `role`, `status`

## Seguridad

- Todo paso «pendiente» lanza un error: un flujo a medio configurar nunca actúa.
- Los prompts solo reciben campos estructurados del cliente; nunca texto libre del cliente (los prompts viven aún dentro del paso: deuda declarada en F4).
- Las celdas que escribe `Ordena` no pueden empezar por `= + - @` (anti fórmula).
- El disparador es un webhook con cabecera `X-Vrutal-Token`: pon un secreto real antes de publicar.
