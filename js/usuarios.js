// usuarios.js

let modoEditar = false;

$(document).ready(function () {
    const usuarioStr = localStorage.getItem("usuarioLogueado");
    if (!usuarioStr) return;

    const usuario = JSON.parse(usuarioStr);
    actualizarEmailDelUsuario();
    mostrarItemRespaldoSiUsuarioLogueado();

    if (usuario.rol === "ADMINISTRADOR") {
        cargarUsuarios();
        $('#usuarios').DataTable();
    } else {
        mostrarVistaSoloDelUsuario(usuario);
        document.getElementById("card-cambiar-password").classList.remove("d-none");
    }
});

function getHeaders() {
    return {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    };
}

function actualizarEmailDelUsuario() {
    const email = localStorage.getItem('usuarioEmail');
    if (email) {
        document.getElementById('txt-email-usuario').innerText = email;
    }
}

async function cargarUsuarios() {
    const request = await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/listar', {
        method: 'GET',
        headers: getHeaders()
    });

    const usuarios = await request.json();
    let listadoHtml = '';

    for (let usuario of usuarios) {
        let botonEliminar = `<a href="#" onclick="eliminarUsuario('${usuario.id}')" class="btn btn-danger btn-circle btn-sm"><i class="fas fa-trash"></i></a>`;
        let botonEditar = `<a href="#" onclick="editarUsuario('${usuario.id}')" class="btn btn-info btn-circle btn-sm"><i class="fas fa-edit"></i></a>`;
        let usuarioHtml = `<tr>
            <td>${usuario.id}</td>
            <td>${usuario.nombre} ${usuario.apellido}</td>
            <td>${usuario.email}</td>
            <td>${usuario.telefono || ''}</td>
            <td>${botonEditar} ${botonEliminar}</td>
        </tr>`;
        listadoHtml += usuarioHtml;
    }

    document.querySelector('#usuarios tbody').innerHTML = listadoHtml;
}

async function cargarUsuarioUnico(id) {
    try {
        const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`, {
            method: 'GET',
            headers: getHeaders()
        });

        const usuario = await res.json();
        mostrarVistaSoloDelUsuario(usuario);
    } catch (error) {
        console.error("Error al cargar el usuario logueado:", error);
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Desea eliminar el usuario?')) return;

    await fetch('https://navigationasistance-backend-1.onrender.com/usuarios/eliminar/' + id, {
        method: 'DELETE',
        headers: getHeaders()
    });

    cargarUsuarios();
}

async function agregarUsuario() {
    const id = document.getElementById('inputId').value.trim();
    const nombre = document.getElementById('inputNombre').value.trim();
    const apellido = document.getElementById('inputApellido').value.trim();
    const email = document.getElementById('inputEmail').value.trim();
    const password = document.getElementById('inputPassword').value.trim();
    const telefono = document.getElementById('inputTelefono').value.trim();

    if (!id || !nombre || !apellido || !email || !telefono || (!modoEditar && !password)) {
        alert("Por favor, completa todos los campos obligatorios.");
        return;
    }

    const usuario = { id, nombre, apellido, email, password, telefono };
    if (!modoEditar) usuario.password = password;

    const url = modoEditar
        ? `https://navigationasistance-backend-1.onrender.com/usuarios/actualizar/${id}`
        : 'https://navigationasistance-backend-1.onrender.com/usuarios/agregar';

    const metodo = 'POST';

    try {
        const response = await fetch(url, {
            method: metodo,
            headers: getHeaders(),
            body: JSON.stringify(usuario)
        });

        const resultado = await response.text();
        alert(resultado);

        document.getElementById('formAgregarUsuario').reset();
        modoEditar = false;
        cargarUsuarios();
    } catch (error) {
        console.error("Error al agregar usuario:", error);
        alert("No se pudo agregar el usuario. Intente nuevamente.");
    }
}

async function editarUsuario(id) {
    try {
        const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`, {
            method: 'GET',
            headers: getHeaders()
        });

        const usuario = await res.json();
        document.getElementById('inputId').value = usuario.id;
        document.getElementById('inputNombre').value = usuario.nombre;
        document.getElementById('inputApellido').value = usuario.apellido;
        document.getElementById('inputEmail').value = usuario.email;
        document.getElementById('inputTelefono').value = usuario.telefono || '';
        document.getElementById('inputPassword').value = '';

        // ID no editable en modo edición
        document.getElementById('inputId').readOnly = true;

        modoEditar = true;
    } catch (error) {
        console.error("Error al cargar usuario para editar:", error);
        alert("No se pudo cargar el usuario.");
    }
}

async function cambiarPassword() {
    const nueva = document.getElementById('inputNuevaPassword').value.trim();
    const repetir = document.getElementById('inputRepetirPassword').value.trim();

    if (!nueva || !repetir) {
        alert("Por favor, completa ambos campos.");
        return;
    }

    if (nueva !== repetir) {
        alert("Las contraseñas no coinciden.");
        return;
    }

    const usuarioStr = localStorage.getItem("usuarioLogueado");
    if (!usuarioStr) return;

    const usuario = JSON.parse(usuarioStr);

    try {
        const response = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/cambiarPassword/${usuario.id}`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ password: nueva, id: usuario.id })
        });

        const resultado = await response.text();
        alert(resultado);
        document.getElementById('formCambiarPassword').reset();
    } catch (error) {
        console.error("Error al cambiar contraseña:", error);
        alert("No se pudo cambiar la contraseña.");
    }
}

function mostrarItemRespaldoSiUsuarioLogueado() {
    const userStr = localStorage.getItem("usuarioLogueado");
    const itemRespaldo = document.getElementById("item-respaldo");

    if (userStr && itemRespaldo) {
        itemRespaldo.classList.remove("d-none");
    }
}

// ✅ NUEVO: Vista restringida solo para rol USUARIO
function mostrarVistaSoloDelUsuario(usuario) {
    document.getElementById("card-formulario").classList.add("d-none");
    document.getElementById("card-tabla").classList.add("d-none");

    const container = document.querySelector(".container-fluid");
    const card = document.createElement("div");
    card.className = "card mb-4";
    card.innerHTML = `
        <div class="card-header">Tus datos</div>
        <div class="card-body">
            <table class="table table-bordered">
                <thead><tr><th>ID</th><th>Nombre Completo</th><th>Email</th><th>Teléfono</th></tr></thead>
                <tbody>
                    <tr>
                        <td>${usuario.id}</td>
                        <td>${usuario.nombre} ${usuario.apellido}</td>
                        <td>${usuario.email}</td>
                        <td>${usuario.telefono || ''}</td>
                        <td><a href="#" onclick="editarUsuario('${usuario.id}')" class="btn btn-info btn-circle btn-sm"><i class="fas fa-edit"></i></a></td>
                    </tr>
                </tbody>
            </table>
            <button class="btn btn-primary mt-3" onclick="mostrarFormularioCambiarPassword()">Cambiar Contraseña</button>
        </div>
    `;
    container.appendChild(card);
}

function mostrarFormularioCambiarPassword() {
    document.getElementById("card-cambiar-password").scrollIntoView({ behavior: 'smooth' });
    document.getElementById("card-cambiar-password").classList.remove("d-none");
}
