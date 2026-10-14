/* vrutal-block {
  "block": "Calcula · ventana semanal",
  "kind": "normalize",
  "variant": {},
  "consumes": [],
  "produces": "ReportWindow@1",
  "inputs": { "runDate": "{{trigger.timestamp}}" }
} */
// Paso Code de Activepieces. Calcula la semana anterior completa (lunes 00:00 a lunes 00:00, hora de Madrid).
// HubSpot no entiende fechas relativas: hay que darle los instantes exactos, y por eso este paso va antes.
// Fail-closed: si la fecha de entrada no es válida, falla y no se consulta nada.

const TZ = 'Europe/Madrid';
const DAY = 86_400_000;

// Día de calendario de un instante, visto en Madrid, como medianoche UTC de ese día.
const calendarDay = (ms: number): number => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(ms)
    .filter((p) => p.type !== 'literal')
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
};

// Desfase de Madrid respecto a UTC, en minutos, en un instante dado.
const offsetMinutes = (ms: number): number => {
  const label = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
    .formatToParts(ms)
    .find((p) => p.type === 'timeZoneName')?.value ?? '';
  const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(label);
  if (!m) throw new Error('No se pudo calcular el desfase horario de Madrid');
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
};

// Instante en que empieza ese día de calendario en Madrid. Se mide a mediodía: los cambios de hora son de madrugada del domingo.
const midnightMadrid = (day: number): number => day - offsetMinutes(day + 12 * 3_600_000) * 60_000;

const isoDay = (day: number) => new Date(day).toISOString().slice(0, 10);

export const code = async (inputs: { runDate?: string }) => {
  const run = inputs.runDate ? new Date(inputs.runDate) : new Date();
  if (Number.isNaN(run.getTime())) throw new Error('La fecha de ejecución no es válida');

  const today = calendarDay(run.getTime());
  const sinceMonday = (new Date(today).getUTCDay() + 6) % 7; // lunes = 0
  const thisMonday = today - sinceMonday * DAY;
  const start = thisMonday - 7 * DAY;

  return {
    period_start: isoDay(start), // lunes de la semana anterior
    period_end: isoDay(thisMonday - DAY), // domingo, inclusivo
    start_ms: midnightMadrid(start), // inicio (incluido) para la consulta
    end_ms: midnightMadrid(thisMonday), // fin (excluido) para la consulta
  };
};
