document.addEventListener("DOMContentLoaded", async () => {
  await cargarRutasDisponiblesEnSelector();
  await cargarUsuarios();

  // Agregar event listeners para ambos selectores
  document.getElementById("selectorUsuario").addEventListener("change", generarReporte);
  document.getElementById("selectorRuta").addEventListener("change", onRutaChange);
  document.getElementById("btnExportarPDF").addEventListener("click", exportarPDF);
});

// FUNCIÓN NUEVA: Para llenar el selector de rutas con las opciones del backend
async function cargarRutasDisponiblesEnSelector() {
  const selectorRuta = document.getElementById("selectorRuta");

  // Limpiar opciones existentes (excepto la primera "Seleccione una ruta")
  while (selectorRuta.options.length > 1) {
    selectorRuta.remove(1);
  }

  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listarSimples");
    const rutasDisponibles = await res.json();

    rutasDisponibles.forEach((ruta) => {
      if (ruta.color === "CARRERA") {
        const opt = document.createElement("option");
        opt.value = ruta.id;
        opt.textContent = `Ruta ${ruta.id} - ${ruta.nombre}`;
        selectorRuta.appendChild(opt);
      }
    });
  } catch (e) {
    console.error("❌ Error al cargar rutas disponibles en el selector:", e);
    alert("❌ Error al cargar la lista de rutas disponibles.");
  }
}

// FUNCIÓN NUEVA: Manejar cambio de ruta
async function onRutaChange() {
  const rutaSeleccionada = document.getElementById("selectorRuta").value;

  if (rutaSeleccionada) {
    // Cargar usuarios específicos de la ruta seleccionada
    await cargarUsuariosPorRuta(rutaSeleccionada);
  } else {
    // Si no hay ruta seleccionada, cargar todos los usuarios
    await cargarUsuarios();
  }

  // Generar reporte automáticamente cuando cambie la ruta
  generarReporte();
}

// FUNCIÓN MODIFICADA: Cargar usuarios filtrados por ruta
async function cargarUsuariosPorRuta(rutaId) {
  const selector = document.getElementById("selectorUsuario");
  selector.innerHTML = '<option value="">Todos los participantes de esta ruta</option>';

  try {
    // Obtener puntos de control de la ruta específica
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorRutaId/${rutaId}`);
    const puntosRuta = await res.json();

    // Obtener usuarios únicos de esta ruta
    const usuariosUnicos = [...new Set(puntosRuta.map(p => p.nadadorrutaId))];

    for (const usuarioId of usuariosUnicos) {
      try {
        const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioId}`);
        const usuario = await userInfo.json();

        const option = document.createElement("option");
        option.value = usuarioId;
        option.textContent = `${usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
        selector.appendChild(option);
      } catch (error) {
        console.error(`Error al obtener info del usuario ${usuarioId}:`, error);
      }
    }
  } catch (e) {
    console.error("❌ Error al cargar usuarios por ruta:", e);
    alert("❌ Error al cargar usuarios de la ruta seleccionada.");
  }
}

async function cargarUsuarios() {
  const selector = document.getElementById("selectorUsuario");
  selector.innerHTML = '<option value="">Todos los participantes</option>';

  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
  const data = await res.json();

  for (const u of data) {
    const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${u.usuarioId}`);
    const usuario = await userInfo.json();

    const option = document.createElement("option");
    option.value = u.usuarioId;
    option.textContent = `${u.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;

    selector.appendChild(option);
  }
}

async function generarReporte() {
  const idUsuarioSeleccionado = document.getElementById("selectorUsuario").value;
  const idRutaSeleccionada = document.getElementById("selectorRuta").value;
  let puntos = [];

  try {
    // Lógica de filtrado basada en las selecciones
    if (idRutaSeleccionada && idUsuarioSeleccionado) {
      // Filtrar por ruta específica y usuario específico
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorRutaId/${idRutaSeleccionada}`);
      const todosPuntos = await res.json();
      puntos = todosPuntos.filter(p => p.nadadorrutaId === idUsuarioSeleccionado);
    } else if (idRutaSeleccionada && !idUsuarioSeleccionado) {
      // Filtrar solo por ruta (todos los usuarios de esa ruta)
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorRutaId/${idRutaSeleccionada}`);
      puntos = await res.json();
    } else if (!idRutaSeleccionada && idUsuarioSeleccionado) {
      // Filtrar solo por usuario (todas las rutas de ese usuario)
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${idUsuarioSeleccionado}`);
      puntos = await res.json();
    } else {
      // Sin filtros - todos los puntos
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listar");
      puntos = await res.json();
      puntos.sort((a, b) => a.nadadorrutaId.localeCompare(b.nadadorrutaId));
    }

    const tbody = document.querySelector("#tablaReporte tbody");
    tbody.innerHTML = "";

    for (const p of puntos) {
      const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${p.nadadorrutaId}`);
      const usuario = await userInfo.json();

      const fechaHoraFormateada = new Date(p.fechaHora).toLocaleString();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.nadadorrutaId}</td>
        <td>${usuario.nombre}</td>
        <td>${usuario.apellido}</td>
        <td>${p.puntoControl}</td>
        <td>${fechaHoraFormateada}</td>
      `;
      tbody.appendChild(tr);
    }

    // Mostrar mensaje más específico
    const mensajeExito = idRutaSeleccionada && idUsuarioSeleccionado
      ? "✅ Reporte generado para usuario y ruta específica."
      : idRutaSeleccionada
      ? "✅ Reporte generado para ruta específica."
      : idUsuarioSeleccionado
      ? "✅ Reporte generado para usuario específico."
      : "✅ Reporte generado para todos los datos.";

    alert(mensajeExito);
  } catch (error) {
    console.error("❌ Error al generar reporte:", error);
    alert("⚠️ Error al generar el reporte.");
  }
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const table = document.querySelector("#tablaReporte");

  if (!table || table.rows.length <= 1) {
    alert("⚠️ No hay datos en la tabla para exportar.");
    return;
  }

  // Obtener valores seleccionados
  const idUsuarioSeleccionado = document.getElementById("selectorUsuario").value;
  const idRutaSeleccionada = document.getElementById("selectorRuta").value;

  // Determinar el nombre del archivo basado en los filtros aplicados
  let nombreArchivo = "reporte_puntos_control";

  if (idRutaSeleccionada && idUsuarioSeleccionado) {
    nombreArchivo = `reporte_ruta_${idRutaSeleccionada}_usuario_${idUsuarioSeleccionado}.pdf`;
  } else if (idRutaSeleccionada) {
    nombreArchivo = `reporte_ruta_${idRutaSeleccionada}.pdf`;
  } else if (idUsuarioSeleccionado) {
    nombreArchivo = `reporte_usuario_${idUsuarioSeleccionado}.pdf`;
  } else {
    nombreArchivo = `reporte_todos_los_puntos.pdf`;
  }

  doc.autoTable({
    html: "#tablaReporte",
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 20 }
  });

  doc.save(nombreArchivo);
}