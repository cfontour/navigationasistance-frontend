// ABMGrupos.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: { url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json" },
    columnDefs: [
      { targets: -1, orderable: false }, // Eliminar
      { targets: -2, orderable: false }  // Actualizar
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/grupos/listar")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        tabla.clear();

        data.forEach((item) => {
          const clave = item.grupoid ?? "";
          const nombre = item.gruponombre ?? "";
          const descripcion = item.grupodescripcion ?? "";

          const btnActualizar = `
            <button class="btn btn-sm btn-warning actualizar-btn"
                    data-clave="${clave}"
                    data-nombre="${nombre}"
                    data-descripcion="${descripcion}"
                    title="Editar valor">
              <i class="fas fa-edit"></i>
            </button>`;

          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-clave="${clave}"
                    title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>`;

          tabla.row.add([clave, nombre, descripcion, btnActualizar, btnEliminar]);
        });

        tabla.draw();
      })
      .catch(err => console.error("Error cargando datos:", err));
  }

  // 👉 AGREGAR NUEVO GRUPO
  $('#form-nuevo-grupo').on('submit', function (e) {
    e.preventDefault();

    const clave = $('#nueva-clave').val().trim();
    const nombre = $('#nuevo-nombre').val().trim();
    const descripcion = $('#nueva-descripcion').val().trim();

    if (!clave) {
      alert("La clave no puede estar vacía.");
      return;
    }

    // Ajustá este body si tu backend espera otra estructura
    const payload = { clave, nombre, descripcion };

    fetch("https://navigationasistance-backend-1.onrender.com/grupos/agregar", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(() => {
        $('#nueva-clave').val('');
        $('#nuevo-nombre').val('');
        $('#nueva-descripcion').val('');
        cargarDatos();
      })
      .catch(err => {
        console.error("Error agregando grupo:", err);
        alert("No se pudo agregar el grupo. Revisa el backend.");
      });
  });

  // ✏️ ACTUALIZAR VALOR DE UN GRUPO EXISTENTE
  $('#navegantes').on('click', '.actualizar-btn', function () {
    const clave = $(this).data('clave');
    const nombreActual = $(this).data('nombre') ?? "";
    const descripcionActual = $(this).data('descripcion') ?? "";

    if (!clave) return;

    const nuevoNombre = prompt(`Nuevo nombre para el grupo "${clave}":`, nombreActual);
    const nuevaDescripcion = prompt(`Nueva descripcion para el grupo "${clave}":`, descripcionActual);

    // Canceló o dejó igual
    if (nuevoNombre === null) return;

    const nombreTrim = String(nuevoNombre).trim();

    // Canceló o dejó igual
        if (nuevaDescripcion === null) return;

        const descripcionTrim = String(nuevaDescripcion).trim();

    // Si querés permitir vacío, sacá este if
    if (nombreTrim.length === 0) {
      alert("El nombre no puede estar vacío.");
      return;
    }

    if (descripcionTrim.length === 0) {
      alert("La descripción no puede estar vacía.");
      return;
    }

    const payload = { clave, nombre: nombreTrim, descripcion: descripcionTrim };

    fetch(`https://navigationasistance-backend-1.onrender.com/grupos/actualizar/${encodeURIComponent(clave)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.text();
      })
      .then(() => cargarDatos())
      .catch(err => {
        console.error("Error actualizando grupo:", err);
        alert("No se pudo actualizar el grupo. Revisa el backend.");
      });
  });

  // 🗑️ ELIMINAR GRUPO
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const clave = $(this).data('clave');
    if (!clave) return;

    if (confirm(`¿Seguro que querés eliminar el grupo "${clave}"?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/grupos/eliminar/${encodeURIComponent(clave)}`, {
        method: 'POST'
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(() => cargarDatos())
        .catch(err => {
          console.error("Error eliminando grupo:", err);
          alert("No se pudo eliminar el grupo. Revisa el backend.");
        });
    }
  });

});
