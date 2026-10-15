// verposicion.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
    columnDefs: [
      { targets: -1, orderable: false }, // Acciones
      { targets: -2, orderable: false }  // SOS
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        tabla.clear();

        data.forEach((item, idx) => {
          const id = idx + 1;
          const usuario = item.usuarioid ?? "";
          const lat = item.nadadorlat ?? "";
          const lng = item.nadadorlng ?? "";
          const fecha = formatearFecha(item.fechaUltimaActualizacion);
          const bateria = `${item.bateria ?? 0}%`;
          const senal = iconoSenal(item.rssi);
          const emergenciaIcono = item.emergency ? "🚨" : "";

          // Botón SOS: rojo (true) / amarillo (false)
          const btnSOS = `
            <button class="btn btn-sm ${item.emergency ? 'btn-danger' : 'btn-warning'} sos-btn"
                    data-usuario="${usuario}"
                    data-estado="${item.emergency}"
                    title="${item.emergency ? 'Apagar SOS' : 'Encender SOS'}">
              <i class="fas fa-exclamation-triangle"></i>
            </button>`;

          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-usuario="${usuario}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>`;

          tabla.row.add([id, usuario, lat, lng, fecha, bateria, senal, emergenciaIcono, btnSOS, btnEliminar]);
        });

        tabla.draw();
      })
      .catch(err => console.error("Error cargando datos:", err));
  }

  // Toggle SOS con body { emergency: true/false }
  $('#navegantes').on('click', '.sos-btn', function () {
    const usuarioId = $(this).data('usuario');
    const estadoActual = $(this).data('estado'); // true o false
    const nuevoEstado = !estadoActual; // alternar

    fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/emergency/${encodeURIComponent(usuarioId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emergency: nuevoEstado })
    })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(() => cargarDatos())
    .catch(err => {
      console.error("Error cambiando estado de emergencia:", err);
      alert("No se pudo cambiar el estado de emergencia.");
    });
  });

  // Eliminar
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const usuarioId = $(this).data('usuario');
    if (!usuarioId) return;

    if (confirm(`¿Seguro que querés eliminar al usuario ${usuarioId}?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/eliminar/${encodeURIComponent(usuarioId)}`, {
        method: 'POST'
      })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(() => cargarDatos())
      .catch(err => {
        console.error("Error eliminando usuario:", err);
        alert("No se pudo eliminar. Revisá el backend.");
      });
    }
  });

  function formatearFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  }

  // Ícono estilo wifi según RSSI (dBm). Niveles: 4 ≥ -70 · 3 ≥ -85 · 2 ≥ -100 · 1 ≥ -115 · 0 menos
  function iconoSenal(rssi) {
    const sinDato = (rssi === null || rssi === undefined || rssi >= 0);

    let nivel = 0;
    if (!sinDato) {
      if (rssi >= -70) nivel = 4;
      else if (rssi >= -85) nivel = 3;
      else if (rssi >= -100) nivel = 2;
      else if (rssi >= -115) nivel = 1;
    }

    const colorActivo = nivel >= 3 ? "#639922" : "#BA7517";
    const colorInactivo = "#B4B2A9";
    const c = n => (nivel >= n ? colorActivo : colorInactivo);
    const o = n => (nivel >= n ? 1 : 0.45);
    const titulo = sinDato ? "Sin dato de señal" : `RSSI ${rssi} dBm`;

    return `
      <span title="${titulo}">
        <svg width="30" height="20" viewBox="25 0 150 100" style="vertical-align: middle;">
          <path d="M100 96 L83 79 A24 24 0 0 1 117 79 Z" fill="${c(1)}" opacity="${o(1)}"/>
          <path d="M68.9 64.9 A44 44 0 0 1 131.1 64.9" fill="none" stroke="${c(2)}" stroke-width="12" stroke-linecap="round" opacity="${o(2)}"/>
          <path d="M53.3 49.3 A66 66 0 0 1 146.7 49.3" fill="none" stroke="${c(3)}" stroke-width="12" stroke-linecap="round" opacity="${o(3)}"/>
          <path d="M37.8 33.8 A88 88 0 0 1 162.2 33.8" fill="none" stroke="${c(4)}" stroke-width="12" stroke-linecap="round" opacity="${o(4)}"/>
        </svg>
        ${sinDato ? "—" : `${rssi} dBm`}
      </span>`;
  }
});