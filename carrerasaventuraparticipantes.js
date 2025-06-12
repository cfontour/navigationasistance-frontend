let usuarios = [];
let rutaIdGlobal = null;

async function obtenerRutaIdPorNombre(nombreRuta = "JACKSONVILLE") {
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
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listar");
  usuarios = await res.json();

  const lista = document.getElementById("usuariosDisponibles");
  usuarios.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.text = `${u.nombre} ${u.apellido}`;
    lista.appendChild(opt);
  });
}

function asignarUsuario() {
  const origen = document.getElementById("usuariosDisponibles");
  const destino = document.getElementById("usuariosAsignados");

  if (!rutaIdGlobal) {
    alert("No se pudo obtener el ID de la ruta.");
    return;
  }

  Array.from(origen.selectedOptions).forEach(async opt => {
    // Verifica que no esté ya asignado
    if ([...destino.options].some(o => o.value === opt.value)) return;

    // Enviar POST
    try {
      const body = {
        usuarioId: usuarioId,
        rutaId: rutaIdGlobal
      };

      // 🟡 LOG #2: Body del POST
      console.log("🟡 Preparando body para POST /nadadorrutas/agregar:");
      console.log(JSON.stringify(body, null, 2));
      
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: { id: parseInt(opt.value) } })
      });

      if (res.ok) {
        const nuevo = opt.cloneNode(true);
        destino.appendChild(nuevo);
        opt.selected = false;
        cargarParticipantes(); // actualizar tabla
      } else {
        const err = await res.text();
        console.warn("Error en la respuesta:", err);
        alert("Error al asignar participante.");
      }
    } catch (e) {
      console.error("Error POST:", e);
    }
  });
}

function quitarUsuario() {
  const destino = document.getElementById("usuariosAsignados");

  Array.from(destino.selectedOptions).forEach(async opt => {
    const id = parseInt(opt.value);

    try {
      const res = await fetch(`https://navigationasistance-backend-1.onrender.com/nadadorrutas/eliminar/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        opt.remove();
        cargarParticipantes(); // Actualiza la tabla
      } else {
        console.warn(`❌ No se pudo eliminar el usuario con ID ${id}`);
      }
    } catch (err) {
      console.error("Error al eliminar:", err);
    }
  });
}


async function cargarParticipantes() {
  const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
  const participantes = await res.json();
  const tbody = document.querySelector("#tablaParticipantes tbody");
  tbody.innerHTML = "";

  participantes.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.id}</td>
      <td>${p.nombre}</td>
      <td>${p.apellido}</td>
      <td>${p.mail}</td>
      <td>${p.telefono}</td>
    `;
    tbody.appendChild(tr);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  obtenerRutaIdPorNombre("JACKSONVILLE"); // o el nombre exacto de la ruta
  cargarUsuarios();
  cargarParticipantes();
});
