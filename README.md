# Vrutal Labs

Repositorio de trabajo de Vrutal Labs: documentación, plano de control (Vrutal1st), flujos e infraestructura de las instancias de cliente.

Reorganizado el 2026-10-01. Qué se movió y de dónde: `MOVIMIENTOS.md`.

## Mapa

| Carpeta | Qué hay | Fuente de verdad de… |
|---|---|---|
| `docs/BITACORA.md` | **Empieza por aqui.** Como esta hecho todo, por que asi y como se conecta: los dos planos, tablas, permisos, claves y deudas | Entrega de llaves / estado al dia |
| `docs/labs/` | Los LAB vigentes en Markdown (LAB00 a LAB15 y anexos) y el BRIEF | Qué es Vrutal y cómo funciona |
| `docs/labs/word/` | Versiones Word de los LAB; LAB07 solo existe aquí | — |
| `docs/arquitectura/` | Contexto de arquitectura v2, modelo de datos de roles y tareas, integración O*NET/ESCO/APQC | Decisiones técnicas (D-01…) |
| `docs/producto/` | Propuesta de roles de Marketing, briefs de las apps (Lovable), cuestionarios de onboarding | Diseño de producto |
| `docs/comercial/` | Presentaciones y diagramas comerciales | — |
| `db/migrations/` | Migraciones SQL del plano de control, Vrutal 1st (001…) | Esquema de Vrutal 1st |
| `db/plantillas/` | Plantilla de BBDD de un cliente y `cambios/`: scripts que se aplican a **cada** proyecto de cliente (ver su README) | Esquema de la BBDD de cliente |
| `db/auditoria/` | Scripts de auditoría de seguridad | — |
| `Panel-Vrutal1st/` | Panel de control de Vrutal (React + Supabase) | Código del panel |
| `VrutalOS/` | App del cliente (React + Supabase): `diseno/` mockup aprobado y `app/` código | Código y diseño de la app del cliente |
| `Activepieces/flows/` | Diseño de flujos, bloques y plantillas importables | Flujos de los especialistas |
| `Activepieces/tools/` | Script de publicación de bloques a Git | — |
| `infra/` | Plantillas Docker: edge (Traefik, uno por VPS) e instancia de cliente | Cómo se monta un cliente |
| `marca/` | Logos, favicons, Brand Book y Documento Fundacional (PDF) | Identidad visual |
| `web/vrutal-lab00/` | Tema WordPress de la web | — |
| `agentes/skills/` | Skills de agentes: frontend, WordPress, PostgreSQL | — |
| `datos/fuentes/` | Fuentes O*NET, ESCO y APQC (ya importadas al catálogo) | — |
| `datos/linkedin/` | Exportación de LinkedIn. **Fuera de git**: datos personales | — |
| `_referencias/` | Libros y PDFs de consulta. **Fuera de git** | — |
| `_eliminar/` | Redundante o superado, pendiente de borrar. Ver su `README.md`. **Fuera de git** | — |

## Reglas para no volver al desorden

- **Una sola copia de cada documento.** Los LAB viven en `docs/labs/`. Si hace falta en otra herramienta (Obsidian, Claude), se enlaza, no se copia.
- **Versión nueva = misma ruta.** Al sacar una versión, la anterior va a `_eliminar/` o se sustituye. Nunca dos versiones vigentes conviviendo.
- **Migraciones numeradas en `db/migrations/`**, una por cambio, aplicadas en orden.
- **Secretos nunca en el repo.** `.env` y `infra/instance/clients/` están en `.gitignore`. Sí se versionan los `*.env.example`.
- **Nada pesado ni con licencia de terceros en git**: va a `_referencias/`.

## Fuera de este repositorio

- `C:\VrutalOS`: clon del repo privado `Vrutal-Gon/VrutalOS`, donde se publican los artefactos de los bloques.
- Supabase **Vrutal 1st** (`apmhvqlvwjcrwfaixgju`): plano de control.
- Supabase **VrutalOS** (`rgauumxztblwurzebmsa`): datos de Vrutal-labs, el cliente 0.
