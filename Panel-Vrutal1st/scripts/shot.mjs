// Capturas del banco de pruebas del layout (preview.html).
//
// Sirve para mirar el layout del catálogo sin sesión ni Supabase, en vez de ajustar el CSS
// a ciegas. Necesita el servidor de desarrollo ya levantado.
//
// Uso:
//   npm run dev -- --port 5199
//   node scripts/shot.mjs 5199 [carpeta-de-salida]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const puerto = Number(process.argv[2] ?? 5173);
const outDir = process.argv[3] ?? 'shots';

const VISTAS = [
  { nombre: 'biblioteca', p: 'biblioteca', ancho: 1440, alto: 900 },
  { nombre: 'importaciones', p: 'importaciones', ancho: 1440, alto: 900 },
  { nombre: 'biblioteca-1280', p: 'biblioteca', ancho: 1280, alto: 800 },
  { nombre: 'biblioteca-movil', p: 'biblioteca', ancho: 430, alto: 932 },
];

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();

for (const v of VISTAS) {
  const page = await browser.newPage({ viewport: { width: v.ancho, height: v.alto } });
  const fallos = [];
  page.on('console', (m) => m.type() === 'error' && fallos.push(m.text()));
  page.on('pageerror', (e) => fallos.push(String(e)));

  await page.goto(`http://localhost:${puerto}/preview.html?p=${v.p}`, { waitUntil: 'load' });
  await page.waitForTimeout(300);

  const destino = path.join(outDir, `${v.nombre}.png`);
  await page.screenshot({ path: destino });
  console.log(`${destino}  ${v.ancho}x${v.alto}${fallos.length ? `  ERRORES: ${fallos.join(' | ')}` : ''}`);
  await page.close();
}

await browser.close();
