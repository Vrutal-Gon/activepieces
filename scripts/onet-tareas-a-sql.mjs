// =====================================================================
// Genera el SQL para importar tareas de O*NET a catalog.task de Vrutal 1st.
//
// Existe porque la importación original de 1.022 tareas se hizo fuera del repositorio y no
// es reproducible: no quedó script, ni criterio escrito, ni forma de extenderla a otro
// departamento. Esto lo arregla sin tooling de más: lee los CSV, escribe SQL por stdout, y
// no toca la base ni ningún fichero.
//
// EL CRITERIO, descubierto por arqueología el 2026-10-16 y ahora explícito: el import tomó
// las tareas con `Task Type = 'Core'`, y en las ocupaciones que no tienen ninguna Core, todas
// (el fichero trae 418 filas con el tipo vacío). Verificado contra la base: **21 de 21
// ocupaciones cuadran**. La única aparente excepción, `13-2051.00`, tiene sus 26 tareas con
// el tipo vacío, así que entraron todas — consistente con la regla.
//
// USO
//   node scripts/onet-tareas-a-sql.mjs --soc 11-2032.00,27-3031.00,41-3011.00
//   node scripts/onet-tareas-a-sql.mjs --soc 11-2032.00 --tipo todas
//   node scripts/onet-tareas-a-sql.mjs --soc 11-2032.00 --informe
//
//   --soc      lista separada por comas de códigos O*NET-SOC (obligatorio)
//   --tipo     Core (por defecto, la regla vigente) | todas
//   --informe  no emite SQL: imprime el reparto por SOC y las huellas md5, para la
//              verificación independiente y para la cabecera de la migración
//   --fuente   carpeta de los CSV (por defecto datos/fuentes/onet-esco-apqc)
//
// Los CSV están en .gitignore (32 MB, licencia de terceros). Si faltan, se descargan de
// https://www.onetcenter.org/database.html — fichero "Task Statements" y "Occupation Data".
// =====================================================================

import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const Q = '"';

/** Lector CSV con comillas (RFC 4180). Hace falta de verdad: 12.961 de las 18.838 filas van
 *  entrecomilladas porque el enunciado lleva comas. Un split(',') las parte mal. */
function parseCSV(txt) {
  const rows = [];
  let campos = [], cur = '', dentroDeComillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (dentroDeComillas) {
      if (c === Q) {
        if (txt[i + 1] === Q) { cur += Q; i++; } else dentroDeComillas = false;
      } else cur += c;
    } else if (c === Q) dentroDeComillas = true;
    else if (c === ',') { campos.push(cur); cur = ''; }
    else if (c === '\n') { campos.push(cur); rows.push(campos); campos = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur !== '' || campos.length) { campos.push(cur); rows.push(campos); }
  return rows;
}

/** Escapa un literal para SQL duplicando el apóstrofo, y NADA más.
 *  Es la semántica de `quote_literal` de Postgres. No se usa dollar-quoting: si un texto
 *  contuviera el tag, el fichero se rompería de forma difícil de ver. */
const lit = (s) => "'" + s.replace(/'/g, "''") + "'";

/** Lista BLANCA, y aborta. Hoy pasan las 157 filas de Marketing. El día que entre ESCO en
 *  español, el script se para y hay que decidir a conciencia, en vez de emitir SQL raro. */
function validar(texto, donde) {
  if (!/^[\x20-\x7E]+$/.test(texto)) {
    throw new Error(`${donde}: caracteres fuera de ASCII imprimible. Revisa a mano antes de importar.`);
  }
  if (texto.length > 500) {
    throw new Error(`${donde}: ${texto.length} caracteres, más de 500. Revisa a mano.`);
  }
}

// --- argumentos -------------------------------------------------------
const args = process.argv.slice(2);
const opt = (nombre, pordefecto = null) => {
  const i = args.indexOf('--' + nombre);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : pordefecto;
};
const informe = args.includes('--informe');
const tipo = opt('tipo', 'Core');
const fuente = opt('fuente', 'datos/fuentes/onet-esco-apqc');
const socs = (opt('soc') ?? '').split(',').map((s) => s.trim()).filter(Boolean);

if (!socs.length) {
  console.error('Falta --soc. Ejemplo: --soc 11-2032.00,27-3031.00,41-3011.00');
  process.exit(2);
}
if (!['Core', 'todas'].includes(tipo)) {
  console.error(`--tipo ha de ser Core o todas, no "${tipo}".`);
  process.exit(2);
}

// --- leer las fuentes -------------------------------------------------
function leer(nombre) {
  const ruta = resolve(fuente, nombre);
  try {
    return parseCSV(readFileSync(ruta, 'utf8'));
  } catch {
    console.error(`No se encuentra ${ruta}.`);
    console.error('Los CSV están fuera de git (32 MB, licencia de terceros).');
    console.error('Descárgalos de https://www.onetcenter.org/database.html');
    process.exit(2);
  }
}

const tareas = leer('task_statements.csv').slice(1);      // SOC,Title,TaskID,Task,TaskType,...
const ocupaciones = leer('occupation_data.csv').slice(1); // SOC,Title,Description

// La regla: Core, salvo en ocupaciones que no tienen ninguna Core, donde entran todas.
function filtrar(soc) {
  const todas = tareas.filter((r) => r[0] === soc);
  if (tipo === 'todas') return todas;
  const core = todas.filter((r) => r[4] === 'Core');
  return core.length > 0 ? core : todas;
}

const porSoc = new Map(socs.map((s) => [s, filtrar(s)]));
for (const [soc, filas] of porSoc) {
  if (!filas.length) { console.error(`El SOC ${soc} no tiene ninguna tarea en el CSV.`); process.exit(2); }
}

// --- informe ----------------------------------------------------------
if (informe) {
  console.log(`Criterio: ${tipo === 'Core' ? 'Core (o todas si la ocupación no tiene ninguna Core)' : 'todas'}`);
  console.log('');
  console.log('SOC          sale  Core  Suppl  total  md5 de los enunciados');
  let total = 0;
  for (const [soc, filas] of porSoc) {
    const t = tareas.filter((r) => r[0] === soc);
    const core = t.filter((r) => r[4] === 'Core').length;
    const sup = t.filter((r) => r[4] === 'Supplemental').length;
    const huella = createHash('md5')
      .update([...filas].sort((a, b) => (a[0] + '.' + a[2] < b[0] + '.' + b[2] ? -1 : 1))
        .map((r) => r[3]).join('\n'))
      .digest('hex');
    console.log(`${soc.padEnd(12)} ${String(filas.length).padStart(4)}  ${String(core).padStart(4)}  ` +
                `${String(sup).padStart(5)}  ${String(t.length).padStart(5)}  ${huella}`);
    total += filas.length;
  }
  console.log('');
  console.log(`total que saldría: ${total}`);
  process.exit(0);
}

// --- SQL --------------------------------------------------------------
const out = [];

out.push('-- 1 · Las ocupaciones. `title_es` va NULL a propósito: las 21 existentes lo tienen');
out.push('--     null (0 de 21), y traducir solo unas pocas sería una inconsistencia nueva.');
out.push('insert into catalog.occupation (source, source_code, title_en, title_es, description)');
out.push('select \'onet\', v.soc, v.title, null, v.descripcion');
out.push('from (values');
const filasOcc = socs.map((soc) => {
  const o = ocupaciones.find((r) => r[0] === soc);
  if (!o) { console.error(`El SOC ${soc} no está en occupation_data.csv.`); process.exit(2); }
  validar(o[1], `ocupación ${soc} (título)`);
  validar(o[2], `ocupación ${soc} (descripción)`);
  return `  (${lit(soc)}, ${lit(o[1])}, ${lit(o[2])})`;
});
out.push(filasOcc.join(',\n'));
out.push(') as v(soc, title, descripcion)');
out.push('where not exists (');
out.push('  select 1 from catalog.occupation o where o.source = \'onet\' and o.source_code = v.soc);');
out.push('');

const lista = socs.map((s) => lit(s)).join(', ');
out.push('-- 2 · Precondición: las ocupaciones existen antes de colgarles tareas.');
out.push('do $$');
out.push('declare n int;');
out.push('begin');
out.push(`  select count(*) into n from catalog.occupation`);
out.push(`   where source = 'onet' and source_code in (${lista});`);
out.push(`  if n <> ${socs.length} then`);
out.push(`    raise exception 'Ocupaciones O*NET esperadas: % de ${socs.length}', n;`);
out.push('  end if;');
out.push('end $$;');
out.push('');

out.push('-- 3 · Las tareas. Se emiten TODAS las del criterio, no solo las que faltan: el');
out.push('--     `not exists` deja fuera las ya presentes, así que el estado final es siempre');
out.push('--     "las del criterio existen", sea cual sea el estado inicial. Reejecutar: 0 filas.');
out.push('--');
out.push('--     `task_code` NO va en la lista de columnas: lo pone el default de la tabla');
out.push('--     (la secuencia). `process_id` y `primary_pattern` se quedan en null a');
out.push('--     propósito: la clasificación se hace a mano desde el panel (pestaña Ficha).');
out.push('insert into catalog.task (source, source_code, statement, language, occupation_id, status, version)');
out.push('select \'onet\', v.soc || \'.\' || v.task_id, v.enunciado, \'en\', o.id, \'draft\', 1');
out.push('from (values');
const filasTarea = [];
for (const soc of socs) {
  const filas = [...porSoc.get(soc)].sort((a, b) => Number(a[2]) - Number(b[2]));
  for (const r of filas) {
    validar(r[3], `tarea ${soc}.${r[2]}`);
    filasTarea.push(`  (${lit(soc)}, ${lit(r[2])}, ${lit(r[3])})`);
  }
}
out.push(filasTarea.join(',\n'));
out.push(') as v(soc, task_id, enunciado)');
out.push('join catalog.occupation o on o.source = \'onet\' and o.source_code = v.soc');
out.push('where not exists (');
out.push('  select 1 from catalog.task t');
out.push('   where t.source = \'onet\' and t.source_code = v.soc || \'.\' || v.task_id);');
out.push('');

out.push('-- 4 · Asertos. Esta es la seguridad real, no el escapado: cualquier fallo silencioso');
out.push('--     (doble inserción, tareas descartadas por el join, source_code mal formado)');
out.push('--     se convierte en rollback en vez de en un dato raro que nadie ve.');
out.push('--     Los `raise notice` NO se ven por apply_migration: todo va como exception.');
out.push('do $$');
out.push('declare n_total int; n_sin_occ int; n_idioma int;');
out.push('begin');
out.push('  select count(*) into n_total from catalog.task');
out.push(`   where source = 'onet' and left(source_code, 10) in (${lista});`);
out.push(`  if n_total <> ${filasTarea.length + 0} then`);
out.push(`    raise exception 'Tareas de estos SOC: % (esperadas ${filasTarea.length})', n_total;`);
out.push('  end if;');
out.push('');
out.push('  select count(*) into n_sin_occ from catalog.task');
out.push(`   where source = 'onet' and left(source_code, 10) in (${lista}) and occupation_id is null;`);
out.push('  if n_sin_occ <> 0 then raise exception \'% tareas sin occupation_id\', n_sin_occ; end if;');
out.push('');
out.push('  select count(*) into n_idioma from catalog.task');
out.push(`   where source = 'onet' and left(source_code, 10) in (${lista}) and language <> 'en';`);
out.push('  if n_idioma <> 0 then raise exception \'% tareas con language distinto de en\', n_idioma; end if;');
out.push('end $$;');

console.log(out.join('\n'));
