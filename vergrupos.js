// vergrupos.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
    columnDefs: [
      { targets: -1, orderable: false }
    ]
  });

  let gruposDisponibles = [];

  inicializar();

  async function inicializar() {
    await cargarGrupos();
    await cargarDatos();
  }

  async function cargarGrupos() {
    try {
      const response = await fetch("https://navigationasistance-backend-1.onrender.com/grupos/listar");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      gruposDisponibles = data || [];

    } catch (err) {
      console.error("Error cargando grupos:", err);
      gruposDisponibles = [];
    }
  }

  function armarOptionsGrupo(grupoActual) {
    let options = `<option value="" disabled selected>Seleccionar...</option>`;

    gruposDisponibles.forEach(grupo => {
      const valorGrupo = grupo.id ?? grupo.grupoid ?? grupo.nombre ?? grupo.descripcion ?? "";
      const textoGrupo = grupo.nombre ?? grupo.descripcion ?? grupo.grupoid ?? grupo.id ?? "";

      options += `<option value="${valorGrupo}">${textoGrupo}</option>`;
    });

    return options;
  }

  async function cargarDatos() {
    try {
      const response = await fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listar");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      tabla.clear();

      data.forEach((item, idx) => {
        const id = idx + 1;
        const usuarioId = item.id ?? "";
        const nombre = item.nombre ?? "";
        const apellido = item.apellido ?? "";
        const grupo = item.grupoid ?? "-";

        const selectGrupo = `
          <select class="form-control form-control-sm grupo-select" data-usuario="${usuarioId}">
            ${armarOptionsGrupo(grupo)}
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

    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  }

  $('#navegantes').on('click', '.aplicar-grupo-btn', function () {
    const usuarioId = $(this).data('usuario');
    const select = $(`select[data-usuario="${usuarioId}"]`);
    const nuevoGrupo = select.val();

    if (!nuevoGrupo) {
      alert("Seleccioná un grupo antes de aplicar.");
      return;
    }

    fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/usuarios/${encodeURIComponent(usuarioId)}/grupo`, {
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