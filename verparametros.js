// verparametros.js
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
    fetch("https://navigationasistance-backend-1.onrender.com/parametros/listar")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        tabla.clear();

        data.forEach((item) => {
          const clave = item.clave ?? "";
          const valor = item.valor ?? "";

          const btnActualizar = `
            <button class="btn btn-sm btn-warning actualizar-btn"
                    data-clave="${clave}"
                    data-valor="${valor}"
                    title="Editar valor">
              <i class="fas fa-edit"></i>
            </button>`;

          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-clave="${clave}"
                    title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>`;

          tabla.row.add([clave, valor, btnActualizar, btnEliminar]);
        });

        tabla.draw();
      })
      .catch(err => console.error("Error cargando datos:", err));
  }

  // 👉 AGREGAR NUEVO PARÁMETRO
  $('#form-nuevo-parametro').on('submit', function (e) {
    e.preventDefault();

    const clave = $('#nueva-clave').val().trim();
    const valor = $('#nuevo-valor').val().trim();

    if (!clave) {
      alert("La clave no puede estar vacía.");
      return;
    }

    // Ajustá este body si tu backend espera otra estructura
    const payload = { clave, valor };

    fetch("https://navigationasistance-backend-1.onrender.com/parametros/agregar", {
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
        $('#nuevo-valor').val('');
        cargarDatos();
      })
      .catch(err => {
        console.error("Error agregando parámetro:", err);
        alert("No se pudo agregar el parámetro. Revisa el backend.");
      });
  });

  // ✏️ ACTUALIZAR VALOR DE UN PARÁMETRO EXISTENTE
  $('#navegantes').on('click', '.actualizar-btn', function () {
    const clave = $(this).data('clave');
    const valorActual = $(this).data('valor') ?? "";

    if (!clave) return;

    const nuevoValor = prompt(`Nuevo valor para la clave "${clave}":`, valorActual);

    // Canceló o dejó igual
    if (nuevoValor === null) return;

    const valorTrim = String(nuevoValor).trim();

    // Si querés permitir vacío, sacá este if
    if (valorTrim.length === 0) {
      alert("El valor no puede estar vacío.");
      return;
    }

    const payload = { clave, valor: valorTrim };

    fetch(`https://navigationasistance-backend-1.onrender.com/parametros/actualizar/${encodeURIComponent(clave)}`, {
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
        console.error("Error actualizando clave:", err);
        alert("No se pudo actualizar la clave. Revisa el backend.");
      });
  });

  // 🗑️ ELIMINAR PARÁMETRO
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const clave = $(this).data('clave');
    if (!clave) return;

    if (confirm(`¿Seguro que querés eliminar la clave "${clave}"?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/parametros/eliminar/${encodeURIComponent(clave)}`, {
        method: 'POST'
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(() => cargarDatos())
        .catch(err => {
          console.error("Error eliminando clave:", err);
          alert("No se pudo eliminar la clave. Revisa el backend.");
        });
    }
  });

});
