let usuarios = [];
let rutaIdGlobal = null;
let asignaciones = []; // guarda usuarioId → nadadorRutaId

async function obtenerRutaIdPorNombre(nombreRuta = "Regata 150 millas de a tres. Trofeo JGF") {
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/listar");
  const rutas = await res.json();
  const ruta = rutas.find(r => r.nombre === nombreRuta);
  if (ruta) {
    rutaIdGlobal = ruta.id;
    // 🟢 LOG #1: ID de la ruta encontrada
    console.log(`🟢 Ruta encontrada: ${ruta.nombre}, ID: ${rutaIdGlobal}`);
  } else {
    console.warn("❌ No se encontró la ruta con nombre:", nombreRuta);
  }
}

async function cargarUsuarios() {
  // grupo regatas
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listarGrupo/regatas");
  usuarios = await res.json();

  const lista = document.getElementById("usuariosDisponibles");
  usuarios.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.text = `${u.nombre} ${u.apellido}`;
    lista.appendChild(opt);
  });
}

async function asignarUsuario() {
  const origen = document.getElementById("usuariosDisponibles");

  Array.from(origen.selectedOptions).forEach(async opt => {
    const usuarioId = opt.value;

    // 🔍 OBTENER EL OBJETO COMPLETO DEL USUARIO
    const usuarioObj = usuarios.find(u => u.id === usuarioId);

    if (!usuarioObj) {
       console.error("❌ No se encontró usuario en el array");
       return;
    }

    // 🟢 OBTENER SU GRUPO DESDE EL OBJETO
    const grupoid = usuarioObj.grupoid;

    try {
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioId,
          rutaId: rutaIdGlobal,
          grupoid
        })
      });

      if (res.ok) {
        console.log(`🟢 Agregado usuarioId=${usuarioId} a rutaId=${rutaIdGlobal}`);
        cargarParticipantes(); // 🔁 recarga la lista derecha y grilla
      } else {
        const err = await res.text();
        console.warn("❌ Error en el POST:", err);
      }
    } catch (e) {
      console.error("Error POST:", e);
    }
  });
}

function quitarUsuario() {
  const destino = document.getElementById("usuariosAsignados");

  Array.from(destino.selectedOptions).forEach(async opt => {
    const usuarioId = opt.value;
    const match = asignaciones.find(a => a.usuarioId === usuarioId);

    if (!match) {
      alert(`No se encontró asignación para usuario ID: ${usuarioId}`);
      return;
    }

    const confirmar = confirm(`¿Eliminar al usuario ${opt.text}?`);
    if (!confirmar) return;

    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorrutas/eliminar/${match.nadadorRutaId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        opt.remove();
        cargarParticipantes(); // 🔁 recarga grilla y lista derecha
      } else {
        alert("❌ Error eliminando participante.");
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  });
}

//let asignaciones = [];

async function cargarParticipantes() {
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listarGrupo/regatas");
  const lista = await res.json();
  const tbody = document.querySelector("#tablaParticipantes tbody");
  const destino = document.getElementById("usuariosAsignados");

  tbody.innerHTML = "";
  destino.innerHTML = "";
  asignaciones = [];

  for (const p of lista) {
    const usuarioId = String(p.usuario?.id || p.usuarioId);

    // 🧠 Ir a buscar los datos completos del usuario
    let datosUsuario = {};
    try {
      const resU = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${usuarioId}`);
      datosUsuario = await resU.json();
    } catch (e) {
      console.warn(`⚠️ No se pudieron obtener datos para usuario ${usuarioId}`);
    }

    const { nombre = "-", apellido = "-", email = "-", telefono = "-" } = datosUsuario;

    // Guardamos para futuras eliminaciones
    asignaciones.push({ usuarioId, nadadorRutaId: p.id });

    // Lista derecha (select)
    const opt = document.createElement("option");
    opt.value = usuarioId;
    opt.text = `${nombre} ${apellido}`;
    destino.appendChild(opt);

    // Fila grilla
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${usuarioId}</td>
      <td>${nombre}</td>
      <td>${apellido}</td>
      <td>${email}</td>
      <td>${telefono}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Listado de Participantes Registrados", 14, 20);

  const head = [["ID", "Nombre", "Apellido", "Mail", "Teléfono"]];
  const body = [];

  const tabla = document.querySelectorAll("#tablaParticipantes tbody tr");
  tabla.forEach(row => {
    const cols = Array.from(row.querySelectorAll("td")).map(td => td.textContent.trim());
    body.push(cols);
  });

  doc.autoTable({
    startY: 30,
    head: head,
    body: body
  });

  doc.save("participantes-regatas.pdf");
}

document.addEventListener("DOMContentLoaded", () => {
  obtenerRutaIdPorNombre("PUNTA DEL ESTE"); // o el nombre exacto de la ruta
  cargarUsuarios();
  cargarParticipantes();
});
