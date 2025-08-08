// js/usuarios.js
$(document).ready(function () {
  // DataTable: español vía CDN y última columna sin orden
  const tabla = $('#navegantes').DataTable({
    language: {
      url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"
    },
    columnDefs: [
      { targets: -1, orderable: false } // "Acciones"
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        tabla.clear();

        data.forEach((item, idx) => {
          const id = idx + 1;
          const usuario = item.usuarioid ?? "";
          const lat = item.nadadorlat ?? "";
          const lng = item.nadadorlng ?? "";
          const fecha = formatearFecha(item.fechaUltimaActualizacion);
          const emergencia = item.emergency === true ? "🚨" : ""; // nada si es false
          const acciones =
            `<button class="btn btn-sm btn-danger eliminar-btn"
                     data-usuario="${usuario}" title="Eliminar">
               <i class="fas fa-trash"></i>
             </button>`;

          tabla.row.add([id, usuario, lat, lng, fecha, emergencia, acciones]);
        });

        tabla.draw();
      })
      .catch(err => {
        console.error("Error cargando datos:", err);
      });
  }

  // Borrar por usuarioId
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const usuarioId = $(this).data('usuario');
    if (!usuarioId) return;

    if (confirm(`¿Seguro que querés eliminar al usuario ${usuarioId}?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/eliminar/${usuarioId}`, {
        method: 'DELETE'
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          cargarDatos();
        })
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
