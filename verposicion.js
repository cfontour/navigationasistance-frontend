// verposicion.js
$(document).ready(function () {

    // Inicializar DataTable
    let tabla = $('#navegantes').DataTable({
        language: {
            url: "vendor/datatables/es-ES.json" // si tenés traducción al español
        }
    });

    // Llamar al backend
    fetch("https://navigationasistance-backend-1.onrender.com/nadadorposicion/listar")
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error en la respuesta: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            tabla.clear();

            data.forEach((item, index) => {
                tabla.row.add([
                    index + 1, // ID de fila generado en el frontend
                    item.usuarioid || "",
                    item.nadadorlat || "",
                    item.nadadorlng || "",
                    formatearFecha(item.fechaUltimaActualizacion),
                    item.emergency ? "🚨" : "✔️"
                ]);
            });

            tabla.draw();
        })
        .catch(error => {
            console.error("Error cargando datos:", error);
        });

    // Función para mostrar fecha legible
    function formatearFecha(fechaIso) {
        if (!fechaIso) return "";
        const fecha = new Date(fechaIso);
        return fecha.toLocaleString("es-UY", {
            timeZone: "America/Montevideo"
        });
    }

});
