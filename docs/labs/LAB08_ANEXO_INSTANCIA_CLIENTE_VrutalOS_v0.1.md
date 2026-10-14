**VRUTAL OS**

**LAB 08 · PLATFORM — Anexo B**

**La Instancia**

*Un cliente, una instancia*

Documento vivo · v0.1 — Propuesta, pendiente de validación e integración en LAB 08 v1.0

*Building Intelligent Companies.*

---

# 1. Qué resuelve

Cómo pasa un especialista del catálogo de Vrutal1st a trabajar dentro de la empresa del cliente. Y cómo sabemos, desde Vrutal1st, que está trabajando bien, sin tocar nunca sus claves.

El primer cliente somos nosotros: **Vrutal-labs**. Nada se ofrece a un cliente real hasta que Vrutal-labs ha hecho el ciclo completo sin un solo paso manual sin documentar (LAB 12, cap. 3 bis).

# 2. La regla

**Un cliente es una instancia.** Una instancia Docker con URL propia, aislada del resto.

**Vrutal1st está en el camino del cambio, nunca en el de la ejecución.** Decide qué debe correr en cada cliente. No entra en su máquina, no ejecuta sus flujos, no ve sus claves.

# 3. Qué hay dentro de una instancia

| Pieza | Para qué |
|---|---|
| Traefik | Entrada única. Da al cliente su URL (`<cliente>.<dominio>`) con TLS. |
| VrutalOS (app web) | El panel del cliente: especialistas, conversaciones, aprobaciones, integraciones. |
| Activepieces + Postgres 16 + Redis | Ejecuta los flujos de los especialistas. No se expone a internet. |
| Postgres 17 + Qdrant | La Memoria del Cuore (Anexo A): conocimiento del cliente y búsqueda semántica. |
| Deployer | Aplica en Activepieces lo que Vrutal1st ha decidido. Lo lee; nadie se lo empuja. |

Los datos de la app (usuarios, aprobaciones, registro de ejecuciones, espejo del catálogo) viven en **un proyecto Supabase por cliente**. Vrutal-labs usa el suyo desde el primer día.

# 4. Qué sabe Vrutal1st y qué no

| Vrutal1st sabe | Vrutal1st no sabe nunca |
|---|---|
| Qué especialistas y qué tareas tiene contratadas el cliente | Sus API keys |
| Qué versión de cada composición debe correr | Sus contraseñas |
| Qué versión corre de verdad (lo cuenta el latido) | El contenido de sus conversaciones |
| Si cada conexión está validada, falla o falta | Los datos de sus sistemas |
| Los errores de ejecución: qué falló, cuándo y dónde | |

# 5. Las claves del cliente

1. El cliente entra en **Integraciones** de su VrutalOS.
2. Pega la clave de cada sistema de su stack: CRM, email, analítica…
3. La instancia la **prueba** contra el proveedor antes de guardarla.
4. Si funciona, la guarda **cifrada** en su propia bóveda y crea la conexión en su Activepieces.
5. La pantalla muestra «validada · fecha» o el error del proveedor. **La clave no se vuelve a mostrar nunca.**
6. Cambiarla es sobrescribirla. No existe «ver» ni «copiar».
7. Vrutal1st solo recibe el estado de la conexión.

Si Vrutal1st cae o se filtra, no expone la clave de ningún cliente. Esa es la razón de la regla.

# 6. El ciclo de vida de un especialista

**Catálogo** → **Contratado** → **Planificado** → **Paquete** → **Instalado** → **Sombra** → **Activo**

| Estado | Qué significa | Quién lo mueve |
|---|---|---|
| Contratado | El cliente tiene el rol; sus tareas están habilitadas | Vrutal, en Vrutal1st |
| Planificado | Para cada tarea hay una composición resuelta con su stack | Vrutal1st |
| Paquete | El flujo está ensamblado y verificado (sha de cada bloque) | Vrutal1st |
| Instalado | El deployer lo ha importado en el Activepieces del cliente | La instancia |
| Sombra | Lee datos reales; sus escrituras se registran, no se ejecutan | Vrutal |
| Activo | Escribe en los sistemas del cliente | El Admin del cliente |

Un especialista solo pasa a **listo** si todas las conexiones que necesita están validadas. Si falta una clave, o falla, se ve en rojo en la instancia y en Vrutal1st.

# 7. El latido

Cada pocos minutos, la instancia envía a Vrutal1st una señal ligera con:

- las versiones de la app, de Activepieces y de la plantilla;
- el estado de cada especialista y de cada conexión, sin claves;
- los últimos errores de ejecución.

Con eso, Vrutal1st detecta tres cosas: una instancia caída, una clave rota y una aprobación bloqueada más de 24 horas.

# 8. El orden de alta

Es el mismo para un cliente nuevo, para recuperar uno y para graduar un piloto (LAB 12, cap. 3 bis). En Vrutal1st es un checklist: ningún paso se marca sin evidencia, y ninguno sin el anterior.

1. **Máquina** — declarada y registrada en Vrutal1st.
2. **Plantilla** — la instancia, con la versión de plantilla anotada.
3. **Secretos** — los de la instancia, en su `.env`. No son los del cliente.
4. **Base de datos** — el proyecto Supabase del cliente, con su esquema.
5. **Monitorización** — el latido llega.
6. **Backups** — configurados y probados.
7. **Entrada** — el cliente recibe su URL y su primer acceso de Admin.

# 9. Por dónde empezamos

| Paso | Qué | Hecho cuando |
|---|---|---|
| 0 | Limpiar el catálogo de pruebas | Bloques y contratos, a cero |
| 1 | La instancia como plantilla, con Vrutal-labs como cliente 0 | `lab.<dominio>` sirve VrutalOS; Vrutal1st muestra la instancia y su checklist |
| 2 | Catálogo de Marketing: dominio, procesos, 3 roles | Roles con tareas agrupadas por proceso |
| 3 | Bloques y composiciones de Marketing | 3-5 tareas completas publicadas |
| 4 | Deployer: Vrutal1st decide, la instancia aplica | Una composición publicada aparece en Activepieces sin importar nada a mano |
| 5 | Integraciones y estado de agentes en VrutalOS | Clave mala: rojo. Clave buena: verde. La clave, ilegible |
| 6 | Latido en Vrutal1st | Una clave rota a propósito se ve en Vrutal1st en menos de 15 minutos |
| 7 | Primer cliente real | Solo después de 0-6 |

# 10. Deudas conocidas (se pagan antes del primer cliente real)

| Deuda | Hoy | Cómo se paga |
|---|---|---|
| **Anthropic (Claude) en una cuenta personal** | La organización de Anthropic es del Gmail personal del founder. La clave de Vrutal-labs sale de ahí. Solo para pruebas (2026-10-01) | Identidad de empresa (`ops@vrutal-labs.com`) dueña de la organización. Un workspace y una cuenta de servicio por instancia, cada uno con su límite. Facturación de la empresa |
| **Las claves las mete Vrutal, no el cliente** | En Vrutal-labs, Gonzalo carga las claves directamente como conexiones de Activepieces | Regla del § 5: **las claves las sube el Admin del cliente** desde Integraciones de su VrutalOS. Ni Vrutal ni el staff las tocan. Al construir esa pantalla, las conexiones de prueba se rehacen por esa vía |
| **OAuth con las apps de Activepieces** | Google, LinkedIn y HubSpot se conectan con las apps OAuth de Activepieces | Apps OAuth propias de Vrutal antes de conectar sistemas de un cliente |

# 11. Decisiones abiertas

- **Plantilla de instancia**: fijar la versión de Activepieces, que hoy usa `latest`.
- **Dominio**: elegir el de las instancias de cliente.
- **Autonomía**: unificar sus tres vocabularios antes del estado Sombra.
- **Bóveda local**: decidir cuál usa la instancia, el Vault del Supabase del cliente o el cifrado de conexiones de Activepieces. Se elige al construir el paso 5.
