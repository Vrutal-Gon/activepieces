// Alta de un cliente: los 7 pasos de LAB12 cap. 3 bis, en voz Vrutal (LAB08 Anexo B).

export const ONBOARDING_STEPS: Record<string, { title: string; line: string; evidence: string }> = {
  machine: {
    title: 'Máquina',
    line: 'El servidor existe y está registrado aquí.',
    evidence: 'Proveedor, host o id del servidor',
  },
  fleet_template: {
    title: 'Plantilla',
    line: 'La instancia corre con la plantilla de flota, versión anotada.',
    evidence: 'Versión de la plantilla o commit',
  },
  secrets: {
    title: 'Secretos',
    line: 'Los secretos de la instancia están en su .env. No son las claves del cliente.',
    evidence: 'Quién y cuándo los cargó (nunca el secreto)',
  },
  database: {
    title: 'Base de datos',
    line: 'El proyecto Supabase del cliente existe y tiene su esquema.',
    evidence: 'Ref del proyecto y versión del esquema',
  },
  monitoring: {
    title: 'Monitorización',
    line: 'El latido de la instancia llega a Vrutal1st.',
    evidence: 'Hora del primer latido',
  },
  backups: {
    title: 'Backups',
    line: 'Hay copias configuradas y una restauración probada.',
    evidence: 'Dónde se guardan y fecha de la prueba',
  },
  vps_entry: {
    title: 'Entrada',
    line: 'El cliente tiene su URL y su primer acceso de Admin.',
    evidence: 'URL y a quién se entregó el acceso',
  },
};
