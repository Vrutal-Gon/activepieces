# Operaciones puntuales

SQL de una sola vez, para **pegar en el SQL Editor** de un proyecto. No son cambios de
esquema reutilizables: eso va en `../plantillas/cambios/`.

**No se pone nada aquí dentro de `../plantillas/cambios/`**: `scripts/aplicar-cambios-cliente.sh`
recorre esa carpeta y trataría el fichero como un cambio a aplicar en todos los clientes.

| Fichero | Qué hace | Dónde se ejecutó |
|---|---|---|
| `2026-10-18_scope_vrutal-labs.sql` | Rellena el scope de negocio del cliente 0 con lo que ya está escrito en los LAB: marca (los cinco rasgos, el diccionario y los prohibidos de LAB 03/04), competencia (las categorías de LAB 03; el mapa con nombres es trabajo pendiente de LAB 06), productos foco (BRIEF §5.2 y LAB 10 cap. 8) y estrategia (LAB 03, LAB 10 cap. 7 y LAB 11). Todo con `source = 'cliente'`, editable desde la pantalla Negocio. Objetivos por canal se deja **vacío a propósito**. Idempotente. | Vrutal-labs · completo. Marca, competencia y productos el 2026-10-18 (16 + 5 + 6 filas); estrategia el 2026-10-19 (6 campos y 18 valores), en cuanto el CHECK de `input_key` admitió `strategy`. Objetivos por canal sigue vacío a propósito |
| `2026-10-15_retro_vrutal-labs.sql` | Crea `schema_change_log` y anota los 13 cambios que ya estaban aplicados a mano en Vrutal-labs, sin ejecutarlos. Equivale a `aplicar-cambios-cliente.sh --apply --retro`, pero por SQL Editor, sin necesitar la contraseña de la base. Idempotente. | Pendiente · Vrutal-labs (`rgauumxztblwurzebmsa`) |
