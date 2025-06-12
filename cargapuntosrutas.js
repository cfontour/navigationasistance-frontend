async function procesarArchivo() {
  const archivo = document.getElementById('excelFile').files[0];
  if (!archivo) {
    alert("Por favor selecciona un archivo Excel.");
    return;
  }

  const reader = new FileReader();
  reader.onload = async (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    const hoja = workbook.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(hoja, { header: ['nombre', 'latitud', 'longitud'], range: 1 });

    const resultados = [];

    for (const fila of json) {
      const punto = {
        nombre: fila.nombre,
        latitud: parseFloat(fila.latitud),
        longitud: parseFloat(fila.longitud)
      };

      try {
        const res = await fetch("https://tu-backend.com/rutaspuntos/agregar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(punto)
        });

        if (res.ok) {
          resultados.push(`✔️ ${punto.nombre} cargado`);
        } else {
          resultados.push(`❌ Error cargando ${punto.nombre}`);
        }
      } catch (err) {
        resultados.push(`❌ Error técnico con ${punto.nombre}: ${err.message}`);
      }
    }

    document.getElementById("resultado").innerHTML = resultados.join("<br>");
  };

  reader.readAsArrayBuffer(archivo);
}
