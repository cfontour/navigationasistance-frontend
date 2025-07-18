document.addEventListener("DOMContentLoaded", async () => {
  await cargarUsuarios();
  document.getElementById("selectorUsuario").addEventListener("change", generarReporte);
  document.getElementById("btnExportarPDF").addEventListener("click", exportarPDF);
});

async function cargarUsuarios() {
  const selector = document.getElementById("selectorUsuario");
  selector.innerHTML = '<option value="">Todos los participantes</option>';

  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
  const data = await res.json();

  for (const u of data) {
    const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${u.usuarioId}`);
    const usuario = await userInfo.json();

    const option = document.createElement("option");
    option.value = u.usuarioId;  // ✅ Esto es lo que espera listarPorNadadorrutaId
    option.textContent = `${u.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;

    selector.appendChild(option);
  }
}

async function generarReporte() {
  const idSeleccionado = document.getElementById("selectorUsuario").value;
  let puntos = [];

  try {
    if (idSeleccionado) {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${idSeleccionado}`);
      puntos = await res.json();
    } else {
      //const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listar");
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorRutaId/45");
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

    alert("✅ Reporte generado correctamente.");
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

  // Obtener el valor seleccionado del combo
  const idSeleccionado = document.getElementById("selectorUsuario").value;

  // Determinar el nombre del archivo
  const nombreArchivo = idSeleccionado
    ? `reporte_competidor_${idSeleccionado}.pdf`
    : `reporte_competidores_todos.pdf`;

  doc.autoTable({
    html: "#tablaReporte",
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 20 }
  });

  doc.save(nombreArchivo);
}
