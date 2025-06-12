async function procesarCarga() {
  const nombre = document.getElementById("nombreRuta").value.trim();
  const color = document.getElementById("colorRuta").value;
  const archivo = document.getElementById("excelFile").files[0];
  const resultado = document.getElementById("resultado");
  resultado.innerHTML = "";

  if (!nombre || !color || !archivo) {
    alert("Debe completar todos los campos y seleccionar un archivo.");
    return;
  }

  // Paso 1: Crear la ruta
  const rutaPayload = { nombre, color };
  let idRuta;

  try {
    const resRuta = await fetch("https://navigationasistance-backend-1.onrender.com/rutas/agregar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rutaPayload)
    });

    if (!resRuta.ok) throw new Error("No se pudo crear la ruta.");
      const dataRuta = await resRuta.json();
      console.log("🧾 Respuesta completa de /rutas/agregar:", dataRuta);

      // Intenta extraer el ID de distintas formas posibles
      idRuta = dataRuta.id || dataRuta.ruta?.id || dataRuta.rutaId || dataRuta;

      // Validación final
      if (!idRuta || isNaN(idRuta)) {
        throw new Error("No se pudo determinar el ID de la ruta. Revisa la respuesta del backend.");
      }

      // 🟢 LOG #1: ID de la ruta creada
      console.log(`🟢 Ruta creada con ID: ${idRuta}`);

  } catch (err) {
    resultado.innerText = "❌ Error al crear la ruta: " + err.message;
    return;
  }

  // Paso 2: Leer el Excel
  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { header: ['nombre', 'latitud', 'longitud'], range: 1 });

    // Crear array de puntos
    const puntos = json.map((fila, index) => ({
      ruta: { id: idRuta },
      secuencia: index + 1,
      latitud: parseFloat(String(fila.latitud).replace(",", ".")),
      longitud: parseFloat(String(fila.longitud).replace(",", ".")),
      nombre: fila.nombre || `Punto ${index + 1}`
    }));

    // 🟢 LOG #2: JSON completo que se enviará a /rutaspuntos/agregar-masivo
    console.log("🟢 JSON enviado a /rutaspuntos/agregar-masivo:");
    console.log(JSON.stringify(puntos, null, 2));

    // Paso 3: Enviar puntos al backend
    try {
      const resPuntos = await fetch("https://navigationasistance-backend-1.onrender.com/rutaspuntos/agregar-masivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(puntos)
      });

      if (!resPuntos.ok) throw new Error("No se pudieron cargar los puntos.");
      resultado.innerHTML = `✔️ Ruta creada con ID ${idRuta} y ${puntos.length} puntos cargados.`;
    } catch (err) {
      resultado.innerHTML = "❌ Error al cargar los puntos: " + err.message;
    }
  };

  reader.readAsArrayBuffer(archivo);
}
