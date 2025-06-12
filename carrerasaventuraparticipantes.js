let usuarios = [];

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

  Array.from(origen.selectedOptions).forEach(async opt => {
    // Verifica que no esté ya asignado
    if ([...destino.options].some(o => o.value === opt.value)) return;

    // Enviar POST
    try {
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
        alert("Error al asignar participante.");
      }
    } catch (e) {
      console.error("Error POST:", e);
    }
  });
}

function quitarUsuario() {
  const destino = document.getElementById("usuariosAsignados");
  Array.from(destino.selectedOptions).forEach(opt => opt.remove());
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
  cargarUsuarios();
  cargarParticipantes();
});
