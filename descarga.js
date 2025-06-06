// descarga.js

document.addEventListener("DOMContentLoaded", () => {
    console.log("descarga.js cargado correctamente");

// descarga.js
document.addEventListener("DOMContentLoaded", () => {
    const userStr = localStorage.getItem("usuarioLogueado");
    const usuarioInfo = document.getElementById("usuario-info");

    if (userStr && usuarioInfo) {
        try {
            const usuario = JSON.parse(userStr);
            usuarioInfo.textContent = `ID: ${usuario.id} - ${usuario.nombre} ${usuario.apellido}`;
        } catch (e) {
            usuarioInfo.textContent = "No se pudo cargar el usuario.";
        }
    } else {
        usuarioInfo.textContent = "No hay usuario logueado.";
    }
});

});
