// js/usuarios.js
$(document).ready(function () {

    // Inicializar DataTable con columna extra para botón de eliminar
    let tabla = $('#navegantes').DataTable({
        language: {
            url: "vendor/datatables/es-ES.json"
        },
        columns: [
            { title: "ID" },
            { title: "Usuario" },
            { title: "Latitud" },
            { title: "Longitud" },
            { title: "Fecha" },
            { title: "Emergencia" },
            { title: "Acciones", orderable: false }
        ]
    });

    cargarDatos();

    function cargarDatos() {
        fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
            .then(response => {
                if (!response.ok) throw new Error(`Error en la respuesta: ${response.status}`);
                return response.json();
            })
            .then(data => {
                tabla.clear();

                data.forEach((item, index) => {
                    tabla.row.add([
                        index + 1,
                        item.usuarioid || "",
                        item.nadadorlat || "",
                        item.nadadorlng || "",
                        formatearFecha(item.fechaUltimaActualizacion),
                        item.emergency ? "🚨" : "", // ahora solo se ve si es true
                        `<button class="btn btn-danger btn-sm eliminar-btn" data-usuario="${item.usuarioid}"><i class="fas fa-trash"></i></button>`
                    ]);
                });

                tabla.draw();
            })
            .catch(error => console.error("Error cargando datos:", error));
    }

    // Eliminar registro
    $('#navegantes').on('click', '.eliminar-btn', function () {
        let usuarioId = $(this).data("usuario");

        if (confirm(`¿Seguro que quieres eliminar al usuario ${usuarioId}?`)) {
            fetch(`https://navigationasistance-backend-1.onrender.com/nadadorposicion/eliminar/${usuarioId}`, {
                method: 'DELETE'
            })
                .then(response => {
                    if (!response.ok) throw new Error(`Error al eliminar: ${response.status}`);
                    alert("Usuario eliminado correctamente");
                    cargarDatos();
                })
                .catch(error => console.error("Error eliminando usuario:", error));
        }
    });

    function formatearFecha(fechaIso) {
        if (!fechaIso) return "";
        const fecha = new Date(fechaIso);
        return fecha.toLocaleString("es-UY", { timeZone: "America/Montevideo" });
    }
});
