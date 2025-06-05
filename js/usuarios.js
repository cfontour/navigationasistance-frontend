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
        cargarVistaGrillaUnica(usuario.id);
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

async function cargarVistaGrillaUnica(id) {
    try {
        const res = await fetch(`https://navigationasistance-backend-1.onrender.com/usuarios/listarId/${id}`, {
            method: 'GET',
            headers: getHeaders()
        });

        const usuario = await res.json();

        // Mostrar la grilla con un solo usuario
        document.getElementById("card-formulario").classList.add("d-none");
        document.getElementById("card-tabla").classList.remove("d-none");

        const tableBody = document.querySelector("#usuarios tbody");
        tableBody.innerHTML = '';

        let botonEditar = `<a href='#' onclick="editarUsuario('${usuario.id}')" class="btn btn-info btn-circle btn-sm"><i class="fas fa-edit"></i></a>`;
        let usuarioHtml = `<tr>
            <td>${usuario.id}</td>
            <td>${usuario.nombre} ${usuario.apellido}</td>
            <td>${usuario.email}</td>
            <td>${usuario.telefono || ''}</td>
            <td>${botonEditar}</td>
        </tr>`;

        tableBody.innerHTML = usuarioHtml;
        $('#usuarios').DataTable();

    } catch (error) {
        console.error("Error al cargar usuario para vista de grilla única:", error);
    }
}

// Las demás funciones quedan como están: agregarUsuario, editarUsuario, cambiarPassword, etc.
