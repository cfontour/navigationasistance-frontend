// verposicion.js
$(document).ready(function () {
  const tabla = $('#navegantes').DataTable({
    language: {
      url: "https://cdn.datatables.net/plug-ins/1.13.6/i18n/es-ES.json"
    },
    columnDefs: [
      { targets: -1, orderable: false } // Acciones no ordenable
    ]
  });

  cargarDatos();

  function cargarDatos() {
    fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listarGrupo/otsudan")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        tabla.clear();

        // Para cada registro del grupo, buscar nombre y apellido del usuario
        const peticionesUsuarios = data
          .map(item => {
            const usuarioId = item.usuarioId;
            if (!usuarioId) return null;

            return fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${encodeURIComponent(usuarioId)}`)
              .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status} al obtener usuarioId=${usuarioId}`);
                return r.json();
              })
              .then(usuario => ({
                usuarioId: usuarioId,
                nombre: usuario.nombre ?? "",
                apellido: usuario.apellido ?? ""
              }))
              .catch(err => {
                console.error("Error obteniendo datos de usuario:", err);
                // En caso de error, al menos mostramos el ID
                return {
                  usuarioId: usuarioId,
                  nombre: "",
                  apellido: ""
                };
              });
          })
          .filter(Boolean); // quita nulls si hubiera items sin usuarioid

        return Promise.all(peticionesUsuarios);
      })
      .then(filas => {
        filas.forEach(fila => {
          const btnEliminar = `
            <button class="btn btn-sm btn-danger eliminar-btn"
                    data-usuario="${fila.usuarioId}"
                    title="Eliminar">
              <i class="fas fa-trash"></i>
            </button>`;

          tabla.row.add([
            fila.usuarioId,
            fila.nombre,
            fila.apellido,
            btnEliminar
          ]);
        });

        tabla.draw();
      })
      .catch(err => {
        console.error("Error cargando datos:", err);
        alert("No se pudieron cargar los navegantes. Revisá el backend.");
      });
  }

  // Eliminar: pega a /usuariocapuntoscontrol/eliminarUsuariocaPuntos{id}
  $('#navegantes').on('click', '.eliminar-btn', function () {
    const usuarioId = $(this).data('usuario');
    if (!usuarioId) return;

    if (confirm(`¿Seguro que querés eliminar al usuario ${usuarioId}?`)) {
      fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/eliminarUsuariocaPuntos${encodeURIComponent(usuarioId)}`, {
        method: 'POST'
      })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(() => {
          cargarDatos();
        })
        .catch(err => {
          console.error("Error eliminando usuario:", err);
          alert("No se pudo eliminar. Revisá el backend.");
        });
    }
  });
});
