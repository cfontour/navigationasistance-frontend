document.addEventListener("DOMContentLoaded", async () => {
  await cargarUsuarios();
  document.getElementById("selectorUsuario").addEventListener("change", cargarPuntos);
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
    option.value = u.usuarioId; // 👈 usamos usuarioId, no el ID de la tabla intermedia
    option.textContent = `${u.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
    selector.appendChild(option);
  }
}

async function cargarPuntos() {
  const usuarioId = document.getElementById("selectorUsuario").value;
  let puntos = [];

  try {
    if (usuarioId) {
      // obtener rutaId desde endpoint porusuario
      const rutaRes = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorrutas/porusuario/${usuarioId}`);
      const rutaData = await rutaRes.json();
      const rutaId = rutaData.rutaId;

      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${rutaId}`);
      puntos = await res.json();
    } else {
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listar");
      puntos = await res.json();
    }

    const tbody = document.querySelector("#tablaReporte tbody");
    tbody.innerHTML = "";

    for (const p of puntos) {
      const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${p.nadadorrutaId}`);
      const usuario = await userInfo.json();

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.nadadorrutaId}</td>
        <td>${usuario.nombre}</td>
        <td>${usuario.apellido}</td>
        <td>${p.puntoControl}</td>
        <td>${new Date(p.fechaHora).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    }

    alert("✅ Reporte generado correctamente.");
  } catch (error) {
    console.error("❌ Error al cargar puntos:", error);
    alert("⚠️ Error al generar el reporte. Consulte la consola para más detalles.");
  }
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.autoTable({
    html: "#tablaReporte",
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
    margin: { top: 20 }
  });
  doc.save("reporte_competidores.pdf");
}

// ✅ FUNCIÓN agregada para resolver el error del botón
async function generarReporte() {
  await cargarPuntos();
}
