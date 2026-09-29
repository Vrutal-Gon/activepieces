// Fase 3: se alimentará del latido de los VPS (LAB08 cap. 13), que aún no existe.
// No se muestran datos inventados.
export function Dashboard() {
  return (
    <section>
      <header className="page-header">
        <span className="eyebrow">Operación</span>
        <h1 className="page-header__title">Estado de la flota</h1>
      </header>
      <div className="empty-state">
        <h2 className="empty-state__title">Pendiente de la fuente de datos</h2>
        <p className="empty-state__body">
          Este panel mostrará VPS sin latido, flujos con error, aprobaciones bloqueadas más de 24 h, tickets
          abiertos y consumo de modelos. Necesita que cada VPS envíe su latido al plano de control; cuando exista,
          se conecta aquí.
        </p>
      </div>
    </section>
  );
}
