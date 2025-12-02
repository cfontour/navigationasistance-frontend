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
                    credentials: "include" // 🔹 importante para que la cookie de sesión viaje
                });

        if (res.status === 200) {
            const usuarioData = await res.json(); // viene el JSON del usuario

            // 🔹 Guardamos "sesión" sencilla en el navegador
            localStorage.setItem("usuarioLogueado", usuarioData.id); // o usuarioData.usuario, etc.


            // Login correcto
            window.location.href = "menuop.html";
        } else {
            // No autorizado
            window.location.href = "noacceso.html";
        }

    } catch (e) {
        console.error("Error en login:", e);
        alert("Error de conexión con el servidor");
    }
}
