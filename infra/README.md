# Infraestructura de instancias VrutalOS

Un cliente = una instancia Docker con URL propia (LAB08 Anexo B). Vrutal-labs es el cliente 0 (`lab`).

```
infra/
  edge/        Traefik: uno por VPS. HTTPS y enrutado por subdominio.
  instance/    Plantilla de instancia: una copia en marcha por cliente.
    clients/   <slug>.env de cada cliente. NUNCA en git.
```

## Qué corre en una instancia

| Servicio | Imagen | Para qué | ¿Visible desde internet? |
|---|---|---|---|
| `activepieces` | activepieces 0.82.0 | Ejecuta los flujos de los especialistas | Solo `/api/v1/webhooks` en `<slug>-flows.vrutal-labs.com` |
| `ap_postgres`, `ap_redis` | postgres 16, redis 7 | Base de datos y cola de Activepieces | No |
| `memory_postgres`, `qdrant` | postgres 17.11, qdrant v1.16.2 | Memoria del Cuore (Anexo A) | No |
| `vrutalos_web` | vrutalos-web | App del cliente (perfil `app`, pendiente de construir) | Sí: `<slug>.vrutal-labs.com` |

Las bases de datos están en una red `internal`: no tienen salida a internet y solo Activepieces llega a ellas.

## Alta de una instancia (orden LAB12 cap. 3 bis)

Cada paso se marca en Vrutal1st → ficha del cliente → Infraestructura, con evidencia.

1. **Máquina.** VPS con Docker. DNS: `*.vrutal-labs.com` apuntando a su IP (una sola vez por VPS).
2. **Plantilla.** Una vez por VPS:
   ```
   docker network create edge
   cd infra/edge && cp .env.example .env && docker compose up -d
   ```
   Por cliente: `cp instance/.env.example instance/clients/<slug>.env`.
3. **Secretos.** Rellenar `clients/<slug>.env`. Cada secreto se genera con `openssl rand -hex 32`. Nunca se copian a Vrutal1st ni a git.
4. **Base de datos.** Proyecto Supabase del cliente con su esquema. En el `.env`, solo la URL y la anon key.
5. **Monitorización.** Arrancar la instancia y comprobar el latido en Vrutal1st (pendiente: paso 6 del Anexo B):
   ```
   cd infra/instance
   docker compose -p <slug> --env-file clients/<slug>.env up -d
   ```
6. **Backups.** Volúmenes `ap_postgres_data`, `memory_postgres_data` y `qdrant_data`, más una restauración probada.
7. **Entrada.** Con la app construida: `--profile app up -d` y se entrega `https://<slug>.vrutal-labs.com` al Admin del cliente.

## Acceso del staff a Activepieces

La interfaz no se publica. Desde tu máquina:
```
ssh -L 8080:127.0.0.1:<AP_ADMIN_PORT> <vps>
```
y abre `http://localhost:8080`.

## Reglas

- Versiones fijadas siempre. Nada de `latest`.
- `clients/*.env` nunca en git: son los secretos de la instancia.
- Las claves del cliente (CRM, email…) no pasan por aquí. Las mete el cliente en Integraciones de su VrutalOS (Anexo B, § 5).
- Actualizar una instancia = cambiar la versión aquí, probar en `lab` y después desplegar por lotes (LAB12 cap. 10 bis).

## Modo local (tu máquina, sin dominio público)

```
cd infra/edge && cp .env.local.example .env.local
docker compose -f docker-compose.yml -f docker-compose.local.yml --env-file .env.local up -d
```

En `clients/<slug>.env` se pone `BASE_DOMAIN=localhost`, `EDGE_ENTRYPOINT=web`, `PUBLIC_SCHEME=http` y `PUBLIC_PORT_SUFFIX=:8088`.

- La app queda en `http://<slug>.localhost:8088`. El navegador resuelve `*.localhost` sin DNS.
- Los webhooks quedan en `http://<slug>-flows.localhost:8088/api/v1/webhooks/…`.
- Para que terceros lleguen a los webhooks hace falta un Cloudflare Tunnel.

## Estado actual (2026-10-01)

**`lab` (Vrutal-labs, cliente 0) corre con esta plantilla en local, desde cero:**
- Edge en el puerto 8088.
- Activepieces 0.82.0 en `127.0.0.1:18001`, con Postgres 16, Redis, Postgres 17 y Qdrant.
- Borrón y cuenta nueva: 0 flujos, 0 conexiones, 0 usuarios.
- `AP_ENCRYPTION_KEY` y `AP_JWT_SECRET` regeneradas el 2026-10-01.

La instancia antigua está borrada: contenedores, volúmenes e imagen `latest`. Su compose y su `.env` están en `_eliminar/activepieces-instancia-antigua/` y ya no se usan.

**Comprobado:**
- Interfaz del staff: 200.
- Por el edge:
  - Webhooks: llegan a Activepieces.
  - Interfaz: 404.
- Bases de datos: sin salida a internet.
- Qdrant: 401 sin clave.
