// --- CONFIGURACIÓN DE API ---
// Ajusta la IP si cambia en AWS
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

// Modal de Reproducción
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

// --- DATOS DE MAPEO ---
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

let velocidadActual = 1; 
let isManiobraRunning = false; 

// --- FUNCIONES DE UI ---
function actualizarMovimiento(movimiento) {
    // Aquí se verán los pasos de la evasión ("Giro 90", etc.)
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
    // Solo bloqueamos el selector de dispositivo y secuencia, NO la velocidad
    selectDispositivo.disabled = deshabilitar;
    selectSecuencia.disabled = deshabilitar;
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

function mostrarAlerta(mensaje, tipo = 'success', duracion = 3000) {
    alertBox.textContent = mensaje;
    alertBox.className = `alert-toast ${tipo}`; 
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
        actualizarMovimiento(`Pausado (paso ${reproduccionOrdenActual})`);
        
        btnModalReproducir.disabled = false; 
        btnModalReproducir.textContent = "Reanudar";
        btnModalPausar.disabled = true;
    }
}

function reanudarSecuencia() {
    if (reproduccionSecuenciaId !== null) {
        modoReproduccion = true; 
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

        if (!response.ok) throw new Error(`Error ${response.status}`);
        if (modoGrabacion) {
            movimientosGrabados.push(clave);
        }
    } catch (error) {
        console.error("Error:", error);
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
        actualizarObstaculo('Error al consultar');
    }
}

async function apiObtenerSecuencias() {
    selectSecuenciaApi.innerHTML = '<option value="">Cargando...</option>';
    try {
        const response = await fetch(`${API_URL}/secuencia/historial/${DISPOSITIVO_ID}`);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        const secuencias = await response.json();
        
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
        selectSecuenciaApi.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function apiCrearSecuencia() {
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
        if (!response.ok) throw new Error(`Error ${response.status}`);
        
        actualizarMovimiento(`Secuencia "${nombreSecuenciaActual}" guardada.`);
        mostrarAlerta(`Secuencia "${nombreSecuenciaActual}" guardada.`, 'success');
    } catch (error) {
        actualizarMovimiento("Error al guardar secuencia");
        mostrarAlerta("Error al guardar secuencia", 'error');
    }
}

async function apiEjecutarSiguientePaso() {
    if (!modoReproduccion) return; 

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
            const errorData = await response.json();
            throw new Error(errorData.error || `Error ${response.status}`);
        }
        
        const result = await response.json();

        // Si la secuencia terminó
        if (result.status === "secuencia completada") {
            actualizarMovimiento("Secuencia completada");
            mostrarAlerta("¡Secuencia completada!", 'success');
            resetearSecuenciaPorCompleto(); 
            mostrarModal(modalReproducir, false); 
        } 
        // Si se ejecutó un paso
        else if (result.orden_ejecutado) {
            actualizarMovimiento(result.descripcion);
            reproduccionOrdenActual = result.orden_ejecutado; 
            reproduccionInterval = setTimeout(apiEjecutarSiguientePaso, 1500); 
        }
        
    } catch (error) {
        actualizarMovimiento("Error en reproducción");
        mostrarAlerta(`Error: ${error.message}`, 'error');
        resetearSecuenciaPorCompleto();
    }
}

/**
 * Llama a la API de liberación (maniobra) automáticamente.
 * NO cambiamos el texto del obstáculo aquí (se queda con el nombre real).
 */
async function apiEjecutarManiobraAutomatica(obstaculoClave) {
    if (isManiobraRunning) return; 
    isManiobraRunning = true;
    
    // Bloqueamos selector de dispositivo pero NO la velocidad
    setControlesDeshabilitados(true); 
    
    mostrarAlerta(`¡Obstáculo detectado! Iniciando maniobra automática.`, 'error', 4000);

    try {
        // 1. Llamar a la API que ejecuta la maniobra en el backend
        const response = await fetch(`${API_URL}/obstaculo/liberar`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                dispositivo_id: DISPOSITIVO_ID,
                obstaculo_clave: obstaculoClave
            })
        });

        if (!response.ok) throw new Error(`Error ${response.status} al iniciar maniobra.`);
        
        // El backend ahora empezará a mandar PUSH "nuevo_movimiento" por cada paso.
        // Nosotros solo observamos.

    } catch (error) {
        console.error("Error maniobra:", error);
        mostrarAlerta("Error al iniciar maniobra.", 'error');
    } finally {
        // Liberamos los controles al terminar la solicitud HTTP
        // (aunque la maniobra siga en el backend, el usuario puede retomar control si quiere)
        setControlesDeshabilitados(false); 
    }
}


// --- WEBSOCKET (PUSH) ---
function connectWebSocket() {
    console.log("Conectando WebSocket:", WEBSOCKET_URL);
    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
        console.log("¡WebSocket Conectado!");
        if (!modoGrabacion && !modoReproduccion) { 
             setControlesDeshabilitados(false); 
        }
    };

    ws.onclose = (event) => {
        console.warn("WS Desconectado. Razón:", event.code);
        setControlesDeshabilitados(true); // Bloquear si no hay conexión
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error("WS Error:", error);
    };

    // ¡AQUÍ LLEGAN LOS DATOS!
    ws.onmessage = (evento) => {
        let data;
        try {
            data = JSON.parse(evento.data);
        } catch (error) { return; }

        console.log("PUSH:", data);

        switch (data.type) {
            // CASO 1: Movimiento (Manual, Secuencia o Maniobra de Evasión)
            case "nuevo_movimiento":
            case "paso_secuencia":
                if (data.status_texto || data.descripcion) {
                    // Actualizamos "Último Movimiento" en pantalla
                    actualizarMovimiento(data.status_texto || data.descripcion);
                }
                
                // Detectar fin de maniobra (cuando llega "Detener" - clave 3)
                if (data.status_clave === 3 && isManiobraRunning) {
                     isManiobraRunning = false;
                     console.log("Maniobra finalizada (Stop recibido).");
                }
                break;

            // CASO 2: Obstáculo detectado por el carrito
            case "nuevo_obstaculo":
                if (data.status_texto) {
                    // 1. Poner el nombre real del obstáculo en pantalla
                    actualizarObstaculo(data.status_texto);
                    
                    // 2. Si hay secuencia corriendo, PAUSARLA
                    if (modoReproduccion && reproduccionInterval) {
                        pausarSecuencia();
                        mostrarAlerta("¡Obstáculo detectado! Secuencia pausada.", 'error');
                    }

                    // 3. ¡DISPARAR LA MANIOBRA DE EVASIÓN!
                    // Esto llama al backend, que luego mandará los PUSH de movimiento
                    apiEjecutarManiobraAutomatica(data.status_clave);
                }
                break;
        }
    };
}


// --- EVENT LISTENERS ---

selectSecuencia.addEventListener('change', (e) => {
    const valor = e.target.value;
    
    setControlesDeshabilitados(false); 
    resetearModoGrabacion();

    if (valor === 'grabar') {
        setControlesDeshabilitados(true); 
        inputNombreSecuencia.value = ""; 
        mostrarModal(modalGrabarNombre, true);
        
    } else if (valor === 'reproducir') {
        setControlesDeshabilitados(true);
        resetearSecuenciaPorCompleto();
        mostrarModal(modalReproducir, true);
        apiObtenerSecuencias(); 
    } 
});

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

// Selector de Velocidad (SIEMPRE ACTIVO)
speedControlContainer.addEventListener('click', (e) => {
    const boton = e.target.closest('.speed-button');
    if (!boton) return;

    const velocidadSeleccionada = parseInt(boton.dataset.velocidad, 10);
    velocidadActual = velocidadSeleccionada;
    console.log(`Velocidad cambiada a: ${velocidadActual}`);

    speedButtons.forEach(btn => btn.classList.remove('active'));
    boton.classList.add('active');
});

// Modales y Grabación
btnModalGrabarAceptar.addEventListener('click', () => {
    const nombre = inputNombreSecuencia.value.trim();
    if (nombre === "") return;
    
    modoGrabacion = true;
    nombreSecuenciaActual = nombre;
    movimientosGrabados = [];
    
    recordingControls.classList.remove('hidden');
    mostrarLive(true); 
    mostrarModal(modalGrabarNombre, false);
    actualizarMovimiento(`Listo para grabar "${nombre}"`);
});

btnModalGrabarCancelar.addEventListener('click', () => {
    mostrarModal(modalGrabarNombre, false);
    resetearModoGrabacion(); 
});

btnRecordStart.addEventListener('click', () => {
    mostrarLive(true);
});

btnRecordStop.addEventListener('click', async () => {
    mostrarLive(false);
    if (movimientosGrabados.length > 0 && nombreSecuenciaActual) {
        await apiCrearSecuencia();
    }
    resetearModoGrabacion(); 
});

btnRecordCancel.addEventListener('click', () => {
    resetearModoGrabacion(); 
    actualizarMovimiento("Grabación cancelada.");
});

// Modal Reproducción
btnModalReproducir.addEventListener('click', () => {
    if (modoReproduccion) return; 
    if (reproduccionOrdenActual === 0) {
        const seqId = selectSecuenciaApi.value;
        if (!seqId) return;
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

// Cerrar modales
document.querySelectorAll('.modal-container').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            if (modal.id === 'modal-reproducir') {
                resetearSecuenciaPorCompleto(); 
                mostrarModal(modalReproducir, false);
                selectSecuencia.value = "";
            } else if (modal.id === 'modal-grabar-nombre') {
                mostrarModal(modalGrabarNombre, false);
                resetearModoGrabacion(); 
            }
        }
    });
});

// --- INIT ---
(function init() {
    apiGetUltimoObstaculo(); 
    connectWebSocket();
    setControlesDeshabilitados(true); // Bloqueo inicial hasta conexión
})();