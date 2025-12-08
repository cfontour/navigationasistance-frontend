// vergrupos.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
    columnDefs: [
      { targets: -1, orderable: false } // columna acciones
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listar")
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        tabla.clear();

        data.forEach((item, idx) => {

          const id = idx + 1;
          const usuarioId = item.id ?? "";
          const nombre = item.nombre ?? "";
          const apellido = item.apellido ?? "";
          const grupo = item.grupoid ?? "-";

          const selectGrupo = `
            <select class="form-control form-control-sm grupo-select" data-usuario="${usuarioId}">
              <option value="" disabled selected>Seleccionar...</option>
              <option value="cavent">cavent</option>
              <option value="otsudan">otsudan</option>
              <option value="regatas">regatas</option>
            </select>
          `;

          const btnAplicar = `
            <button class="btn btn-sm btn-primary aplicar-grupo-btn"
                    data-usuario="${usuarioId}">
              Aplicar
            </button>
          `;

          tabla.row.add([
            id,
            usuarioId,
            nombre,
            apellido,
            grupo,
            selectGrupo + btnAplicar
          ]);
        });

        tabla.draw();
      })
      .catch(err => console.error("Error cargando datos:", err));
  }

  // Evento aplicar cambio de grupo
  $('#navegantes').on('click', '.aplicar-grupo-btn', function () {
    const usuarioId = $(this).data('usuario');
    const select = $(`select[data-usuario="${usuarioId}"]`);
    const nuevoGrupo = select.val();

    if (!nuevoGrupo) {
      alert("Seleccioná un grupo antes de aplicar.");
      return;
    }

    fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/${encodeURIComponent(usuarioId)}/grupo`, {
      method: 'PUT',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grupoid: nuevoGrupo })
    })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then(() => {
      alert("Grupo actualizado correctamente.");
      cargarDatos();
    })
    .catch(err => {
      console.error("Error actualizando grupo:", err);
      alert("No se pudo actualizar el grupo.");
    });
  });
});
