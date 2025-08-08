// verposicion.js
$(document).ready(function () {
  // DataTable en español; desactivar orden en las 2 últimas (SOS y Acciones)
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

          // Columna "Emergencia": ícono (solo si está activo)
          const emergenciaIcono = item.emergency === true ? "🚨" : "";

          // Botón SOS: rojo (activo) / amarillo (apagado)
          const btnSOS = `
            <button class="btn btn-sm ${item.emergency ? 'btn-danger' : 'btn-warning'} sos-btn"
                    data-usuario="${usuario}"
                    title="${item.emergency ? 'Apagar SOS' : 'Encender SOS'}">
              <i class="fas fa-exclamation-triangle"></i>
            </button>`;

          // Botón Eliminar
          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-usuario="${usuario}" title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>`;

          // Agregar fila
          tabla.row.add([id, usuario, lat, lng, fecha, emergenciaIcono, btnSOS, btnEliminar]);
        });

        tabla.draw();
      })
      .catch(err => console.error("Error cargando datos:", err));
  }

  // Toggle SOS: POST /emergency/{id}
  $('#navegantes').on('click', '.sos-btn', function () {
    const usuarioId = $(this).data('usuario');
    if (!usuarioId) return;

    fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/emergency/${encodeURIComponent(usuarioId)}`, {
      method: 'POST'
    })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(() => cargarDatos())
    .catch(err => {
      console.error("Error cambiando estado de emergencia:", err);
      alert("No se pudo cambiar el estado de emergencia.");
    });
  });

  // Eliminar: POST /eliminar/{id}
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
});
