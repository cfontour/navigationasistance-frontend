let usuarioLogueado = null;
let listaElement = null;

document.addEventListener("DOMContentLoaded", async () => {
  listaElement = document.getElementById("lista-respaldos");

  const usuarioStr = localStorage.getItem("usuarioLogueado");
  if (!usuarioStr) {
    alert("No hay un usuario logueado.");
    return;
  }

  usuarioLogueado = JSON.parse(usuarioStr);
  document.getElementById("usuario-info").textContent =
    `ID: ${usuarioLogueado.id} - ${usuarioLogueado.nombre} ${usuarioLogueado.apellido}`;

  await cargarRespaldos();
});

async function cargarRespaldos() {
  listaElement.innerHTML = "";

  try {
    const res = await fetch(`https://navigationasistance-backend-1.onrender.com/respaldo/listarPorUsuario/${usuarioLogueado.id}`);

    if (!res.ok) throw new Error("Respuesta no OK del servidor");

    let data = [];

    try {
      data = await res.json();
    } catch (jsonError) {
      console.warn("Respuesta vacía o no JSON.");
    }

    if (!Array.isArray(data) || data.length === 0) {
      listaElement.innerHTML = `<li class="list-group-item text-muted">No hay contactos registrados.</li>`;
      return;
    }

    data.forEach((r) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";

      li.innerHTML = `
        <span>${r.contacto}</span>
        <div>
          <button class="btn btn-sm btn-warning mr-2" onclick="editarRespaldo(${r.id}, '${r.contacto}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="eliminarRespaldo(${r.id})">🗑️</button>
        </div>
      `;

      listaElement.appendChild(li);
    });
  } catch (error) {
    console.error("Error al cargar respaldos:", error);
    listaElement.innerHTML = `<li class="list-group-item text-danger">Error al cargar los contactos.</li>`;
  }
}


function mostrarFormularioAgregar() {
  document.getElementById("formulario-agregar").classList.remove("d-none");
}

function ocultarFormularioAgregar() {
  document.getElementById("formulario-agregar").classList.add("d-none");
  document.getElementById("input-contacto").value = "";
}

async function agregarRespaldo() {
  const contacto = document.getElementById("input-contacto").value.trim();
  if (!contacto) {
    alert("Debe ingresar un contacto válido.");
    return;
  }

  try {
    await fetch("https://navigationasistance-backend-1.onrender.com/respaldo/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contacto,
        usuarioId: usuarioLogueado.id
      })
    });

    ocultarFormularioAgregar();
    await cargarRespaldos();
  } catch (error) {
    console.error("Error al agregar respaldo:", error);
    alert("No se pudo agregar el contacto.");
  }
}

async function eliminarRespaldo(id) {
  if (!confirm("¿Seguro que desea eliminar este contacto?")) return;

  try {
    await fetch(`https://navigationasistance-backend-1.onrender.com/respaldo/eliminar/${id}`, {
      method: "POST"
    });

    await cargarRespaldos();
  } catch (error) {
    console.error("Error al eliminar respaldo:", error);
    alert("No se pudo eliminar el contacto.");
  }
}

function editarRespaldo(id, contactoActual) {
  const nuevoContacto = prompt("Editar contacto:", contactoActual);
  if (!nuevoContacto || nuevoContacto.trim() === "") return;

  fetch(`https://navigationasistance-backend-1.onrender.com/respaldo/actualizar/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contacto: nuevoContacto.trim() })
  })
    .then(() => cargarRespaldos())
    .catch((error) => {
      console.error("Error al actualizar respaldo:", error);
      alert("No se pudo actualizar el contacto.");
    });
}
