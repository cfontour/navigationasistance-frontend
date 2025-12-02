async function login() {
    const usuario = document.getElementById("usuario").value;
    const password = document.getElementById("password").value;

    if (!usuario || !password) {
        alert("Debe ingresar usuario y contraseña");
        return;
    }

    try {
        const backendUrl = "https://navigationasistance-backend-1.onrender.com";

        const res = await fetch(`${backendUrl}/usuarios/login/${usuario}/${password}`, {
            method: "GET",
            credentials: "include"
        });

        if (res.status === 200) {
            // Login correcto → ir al menú
            window.location.href = "menuop.html";
        } else {
            // Usuario o password incorrecta
            window.location.href = "noacceso.html";
        }

    } catch (e) {
        console.error("Error en login:", e);
        alert("Error de conexión con el servidor");
    }
}
