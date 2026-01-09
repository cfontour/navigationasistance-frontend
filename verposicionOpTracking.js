// verposicion.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/en-GB.json" },
    columnDefs: [
      { targets: -1, orderable: false }, // Acciones
      { targets: -2, orderable: false }  // SOS
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listarActivosPorGrupo/otsudan")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        tabla.clear();

        data.forEach((item, idx) => {
          const id = idx + 1;
          const usuario = item.usuarioid ?? "";
          const lat = item.nadadorlat ?? "";
          const lng = item.nadadorlng ?? "";
          const fecha = formatearFecha(item.fechaUltimaActualizacion);
          const emergenciaIcono = item.emergency ? "🚨" : "";

          // Botón SOS: rojo (true) / amarillo (false)
          const btnSOS = `
            <button class="btn btn-sm ${item.emergency ? 'btn-danger' : 'btn-warning'} sos-btn"
                    data-usuario="${usuario}"
                    data-estado="${item.emergency}"
                    title="${item.emergency ? 'Disable SOS' : 'Enable SOS'}">
              <i class="fas fa-exclamation-triangle"></i>
            </button>`;

          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-usuario="${usuario}" title="Remove">
              <i class="fas fa-trash"></i>
            </button>`;

          tabla.row.add([id, usuario, lat, lng, fecha, emergenciaIcono, btnSOS, btnEliminar]);
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
      alert("Could not toggle SOS state.");
    });
  });

  // Eliminar
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const usuarioId = $(this).data('usuario');
    if (!usuarioId) return;

    if (confirm(`¿Remove user ${usuarioId}?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/eliminar/${encodeURIComponent(usuarioId)}`, {
        method: 'POST'
      })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(() => cargarDatos())
      .catch(err => {
        console.error("Error eliminando usuario:", err);
        alert("Could not revome user. Check backend.");
      });
    }
  });

  function formatearFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleString("es-UY", { timeZone: "America/Montevideo" });
  }
});
