# Sprint 2 · semana del 2026-10-15

Instancia de la plantilla de [`PROJECT_MANAGER_VRUTAL.md`](PROJECT_MANAGER_VRUTAL.md) §11.
Sprint anterior: [`SPRINT_01.md`](SPRINT_01.md), cerrado.

## Sprint Goal

**Cerrar lo que bloquea al primer cliente externo, y desbloquear el primer flujo real.**

El sprint 1 hizo reproducible el alta de un cliente. Este cierra los tres puntos de
Launch Readiness (§14) que siguen abiertos en seguridad, y construye el paso que tiene
parado a MKT-F2.

## Scope

| # | Entregable | Criterio de hecho |
|---|---|---|
| 1 | ~~**Permisos regalados en Vrutal1st**~~ → **HECHO 2026-10-15**, migración `032` | 23 tablas → 0; `catalog` y `deployment` ya estaban limpios |
| 2 | ~~**Dominio de correo con tabla + trigger** sobre `auth.users`~~ → **HECHO 2026-10-15**, aplicado en Vrutal-labs | Bloquea alta, cambio de correo y solicitud de cambio. 6/6 en la prueba |
| 3 | **Construir el paso «Pide permiso» de MKT-F2** | El flujo se pausa, aparece en Aprobaciones de VrutalOS y **se reanuda de verdad** al decidir |
| 4 | **MFA del staff**: activar TOTP y exigir `aal2` en `has_platform_role()` | Founder enrolado y verificado antes de exigirlo |

### Diferido, con motivo

| Diferido | Por qué |
|---|---|
| **Secuencias regaladas** | **No existe el problema.** Comprobado el 2026-10-15: el ACL real es `authenticated=U` (solo USAGE), sin SELECT ni UPDATE, así que no hay riesgo de `setval`. El `rwU` que aparecía venía de los privilegios por defecto de `supabase_admin`, que no es la vía por la que se crean estas secuencias. Se retira del plan |
| Autonomía por tarea | Necesita decisión de producto antes que código: techo por tarea en el catálogo y que el gate lea `task_autonomy_effective` |
| Database Webhook de redes sociales | Hay vía que funciona (sync de 15 min, migración 030) |
| Rotación de `sync_cron_token` | Sin procedimiento escrito; va con MFA en el bloque de seguridad del siguiente |
| Entregables: colecciones + bloque «Escribir en la tabla» | Va detrás de que F2 funcione de punta a punta |

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El 2 toca `auth.users`, que es de Supabase | Trigger propio, no modificar los suyos. Prueba en seco antes |
| El 3 puede descubrir que el puente de aprobaciones necesita otra fuente de URL | Ya se sabe lo esencial (2026-10-14): la pausa es de ámbito de ejecución y hay que quitar el sufijo `/confirm`. Probar en sombra antes de activar |
| El 4 puede dejar al founder fuera del panel si se exige `aal2` antes de enrolarse | Enrolar primero, verificar que entra, y solo entonces exigirlo |

## Resultado del 1 (2026-10-15)

**23 tablas de `public` en Vrutal1st** daban `TRUNCATE`, `REFERENCES` y `TRIGGER` a `anon` y
`authenticated`. Misma causa raíz que en el cliente: la entrada de `postgres` en
`pg_default_acl` (`authenticated=Dxtm`) los reponía en cada tabla nueva.

**Por qué aquí era peor que en el plano de datos:** en `public` viven `user_roles`, `roles`,
`permissions` y `role_permissions` — el RBAC del staff. Y **TRUNCATE no dispara triggers de
fila**, así que `trg_user_roles_last_superadmin`, que existe para que ninguna operación deje
el sistema sin superadmin, **no se habría ejecutado** ante un `truncate user_roles`.

Alcance real: `anon`/`authenticated` llegan por PostgREST, que no expone TRUNCATE. Era defensa
en profundidad, no una puerta abierta. Se cierra porque el permiso no tenía razón de estar y
la consecuencia, si alguna vez se alcanzara, es perder el control de acceso del staff.

`catalog` y `deployment` ya estaban limpios: la IP no estaba afectada. Verificado tras aplicar:
0 restantes, permisos de datos intactos.
