// 🎯 MODIFICACIONES PRINCIPALES

// 1. Variable global para controlar qué usuario tiene la traza activa
let usuarioTrazaActiva = null;

// 2. Función modificada para generar contenido del popup CON botón de traza
function generarContenidoPopupConTraza(usuarioid, datosUsuario = {}) {
  const historial = historialPuntos.get(usuarioid) || [];
  const listaHtml = historial.map(p =>
    `<li>${p.etiqueta} <small>${new Date(p.fechaHora).toLocaleTimeString()}</small></li>`
  ).join("");

  // Determinar el texto del botón según el estado actual
  const esTrazaActiva = usuarioTrazaActiva === usuarioid;
  const textoBoton = esTrazaActiva ? "🔴 Desactivar Traza" : "🟢 Activar Traza";
  const colorBoton = esTrazaActiva ? "#e74c3c" : "#27ae60";

  // Obtener nombre del usuario si está disponible
  const nombreCompleto = datosUsuario.nombre ?
    `${datosUsuario.nombre} ${datosUsuario.apellido || ""}` :
    `Usuario ${usuarioid}`;

  return `
    <div style="min-width: 200px;">
      <strong>📍 ${nombreCompleto}</strong><br/>
      <small>ID: ${usuarioid}</small><br/><br/>

      <div style="margin: 10px 0;">
        <button
          onclick="toggleTrazaDesdePopup('${usuarioid}')"
          style="
            background: ${colorBoton};
            color: white;
            border: none;
            padding: 8px 12px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            width: 100%;
            margin-bottom: 10px;
          "
        >
          ${textoBoton}
        </button>
      </div>

      <strong>🏁 Puntos de control:</strong><br/>
      <ul style="margin: 5px 0; padding-left: 20px;">
        ${listaHtml.length > 0 ? listaHtml : '<li><em>Sin puntos registrados</em></li>'}
      </ul>
    </div>
  `;
}

// 3. Función GLOBAL para manejar toggle de traza desde el popup
window.toggleTrazaDesdePopup = function(usuarioid) {
  console.log(`🎯 Toggle traza para usuario: ${usuarioid}`);

  if (usuarioTrazaActiva === usuarioid) {
    // Desactivar traza actual
    borrarTraza();
    usuarioTrazaActiva = null;
    console.log("❌ Traza desactivada");
  } else {
    // Activar traza para este usuario
    usuarioTrazaActiva = usuarioid;

    // Actualizar selector de usuario para que coincida
    const selector = document.getElementById("selector-usuario");
    if (selector) {
      selector.value = usuarioid;
    }

    // Trazar ruta
    trazarRutaUsuarioEspecifico(usuarioid);
    console.log(`✅ Traza activada para usuario: ${usuarioid}`);
  }

  // Actualizar todos los popups para reflejar el nuevo estado
  actualizarTodosLosPopups();
};

// 4. Función específica para trazar ruta de un usuario específico
async function trazarRutaUsuarioEspecifico(usuarioId) {
  mostrarTraza = true;

  const hoy = new Date().toISOString().split("T")[0];

  try {
    // 🔹 Obtener último recorrido UUID
    const resUuid = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ultimorecorrido/${usuarioId}/${hoy}`);
    const uuidList = await resUuid.json();

    if (!uuidList || uuidList.length === 0) {
      console.log("❌ No hay recorridos registrados hoy para el usuario: " + usuarioId);
      alert("❌ No hay recorridos registrados hoy para este usuario.");
      return;
    }

    const ultimaRuta = uuidList[0];

    // 🔹 Obtener puntos del recorrido
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorhistoricorutas/ruta/${ultimaRuta}`);
    let puntos = await res.json();

    // Ordenar puntos por fecha y hora
    puntos.sort((a, b) => {
        const fechaHoraA = new Date(`${a.nadadorfecha}T${a.nadadorhora.split('T')[1]}`);
        const fechaHoraB = new Date(`${b.nadadorfecha}T${b.nadadorhora.split('T')[1]}`);

        if (fechaHoraA.getTime() === fechaHoraB.getTime()) {
            return Number(a.secuencia) - Number(b.secuencia);
        }
        return fechaHoraA.getTime() - fechaHoraB.getTime();
    });

    const latlngs = puntos
      .filter(p =>
        Number.isFinite(parseFloat(p.nadadorlat)) &&
        Number.isFinite(parseFloat(p.nadadorlng)) &&
        Number(p.secuencia) >= 1
      )
      .map(p => [parseFloat(p.nadadorlat), parseFloat(p.nadadorlng)]);

    if (latlngs.length === 0) {
      alert("❌ La ruta no contiene puntos válidos.");
      return;
    }

    // 🔹 Eliminar traza anterior si existe
    if (polylineTraza) {
        map.removeLayer(polylineTraza);
    }

    // 🔹 Dibujar nueva traza
    polylineTraza = L.polyline(latlngs, {
      color: 'orange',
      weight: 4,
      dashArray: '10, 10'
    }).addTo(map);

    console.log(`✅ Traza dibujada para usuario: ${usuarioId}`);

  } catch (err) {
    console.error("❌ Error al trazar ruta:", err);
    alert("⚠️ Error al trazar la ruta del usuario.");
  }
}

// 5. Función para actualizar todos los popups (refrescar estado de botones)
async function actualizarTodosLosPopups() {
  for (let [usuarioid, marcador] of marcadores.entries()) {
    try {
      // Obtener datos actualizados del usuario
      const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
      const usuario = await resUsuario.json();

      // Regenerar contenido del popup
      const nuevoContenido = generarContenidoPopupConTraza(usuarioid, usuario);
      marcador.bindPopup(nuevoContenido);

    } catch (err) {
      console.warn(`⚠️ Error actualizando popup para ${usuarioid}:`, err);
    }
  }
}

// 6. Función modificada para actualizar popup individual
async function actualizarPopup(usuarioid) {
  try {
    // 1. Traer los puntos de control del usuario
    console.log(`🔄 Actualizando popup para usuario: ${usuarioid}`);
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${usuarioid}`);
    const historial = await res.json();

    if (!Array.isArray(historial)) {
      console.warn(`⚠️ El historial no es un array para ${usuarioid}:`, historial);
      return;
    }

    // 2. Traer nombre y apellido del usuario
    const resUsuario = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioid}`);
    const usuario = await resUsuario.json();

    // 3. Actualizar el historial en memoria
    historialPuntos.set(usuarioid, historial.map(p => ({
      etiqueta: p.puntoControl || "❓(sin etiqueta)",
      fechaHora: p.fechaHora
    })));

    // 4. Generar contenido con botón de traza
    const popupHtml = generarContenidoPopupConTraza(usuarioid, usuario);

    // 5. Actualizar popup en el marcador correspondiente
    const marcador = marcadores.get(String(usuarioid));

    if (marcador) {
      marcador.bindPopup(popupHtml);
    } else {
      console.warn(`⚠️ No se encontró marcador para usuario ${usuarioid}`);
    }

  } catch (err) {
    console.error(`❌ Error crítico al actualizar popup para ${usuarioid}:`, err);
  }
}

// 7. Función modificada para borrar traza
function borrarTraza() {
  mostrarTraza = false;
  usuarioTrazaActiva = null; // 🎯 IMPORTANTE: Resetear usuario activo

  if (polylineTraza) {
    map.removeLayer(polylineTraza);
    polylineTraza = null;
  }

  // Actualizar popups para reflejar que no hay traza activa
  setTimeout(() => actualizarTodosLosPopups(), 100);
}

// 8. Modificación en el event listener del selector de usuario
document.addEventListener("DOMContentLoaded", () => {
  // ... tu código existente ...

  // 🎯 MODIFICAR EL EVENT LISTENER DEL SELECTOR DE USUARIO
  const selectorUsuario = document.getElementById('selector-usuario');
  if (selectorUsuario) {
    selectorUsuario.addEventListener('change', function() {
      const usuarioId = this.value;

      if (usuarioId && usuarioId !== 'Seleccione un usuario') {
        // Iniciar métricas
        iniciarActualizacionMetricas(usuarioId);

        // 🎯 ABRIR AUTOMÁTICAMENTE EL POPUP DEL USUARIO SELECCIONADO
        setTimeout(() => {
          const marcador = marcadores.get(String(usuarioId));
          if (marcador) {
            marcador.openPopup();
            console.log(`🎯 Popup abierto automáticamente para usuario: ${usuarioId}`);
          }
        }, 500); // Pequeño delay para asegurar que el marcador esté listo

      } else {
        detenerActualizacionMetricas();
        // Cerrar todos los popups
        marcadores.forEach(marcador => marcador.closePopup());
      }
    });
  }

  // ... resto de tu código existente ...
});

// 9. Modificación en la actualización automática de traza
// REEMPLAZAR el setInterval de traza automática con esta versión:
setInterval(() => {
  if (!mostrarTraza || !usuarioTrazaActiva) return; // 🛑 Solo si hay usuario con traza activa

  trazarRutaUsuarioEspecifico(usuarioTrazaActiva);
}, 5000);