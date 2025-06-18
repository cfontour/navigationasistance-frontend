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
    option.value = u.id; // usa el id de nadadorruta
    option.textContent = `${u.usuarioId} - ${usuario.nombre} ${usuario.apellido}`;
    selector.appendChild(option);
  }
}

async function cargarPuntos() {
  const idSeleccionado = document.getElementById("selectorUsuario").value;
  let puntos = [];

  if (idSeleccionado) {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listarPorNadadorrutaId/${idSeleccionado}`);
    puntos = await res.json();
  } else {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuariocapuntoscontrol/listar");
    puntos = await res.json();
  }

  const tbody = document.querySelector("#tablaReporte tbody");
  tbody.innerHTML = "";

  for (const p of puntos) {
    const userInfo = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${p.usuario_id}`);
    const usuario = await userInfo.json();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.nadadorruta_id}</td>
      <td>${usuario.nombre}</td>
      <td>${usuario.apellido}</td>
      <td>${p.nombre_punto}</td>
      <td>${new Date(p.hora_paso).toLocaleString()}</td>
    `;
    tbody.appendChild(tr);
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
