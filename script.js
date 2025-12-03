// --- CONFIGURACIÓN DE API ---
const API_URL = "http://54.88.143.116:5500/api"; 
const WEBSOCKET_URL = "ws://54.88.143.116:5500/ws"; 
const DISPOSITIVO_ID = 1; 

// --- REFERENCIAS A ELEMENTOS DEL DOM ---
const selectDispositivo = document.getElementById('select-dispositivo');
const labelMovimiento = document.getElementById('label-movimiento');
const labelObstaculo = document.getElementById('label-obstaculo');
const selectSecuencia = document.getElementById('select-secuencia');

// Controles de Grabación
const recordingControls = document.getElementById('recording-controls');
const btnRecordStart = document.getElementById('btn-record-start');
const btnRecordStop = document.getElementById('btn-record-stop');
const btnRecordCancel = document.getElementById('btn-record-cancel');
const liveIndicator = document.getElementById('live-indicator');

// Modal de Reproducción (Botones actualizados)
const modalReproducir = document.getElementById('modal-reproducir');
const selectSecuenciaApi = document.getElementById('select-secuencia-api');
const btnModalReproducir = document.getElementById('btn-modal-reproducir');
const btnModalPausar = document.getElementById('btn-modal-pausar');
const btnModalCancelar = document.getElementById('btn-modal-cancelar');

// Modal de Grabar Nombre
const modalGrabarNombre = document.getElementById('modal-grabar-nombre');
const inputNombreSecuencia = document.getElementById('input-nombre-secuencia');
const btnModalGrabarAceptar = document.getElementById('btn-modal-grabar-aceptar');
const btnModalGrabarCancelar = document.getElementById('btn-modal-grabar-cancelar');

// Referencias de Velocidad y Alerta
const speedControlContainer = document.getElementById('speed-control-container');
const speedButtons = document.querySelectorAll('.speed-button');
const alertBox = document.getElementById('alert-box');

// --- DATOS DE MAPEO (Front-end) ---
const tablaOperaciones = {
    1: "Adelante", 2: "Atrás", 3: "Detener", 4: "Vuelta adelante derecha",
    5: "Vuelta adelante izquierda", 6: "Vuelta atrás derecha", 7: "Vuelta atrás izquierda",
    8: "Giro 90° derecha", 9: "Giro 90° izquierda", 10: "Giro 360° derecha", 11: "Giro 360° izquierda",
};

// --- ESTADO DE LA APLICACIÓN ---
let modoGrabacion = false;
let movimientosGrabados = [];
let nombreSecuenciaActual = null;

let modoReproduccion = false; 
let reproduccionInterval = null; 
let reproduccionOrdenActual = 0; 
let reproduccionSecuenciaId = null; 

let velocidadActual = 1; // Estado de Velocidad (default en 1)

// --- FUNCIONES DE LÓGICA DE UI ---
function actualizarMovimiento(movimiento) {
    labelMovimiento.textContent = movimiento;
}

function actualizarObstaculo(obstaculo) {
    labelObstaculo.textContent = obstaculo;
}

function mostrarLive(mostrar) {
    liveIndicator.style.visibility = mostrar ? 'visible' : 'hidden';
    liveIndicator.style.opacity = mostrar ? '1' : '0';
}

function setControlesDeshabilitados(deshabilitar) {
    selectDispositivo.disabled = deshabilitar;
}

/**
 * Habilita o deshabilita los botones de velocidad.
 * @param {boolean} deshabilitar - true para deshabilitar, false para habilitar.
 */
function setSpeedControlsDisabled(deshabilitar) {
    console.log(`Controles de velocidad deshabilitados: ${deshabilitar}`);
    speedButtons.forEach(btn => {
        btn.disabled = deshabilitar;
    });
}

function mostrarModal(modal, mostrar) {
    if (mostrar) {
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('modal-open'), 10);
    } else {
        modal.classList.remove('modal-open');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

// Alerta "Toast"
function mostrarAlerta(mensaje, tipo = 'success', duracion = 3000) {
    alertBox.textContent = mensaje;
    alertBox.className = `alert-toast ${tipo}`; // Resetea clases y aplica tipo
    alertBox.classList.add('show');
    
    setTimeout(() => {
        alertBox.classList.remove('show');
    }, duracion);
}


// --- LÓGICA DE GRABACIÓN ---
function resetearModoGrabacion() {
    console.log("Reseteando modo grabación");
    modoGrabacion = false;
    movimientosGrabados = [];
    nombreSecuenciaActual = null;
    
    setControlesDeshabilitados(false);
    setSpeedControlsDisabled(false); // Habilitar velocidad
    
    recordingControls.classList.add('hidden');
    mostrarLive(false);
    if (selectSecuencia.value === "grabar") {
        selectSecuencia.value = "";
    }
}

// --- LÓGICA DE REPRODUCCIÓN ---
function pausarSecuencia() {
    if (reproduccionInterval) {
        clearTimeout(reproduccionInterval); 
        reproduccionInterval = null;
        modoReproduccion = false; 
        console.log(`Secuencia pausada en el paso: ${reproduccionOrdenActual}`);
        actualizarMovimiento(`Pausado (paso ${reproduccionOrdenActual})`);
        
        btnModalReproducir.disabled = false; 
        btnModalReproducir.textContent = "Reanudar";
        btnModalPausar.disabled = true;
    }
}

function reanudarSecuencia() {
    if (reproduccionSecuenciaId !== null) {
        modoReproduccion = true; 
        console.log(`Reanudando secuencia desde el paso: ${reproduccionOrdenActual}`);
        actualizarMovimiento(`Reanudando desde paso ${reproduccionOrdenActual}...`);
        
        btnModalReproducir.disabled = true;
        btnModalReproducir.textContent = "Reproduciendo...";
        btnModalPausar.disabled = false;
        
        apiEjecutarSiguientePaso(); 
    }
}

function resetearSecuenciaPorCompleto() {
    console.log("Reseteando secuencia por completo");
    pausarSecuencia(); 
    
    modoReproduccion = false; 
    reproduccionOrdenActual = 0;
    reproduccionSecuenciaId = null;
    
    btnModalReproducir.disabled = false;
    btnModalReproducir.textContent = "Reproducir"; 
    btnModalPausar.disabled = true;
    selectSecuenciaApi.value = ""; 
    
    if (selectSecuencia.value === "reproducir") {
        selectSecuencia.value = "";
    }
}


// --- FUNCIONES DE API (Async/Await) ---

async function apiEnviarMovimiento(clave, texto) {
    console.log(`API: Enviando movimiento ${clave} (${texto}) a Velocidad ${velocidadActual}`);
    actualizarMovimiento(texto); 

    try {
        const response = await fetch(`${API_URL}/movimiento`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                dispositivo_id: DISPOSITIVO_ID,
                status_clave: clave,
                status_texto: texto,
                velocidad: velocidadActual
            })
        });

        if (!response.ok) throw new Error(`Error ${response.status} de la API`);
        const result = await response.json();
        console.log("API: Movimiento registrado", result);
        
        if (modoGrabacion) {
            movimientosGrabados.push(clave);
            console.log("Movimiento grabado:", movimientosGrabados);
        }

    } catch (error) {
        console.error("Error en apiEnviarMovimiento:", error);
        actualizarMovimiento("Error de conexión");
    }
}

async function apiGetUltimoObstaculo() {
    try {
        const response = await fetch(`${API_URL}/obstaculo/ultimo/${DISPOSITIVO_ID}`);
        if (!response.ok) {
            if (response.status === 404) {
                actualizarObstaculo('Sin reportes');
                return;
            }
            throw new Error(`Error ${response.status}`);
        }
        const data = await response.json();
        actualizarObstaculo(data.status_texto || 'Sin datos');
    } catch (error) {
        console.error("Error apiGetUltimoObstaculo:", error);
        actualizarObstaculo('Error al consultar');
    }
}


async function apiObtenerSecuencias() {
    console.log("API: Obteniendo historial de secuencias");
    selectSecuenciaApi.innerHTML = '<option value="">Cargando...</option>';
    try {
        const response = await fetch(`${API_URL}/secuencia/historial/${DISPOSITIVO_ID}`);
        if (!response.ok) throw new Error(`Error ${response.status} de la API`);
        const secuencias = await response.json();
        console.log("API: Secuencias recibidas", secuencias);
        
        selectSecuenciaApi.innerHTML = '<option value="">Seleccione una...</option>';
        if (secuencias && secuencias.length > 0) {
            secuencias.forEach(seq => {
                const option = new Option(seq.nombre_secuencia, seq.secuencia_id);
                selectSecuenciaApi.add(option);
            });
        } else {
            selectSecuenciaApi.innerHTML = '<option value="">No hay secuencias</option>';
        }
    } catch (error) {
        console.error("Error en apiObtenerSecuencias:", error);
        selectSecuenciaApi.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function apiCrearSecuencia() {
    console.log(`API: Creando secuencia "${nombreSecuenciaActual}" con ${movimientosGrabados.length} pasos`);
    try {
        const response = await fetch(`${API_URL}/secuencia`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                dispositivo_id: DISPOSITIVO_ID,
                nombre_secuencia: nombreSecuenciaActual,
                movimientos: movimientosGrabados
            })
        });
        if (!response.ok) throw new Error(`Error ${response.status} de la API`);
        const result = await response.json();
        console.log("API: Secuencia creada", result);
        actualizarMovimiento(`Secuencia "${nombreSecuenciaActual}" guardada.`);
        mostrarAlerta(`Secuencia "${nombreSecuenciaActual}" guardada.`, 'success');
    } catch (error) {
        console.error("Error en apiCrearSecuencia:", error);
        actualizarMovimiento("Error al guardar secuencia");
        mostrarAlerta("Error al guardar secuencia", 'error');
    }
}

async function apiEjecutarSiguientePaso() {
    if (!modoReproduccion) return; 

    console.log(`API: Ejecutando paso ${reproduccionOrdenActual} de secuencia ${reproduccionSecuenciaId}`);
    
    try {
        const response = await fetch(`${API_URL}/secuencia/repetir`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                dispositivo_id: DISPOSITIVO_ID,
                secuencia_id: reproduccionSecuenciaId,
                orden_actual: reproduccionOrdenActual,
                velocidad: velocidadActual
            })
        });

        if (!response.ok) {
            // Si la respuesta NO fue OK (ej. 500), el catch la tomará
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        
        const result = await response.json();

        // Comprobar si la secuencia terminó (Respuesta 200 OK con status "completada")
        if (result.status === "secuencia completada") {
            console.log("API: Secuencia completada");
            actualizarMovimiento("Secuencia completada");
            
            mostrarAlerta("¡Secuencia completada!", 'success');
            resetearSecuenciaPorCompleto(); 
            mostrarModal(modalReproducir, false); 
        } 
        // Comprobar si ejecutó un paso (Respuesta 200 OK con "orden_ejecutado")
        else if (result.orden_ejecutado) {
            console.log("API: Paso ejecutado", result);
            actualizarMovimiento(result.descripcion);
            reproduccionOrdenActual = result.orden_ejecutado; 

            reproduccionInterval = setTimeout(apiEjecutarSiguientePaso, 1500); 
        }
        else {
            // Respuesta 200 OK, pero JSON inesperado.
             throw new Error("Respuesta inesperada de la API al ejecutar paso.");
        }
        
    } catch (error) {
        console.error("Error en apiEjecutarSiguientePaso:", error);
        actualizarMovimiento("Error en reproducción");
        mostrarAlerta(`Error: ${error.message}`, 'error');
        resetearSecuenciaPorCompleto();
    }
}

// --- LÓGICA DE WEBSOCKET NATIVO (PUSH) ---
function connectWebSocket() {
    console.log("App Control: Intentando conectar a WebSocket en:", WEBSOCKET_URL);
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
        console.log("App Control: ¡Conectado a WebSocket Nativo!");
    };

    ws.onclose = (event) => {
        console.warn("App Control: Desconectado de WebSocket. Razón:", event.code, event.reason);
        setTimeout(connectWebSocket, 3000); // Reconectar
    };

    ws.onerror = (error) => {
        console.error("App Control: Error de WebSocket:", error);
    };

    // ¡Manejador de PUSH!
    ws.onmessage = (evento) => {
        let data;
        try {
            data = JSON.parse(evento.data);
        } catch (error) {
            console.error("Error al parsear JSON de WebSocket:", error);
            return;
        }

        console.log("App Control PUSH Recibido:", data);

        switch (data.type) {
            case "nuevo_movimiento":
            case "paso_secuencia":
                if (data.status_texto || data.descripcion) {
                    actualizarMovimiento(data.status_texto || data.descripcion);
                }
                break;

            case "nuevo_obstaculo":
                if (data.status_texto) {
                    actualizarObstaculo(data.status_texto);
                    if (modoReproduccion && reproduccionInterval) {
                        console.log("Obstáculo PUSH recibido: Pausando reproducción de secuencia.");
                        pausarSecuencia();
                        actualizarMovimiento("Obstáculo detectado! Secuencia pausada.");
                        mostrarAlerta("¡Obstáculo detectado! Secuencia pausada.", 'error');
                    }
                }
                break;
        }
    };
}


// --- EVENT LISTENERS PRINCIPALES ---

selectSecuencia.addEventListener('change', (e) => {
    const valor = e.target.value;
    if (valor === 'grabar') {
        inputNombreSecuencia.value = ""; 
        mostrarModal(modalGrabarNombre, true);
    } else if (valor === 'reproducir') {
        resetearSecuenciaPorCompleto();
        mostrarModal(modalReproducir, true);
        apiObtenerSecuencias(); 
    } else {
        resetearModoGrabacion();
    }
});

// Botones de Movimiento
document.querySelector('.lg\\:col-span-2').addEventListener('click', (e) => {
    const boton = e.target.closest('.control-button');
    if (!boton || boton.disabled) return;
    
    const idNumStr = boton.id.split('-')[1]; 
    if (idNumStr && tablaOperaciones[idNumStr]) {
        const clave = parseInt(idNumStr, 10);
        const texto = tablaOperaciones[clave];
        apiEnviarMovimiento(clave, texto);
    }
});

// Listener de Velocidad
speedControlContainer.addEventListener('click', (e) => {
    const boton = e.target.closest('.speed-button');
    if (!boton || boton.disabled) return; 

    const velocidadSeleccionada = parseInt(boton.dataset.velocidad, 10);
    velocidadActual = velocidadSeleccionada;
    console.log(`Velocidad cambiada a: ${velocidadActual}`);

    speedButtons.forEach(btn => {
        btn.classList.remove('active');
    });
    boton.classList.add('active');
});

// --- LISTENERS MODAL GRABAR NOMBRE ---
btnModalGrabarAceptar.addEventListener('click', () => {
    const nombre = inputNombreSecuencia.value.trim();
    if (nombre === "") {
        inputNombreSecuencia.classList.add('border-red-500', 'border-2');
        setTimeout(() => inputNombreSecuencia.classList.remove('border-red-500', 'border-2'), 2000);
        return;
    }
    
    modoGrabacion = true;
    nombreSecuenciaActual = nombre;
    movimientosGrabados = [];
    
    setControlesDeshabilitados(true);
    setSpeedControlsDisabled(true); // <-- ¡MODIFICACIÓN! Deshabilitar velocidad
    
    recordingControls.classList.remove('hidden');
    mostrarLive(false); 
    mostrarModal(modalGrabarNombre, false);
    actualizarMovimiento(`Listo para grabar "${nombre}"`);
});

btnModalGrabarCancelar.addEventListener('click', () => {
    mostrarModal(modalGrabarNombre, false);
    resetearModoGrabacion(); // Ya habilita la velocidad
});

// --- LISTENERS CONTROLES DE GRABACIÓN ---
btnRecordStart.addEventListener('click', () => {
    mostrarLive(true);
    console.log("Grabación iniciada (LIVE ON)");
});

btnRecordStop.addEventListener('click', async () => {
    mostrarLive(false);
    console.log("Grabación detenida. Guardando...");
    
    if (movimientosGrabados.length > 0 && nombreSecuenciaActual) {
        await apiCrearSecuencia();
    } else {
        console.log("No se grabaron movimientos. No se guardó nada.");
        actualizarMovimiento("Grabación cancelada (sin pasos).");
    }
    resetearModoGrabacion(); // Ya habilita la velocidad
});

btnRecordCancel.addEventListener('click', () => {
    resetearModoGrabacion(); // Ya habilita la velocidad
    actualizarMovimiento("Grabación cancelada.");
});

// --- LISTENERS MODAL REPRODUCCIÓN ---

btnModalReproducir.addEventListener('click', () => {
    if (modoReproduccion) return; 
    if (reproduccionOrdenActual === 0) {
        const seqId = selectSecuenciaApi.value;
        if (!seqId) {
            selectSecuenciaApi.classList.add('border-red-500', 'border-2');
            setTimeout(() => selectSecuenciaApi.classList.remove('border-red-500', 'border-2'), 2000);
            return;
        }
        reproduccionSecuenciaId = parseInt(seqId, 10);
    }
    reanudarSecuencia();
});

btnModalPausar.addEventListener('click', () => {
    pausarSecuencia();
    actualizarMovimiento("Reproducción pausada.");
});

btnModalCancelar.addEventListener('click', () => {
    resetearSecuenciaPorCompleto(); 
    mostrarModal(modalReproducir, false); 
    selectSecuencia.value = ""; 
});

// Cerrar modales al hacer clic en el overlay
document.querySelectorAll('.modal-container').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            if (modal.id === 'modal-reproducir') {
                resetearSecuenciaPorCompleto(); 
                mostrarModal(modalReproducir, false);
                selectSecuencia.value = "";
            } else if (modal.id === 'modal-grabar-nombre') {
                mostrarModal(modalGrabarNombre, false);
                resetearModoGrabacion(); // Ya habilita la velocidad
            }
        }
    });
});

// --- EJECUTAR AL INICIAR ---
(function init() {
    // 1. Cargar el estado inicial de la app (PULL)
    apiGetUltimoObstaculo(); 
    
    // 2. Iniciar la conexión WebSocket para PUSH
    connectWebSocket();
})();
