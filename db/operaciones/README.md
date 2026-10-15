# Operaciones puntuales

SQL de una sola vez, para **pegar en el SQL Editor** de un proyecto. No son cambios de
esquema reutilizables: eso va en `../plantillas/cambios/`.

**No se pone nada aquí dentro de `../plantillas/cambios/`**: `scripts/aplicar-cambios-cliente.sh`
recorre esa carpeta y trataría el fichero como un cambio a aplicar en todos los clientes.

| Fichero | Qué hace | Dónde se ejecutó |
|---|---|---|
| `2026-10-15_retro_vrutal-labs.sql` | Crea `schema_change_log` y anota los 13 cambios que ya estaban aplicados a mano en Vrutal-labs, sin ejecutarlos. Equivale a `aplicar-cambios-cliente.sh --apply --retro`, pero por SQL Editor, sin necesitar la contraseña de la base. Idempotente. | Pendiente · Vrutal-labs (`rgauumxztblwurzebmsa`) |
