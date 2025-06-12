let usuarios = [];

async function cargarUsuarios() {
  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/usuarios/listar");
    usuarios = await res.json();

    const lista = document.getElementById("usuariosDisponibles");
    usuarios.forEach(u => {
      const option = document.createElement("option");
      option.value = u.id;
      option.text = `${u.nombre} ${u.apellido}`;
      lista.appendChild(option);
    });
  } catch (err) {
    console.error("Error al cargar usuarios:", err);
  }
}

async function asignarUsuarios() {
  const select = document.getElementById("usuariosDisponibles");
  const seleccionados = Array.from(select.selectedOptions);

  for (const opt of seleccionados) {
    const usuarioId = parseInt(opt.value);
    const usuario = usuarios.find(u => u.id === usuarioId);
    if (!usuario) continue;

    try {
      const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/agregar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: { id: usuarioId } }) // adaptado al backend esperado
      });

      if (res.ok) {
        // Añadir al lado derecho visualmente
        const listaAsignados = document.getElementById("usuariosAsignados");
        const nuevo = document.createElement("option");
        nuevo.text = `${usuario.nombre} ${usuario.apellido}`;
        listaAsignados.appendChild(nuevo);
      } else {
        console.warn("No se pudo asignar usuario:", usuarioId);
      }

    } catch (err) {
      console.error("Error al asignar usuario:", err);
    }
  }

  // Refrescar tabla de participantes
  cargarParticipantes();
}

async function cargarParticipantes() {
  try {
    const res = await fetch("https://navigationasistance-backend-1.onrender.com/nadadorrutas/listar");
    const participantes = await res
