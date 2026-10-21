# VrutalOS · UX del scope de negocio · rol «Admin de Marketing» (v0.1)

> **Qué es esto.** El diseño de la pantalla donde el cliente completa la información de su negocio que
> los flujos necesitan para funcionar. Hasta hoy esa información vive en pestañas de una hoja de Google
> escritas por Vrutal; ahora son tablas de la base del cliente (cambios `2026-10-16_mkt_entradas.sql` y
> `2026-10-17_marketing_admin.sql`).
>
> **Estado de los datos: vacío a propósito.** Las tablas existen y no tienen contenido real todavía. No
> se rellenan con datos inventados para que una pantalla «se vea bien».

---

## 1. Por qué existe esta pantalla

Un flujo con entradas vacías **debe fallar y no escribir nada** (regla de
`Activepieces/GUIA_construir_flujos.md`). Hoy eso significa que MKT-F4, F13 y F7 dependen de que alguien
de Vrutal escriba a mano en una hoja. Esta pantalla mueve ese trabajo a quien tiene la información —el
cliente— sin romper la regla que lo hace posible: **un prompt estándar solo lee campos estructurados que
define Vrutal**; el texto libre del cliente es el nivel «a medida», que es otro producto.

De ahí las dos mitades del diseño: campos de **lista cerrada** (los define Vrutal, el cliente pone el
valor) y tablas propias donde el cliente sí añade filas (competencia, productos foco, objetivos).

---

## 2. El permiso, resuelto

| Capacidad | `client_admin` | `client_marketing_admin` | `client_user` |
|---|---|---|---|
| Ver el scope de negocio | sí | sí | hoy sí · **decisión abierta**, ver abajo |
| Crear, editar y borrar filas propias (`source = 'cliente'`) | sí | sí | no |
| Tocar las filas de Vrutal (`source = 'vrutal'`) | no | no | no |
| Ver entregables y aprobar propuestas | todo | solo los especialistas a los que el Admin le dé acceso | solo con acceso |
| Equipo, accesos, integraciones, consumo, facturación | sí | no | no |

Lo aplica el **servidor**, no la pantalla: las políticas de escritura son
`public.is_admin_or_marketing() and source = 'cliente'` sobre `mkt_input_value`, `mkt_channel_target`,
`mkt_competitor` y `mkt_focus_product`. Esconder un botón es UX; lo que protege es RLS.

**Tres decisiones que responden a «puede o no tener permiso, o ser la misma persona»:**

1. **El Admin es superconjunto: siempre puede.** En la mayoría de clientes el Admin y el responsable de
   marketing **son la misma persona**; si el Admin no pudiera escribir, un cliente de una sola persona no
   podría arrancar. Por eso la política dice «admin **o** marketing», no «solo marketing».
2. **Nadie tiene dos roles.** `profiles.role` es un solo valor. La misma persona no necesita dos: con
   `client_admin` ya tiene todo lo del Admin de Marketing. Invitar a alguien como Admin de Marketing es
   para cuando **no** es la misma persona.
3. **Un «Admin sin permiso al scope» no existe y no se va a inventar un rol para eso.** Si algún día hace
   falta (un Admin de IT que no debe ver precios ni estrategia), eso es una **capacidad por usuario**, no
   un rol más: se decide entonces, con su tabla, no antes.

**Decisión abierta (bloquea solo a `client_user`):** hoy cualquier usuario activo **lee** el scope,
porque la política de lectura es `public.is_active_user()`. Ahí hay precios, estrategia y
diferenciadores. Si eso no debe verlo todo el equipo, hay que reemplazar cuatro políticas por
`public.is_admin_or_marketing()`. El SQL está en §8. **Hay que decidirlo antes de construir la pantalla**,
porque cambia quién ve la entrada en el menú.

---

## 3. Dónde vive en la navegación

**Un solo punto de entrada: «Negocio» (`/negocio`), con seis pestañas.** Mismo patrón de pestañas que
«Su trabajo» de un especialista (`chip-group` + `aria-pressed`, ver `components/WorkSection.tsx`), no seis
entradas en el menú.

**Va en el espacio «Mi trabajo», no en «Administración».** El espacio de administración está detrás de
`isAdmin` (`app/src/App.tsx:113`) y el Admin de Marketing **no es admin**: abrirle ese espacio para una
sola entrada obligaría a filtrar media sección. En «Mi trabajo» encaja además por significado: completar
el scope es trabajo del negocio, no administración de la cuenta.

Grupo nuevo en `lib/nav.ts`, dentro de `trabajo`:

```
{ label: 'Negocio', items: [{ to: '/negocio', label: 'Negocio', icon: '⌂', roles: ['client_admin', 'client_marketing_admin'] }] }
```

**Cambio de modelo en `nav.ts`:** hoy el filtro es `adminOnly: boolean` y `visibleGroups(workspace, isAdmin)`.
Con tres roles un booleano ya no vale: pasa a `roles?: ProfileRole[]` (ausente = lo ve cualquiera) y
`visibleGroups(workspace, role)`. Es un cambio pequeño y hay que hacerlo **antes**, o la entrada nueva
tendrá que colarse con un `adminOnly` que miente. `App.tsx` mantiene `isAdmin` para lo suyo y añade
`canEditScope = role === 'client_admin' || role === 'client_marketing_admin'`.

---

## 4. Las seis pestañas

El orden importa: va de lo que ya alimenta flujos a lo que todavía no.

| # | Pestaña | Tabla | Forma | Campos (literales) |
|---|---|---|---|---|
| 1 | **Perfil e ICP** | `mkt_input_value` · `input_key = 'icp'` | campo/valor, lista cerrada | un valor: `tipo_empresa`, `tamano_empresa`, `facturacion`, `sector`, `rol_comprador` · varios: `idioma`, `dolor`, `miedo`, `no_encaja` |
| 2 | **Marca** | `mkt_input_value` · `'brand_voice'` | campo/valor, lista cerrada | varios: `voz`, `diccionario`, `prohibidos` |
| 3 | **Objetivos** | `mkt_channel_target` | tabla | `channel` (lista: seo, sem, email, linkedin, social, web, other), `metric`, `target`, `period` (semanal, mensual, trimestral) |
| 4 | **Competencia** | `mkt_competitor` | tabla | `name`, `website` (ha de empezar por http:// o https://), `notes`, `priority` |
| 5 | **Estrategia** | `mkt_input_value` · `'strategy'` + `mkt_sem_strategy` | mixta: campo/valor arriba, tabla de estrategias SEM debajo | un valor: `posicionamiento`, `estrategia_precio` · varios: `propuesta_valor`, `diferenciador`, `canal_prioritario` · tabla SEM: `objective` (lista: crecimiento_marca, generar_leads, incrementar_roi, incrementar_ctr, reducir_cac, empuje_producto), `starts_on`/`ends_on` (calendario de rango), `budget_monthly`+`currency`, `focus_product_id` (obligatorio si `empuje_producto`), `geo`, `landing_url`, `status` (planificada, activa, pausada), `notes`. **Sin métrica**: eso es Objetivos |
| 6 | **Productos foco** | `mkt_focus_product` | tabla | `name`, `description`, `price_note`, `priority`, `status` (activo, pausado) |

**Cada pestaña dice para qué sirve, y si todavía no sirve, lo dice.** Esto no es un detalle de copy: es la
diferencia entre pedirle trabajo al cliente y pedírselo en balde.

| Pestaña | Línea bajo el título |
|---|---|
| Perfil e ICP | «Lo usan tu Especialista SEO/SEM y tu Especialista de Contenido para proponer keywords y briefs.» |
| Marca | «La usan tu Especialista de Contenido al redactar y al revisar la voz.» |
| Objetivos | «Los usa tu Analista de Mercado para decirte, por canal, si vas por encima o por debajo.» |
| Competencia | «La usará tu Analista de Mercado para fichar a cada competidor. Aquí dices **a quién mirar**; la ficha de lo observado aparece en el trabajo del especialista.» |
| Estrategia | «Tu estrategia SEM (qué persigues y entre qué fechas) la leerá tu Especialista SEO/SEM cuando actives SEM. Los campos de texto todavía no los usa ningún especialista: los guardamos para cuando los use.» |
| Productos foco | «Todavía no los usa ningún especialista: los guardamos para cuando los use.» |

La confusión que hay que evitar en Competencia: **entrada ≠ salida**. El cliente dice a quién vigilar; la
`CompetitorCard` que produce MKT-F5 es un entregable y vive en «Su trabajo», no aquí.

---

## 5. Comportamiento, estado por estado

**Pestaña vacía.** `empty-state` con el porqué y un botón. Ejemplo (Objetivos): título «Sin objetivos
por canal», cuerpo «Mientras esté vacío, tu Analista de Mercado no puede comparar lo que pasó con lo que
esperabas», botón «Añadir un objetivo».

**Fila de Vrutal (`source = 'vrutal'`).** Insignia **Vrutal** y candado; no editable ni borrable (el
servidor lo rechaza igual). Acción secundaria **«Proponer un cambio»**, que crea un
`knowledge_update_request` con el campo y el valor propuesto. Lo que trae Vrutal de una auditoría se
complementa, nunca se machaca sin rastro. Esa tabla ya existe, pero **no tiene GRANT ni pantalla**: si
esta acción entra en el alcance, va con su cambio de permisos (§8). Si no entra, la insignia se queda y
el botón no se dibuja.

**Fila propia (`source = 'cliente'`).** Insignia **Tuyo**, edición en línea y borrado con confirmación.
Es lo único que la pantalla puede escribir.

**Campo de un solo valor.** No se «añade»: se edita el que hay. Si alguien lo intenta, el servidor
responde *«El campo sector de icp admite un solo valor: actualiza el que ya existe.»* — ese mensaje se
muestra tal cual; está escrito en el trigger para que la pantalla no tenga que repetir la regla.

**El cliente nunca crea campos.** El desplegable de cada bloque de campo/valor se construye leyendo
`mkt_input_field` (orden por `position`, texto `label`, ayuda `help`). Si Vrutal añade un campo, aparece
sin tocar el front.

**Guardado.** Por fila, al confirmar; sin «guardar todo». Error del servidor mostrado tal cual: los
mensajes de los CHECK y del trigger ya están en castellano. `updated_by` lo pone la base
(`default auth.uid()`): la pantalla no lo manda nunca.

**Nada de `catalog_*_ro`.** Esta pantalla no lee el catálogo de Vrutal, ni para pintar un nombre de
especialista: usa `specialists.display_name`.

---

## 6. La cabecera que da el valor: qué flujo está bloqueado

Arriba de las pestañas, dos cosas:

1. **Completitud**: «Scope de negocio: 3 de 6 bloques con información». Se calcula contando filas, no
   preguntando a nadie.
2. **Avisos por especialista**, derivados de lo que falta:
   - Objetivos vacío → «Tu Analista de Mercado no puede hacer el diagnóstico por canal.»
   - Perfil e ICP vacío → «Tu Especialista SEO/SEM no puede proponer keywords.»
   - Marca vacía → «Tu Especialista de Contenido no puede redactar con tu voz.»

El mapa aviso→flujo es el de §4 y vive en un solo sitio del código, no repartido por la pantalla. Esto
convierte una pantalla de formularios en la respuesta a «¿por qué mi especialista no ha hecho nada?».

---

## 7. Qué hay que construir, en orden

1. `lib/nav.ts`: `adminOnly` → `roles?: ProfileRole[]`; `visibleGroups(workspace, role)`; grupo «Negocio».
   `App.tsx`: `canEditScope` y la ruta `/negocio`.
2. `lib/types.ts`: `MktInputField`, `MktInputValue`, `MktChannelTarget`, `MktCompetitor`, `MktFocusProduct`.
3. `lib/api/negocio.ts`: lectura y escritura por bloque con el cliente de sesión (nunca `service_role`),
   siguiendo el patrón de `lib/api/work.ts` y `lib/api/team.ts`.
4. `pages/NegocioPage.tsx` + `styles/pages/negocio.css`, reutilizando `chip-group`, `empty-state`,
   `notice notice--info`, `text-input`, `PageHead`, `useAsyncData`, `ErrorNotice`, `LoadingState`.
5. Retirar de `lib/sections.ts` lo que deje de ser «Próximamente» (esta pantalla no estaba ahí: es nueva).
6. Probar a mano con los tres roles. Mientras no exista una segunda cuenta en Vrutal-labs, al menos con
   `client_admin` y con un `client_user` creado para la prueba.

---

## 8. SQL que la pantalla necesita y que todavía no está

1. **Las tres sentencias con `DROP CONSTRAINT`** de `2026-10-17_marketing_admin.sql` (el CHECK de
   `profiles.role`, el de `mkt_input_field.input_key` y el `insert` de los seis campos de `strategy`).
   Sin ellas **el rol no se puede asignar** y la pestaña Estrategia no tiene campos. El permiso automático
   del MCP las bloquea: van por el SQL Editor.
2. **Decisión §2, si se restringe la lectura** (cuatro políticas, una por tabla; requiere `drop policy`):

   ```sql
   drop policy mkt_input_value_select on public.mkt_input_value;
   create policy mkt_input_value_select on public.mkt_input_value
     for select to authenticated using (public.is_admin_or_marketing());
   -- igual para mkt_channel_target, mkt_competitor y mkt_focus_product
   -- (mkt_input_field puede seguir siendo legible por cualquier usuario activo: son etiquetas, no datos)
   ```

3. **Solo si entra «Proponer un cambio»**: `knowledge_update_request` tiene políticas pero **ningún
   GRANT** para `authenticated`; hay que concederle `select, insert` y limitar el insert a quien puede
   editar el scope.

---

## 9. Criterios de aceptación

- Un `client_user` no puede escribir **ni llamando a la API a mano**: lo rechaza RLS, no el front.
- Un Admin de Marketing no puede editar ni borrar una fila `source = 'vrutal'`, tampoco por API.
- El Admin, siendo la misma persona, hace todo lo anterior sin cambiar de rol.
- Con Objetivos vacío, la cabecera dice qué especialista está bloqueado.
- Un campo de un solo valor no admite dos, y el mensaje que ve el cliente es el del servidor.
- La pantalla no consulta `catalog_flow_ro`, `catalog_report_ro` ni `catalog_kpi_ro`.
- `npx tsc --noEmit` limpio y la pantalla se ve bien a 1280 y a 390 px de ancho.

---

## 10. Lo que NO entra en esta versión

Importar el scope desde un fichero o desde la web del cliente; historial de cambios por campo (hoy solo
hay `updated_at`/`updated_by`); aprobación de los cambios del cliente por parte de Vrutal; el bloque de
Ventas (`client_sales_admin`); traducción de los campos a otros idiomas; y la pantalla «Resumen de la
empresa» (`/admin`), que sigue pendiente y es otra cosa: esa resume la cuenta, no el negocio.
