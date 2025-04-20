// Configuración de Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID",
    databaseURL: "YOUR_DATABASE_URL"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const rtdb = firebase.database();

// Referencias a elementos del DOM
const playerName = document.getElementById('player-name');
const playerScore = document.getElementById('player-score');
const playerInitial = document.getElementById('player-initial');

// Pantallas del juego
const waitingScreen = document.getElementById('waiting-screen');
const questionScreen = document.getElementById('question-screen');
const answerWaitingScreen = document.getElementById('answer-waiting-screen');
const answerResultScreen = document.getElementById('answer-result-screen');
const correctAnswerScreen = document.getElementById('correct-answer-screen');
const wrongAnswerScreen = document.getElementById('wrong-answer-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// Elementos de la pantalla de preguntas
const questionNumber = document.getElementById('question-number');
const countdownTimer = document.getElementById('countdown-timer');
const answerButtons = [
    document.getElementById('player-answer-0'),
    document.getElementById('player-answer-1'),
    document.getElementById('player-answer-2'),
    document.getElementById('player-answer-3')
];

// Elementos de la pantalla de resultados
const pointsEarned = document.getElementById('points-earned');
const correctAnswerText = document.getElementById('correct-answer-text');

// Elementos de la pantalla final
const finalRankPosition = document.getElementById('final-rank-position');
const totalPlayers = document.getElementById('total-players');
const finalScore = document.getElementById('final-score');
const backToHomeBtn = document.getElementById('back-to-home-btn');

// Variables de estado
let gamePin = null;
let nickname = null;
let gameSessionId = null;
let participantId = null;
let currentQuestion = null;
let score = 0;
let timerInterval = null;
let startTime = 0;

// Inicializar juego
function initializeGame() {
    // Obtener datos del localStorage
    gamePin = localStorage.getItem('gamePin');
    nickname = localStorage.getItem('playerName');
    gameSessionId = localStorage.getItem('gameSessionId');
    participantId = localStorage.getItem('participantId');
    
    if (!gamePin || !nickname || !gameSessionId || !participantId) {
        alert('Error al cargar los datos del juego');
        window.location.href = 'index.html';
        return;
    }
    
    // Actualizar interfaz
    playerName.textContent = nickname;
    playerScore.textContent = '0 pts';
    playerInitial.textContent = nickname.charAt(0).toUpperCase();
    
    // Registrar jugador en tiempo real
    rtdb.ref(`games/${gameSessionId}/players/${participantId}`).set({
        id: participantId,
        nickname: nickname,
        score: 0
    });
    
    // Escuchar cambios en el estado del juego
    rtdb.ref(`games/${gameSessionId}/status`).on('value', snapshot => {
        const status = snapshot.val();
        
        if (status === 'active') {
            // El juego ha comenzado
            document.getElementById('waiting-message').textContent = '¡El juego está comenzando!';
        } else if (status === 'completed') {
            // El juego ha terminado
            showGameOver();
        }
    });
    
    // Escuchar cambios en la pregunta actual
    rtdb.ref(`games/${gameSessionId}/current_question`).on('value', snapshot => {
        const questionData = snapshot.val();
        
        if (questionData) {
            currentQuestion = questionData;
            showQuestion(questionData);
        }
    });
    
    // Escuchar cambios en la puntuación
    rtdb.ref(`games/${gameSessionId}/players/${participantId}/score`).on('value', snapshot => {
        score = snapshot.val() || 0;
        playerScore.textContent = `${score} pts`;
    });
    
    // Evento para volver al inicio
    backToHomeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });
}

// Mostrar pregunta
function showQuestion(questionData) {
    // Cambiar pantalla
    waitingScreen.classList.add('hidden');
    questionScreen.classList.remove('hidden');
    answerWaitingScreen.classList.add('hidden');
    answerResultScreen.classList.add('hidden');
    
    // Actualizar número de pregunta
    questionNumber.textContent = `Pregunta ${questionData.index + 1}`;
    
    // Mostrar respuestas
    for (let i = 0; i < questionData.answers.length; i++) {
        const button = answerButtons[i];
        button.querySelector('.answer-text').textContent = questionData.answers[i].text;
        
        // Limpiar eventos anteriores
        button.replaceWith(button.cloneNode(true));
        answerButtons[i] = document.getElementById(`player-answer-${i}`);
        
        // Agregar evento de clic
        answerButtons[i].addEventListener('click', () => {
            submitAnswer(questionData.answers[i].id);
        });
    }
    
    // Iniciar temporizador
    startTime = Date.now();
    
    // Habilitar botones
    answerButtons.forEach(button => {
        button.disabled = false;
    });
}

// Enviar respuesta
async function submitAnswer(answerId) {
    // Calcular tiempo de respuesta
    const responseTime = (Date.now() - startTime) / 1000;
    
    // Deshabilitar botones
    answerButtons.forEach(button => {
        button.disabled = true;
    });
    
    // Cambiar pantalla
    questionScreen.classList.add('hidden');
    answerWaitingScreen.classList.remove('hidden');
    
    // Guardar respuesta
    await rtdb.ref(`games/${gameSessionId}/answers/${participantId}`).set({
        answer_id: answerId,
        response_time: responseTime
    });
    
    // Escuchar cambios en el estado del juego para mostrar resultados
    const statusRef = rtdb.ref(`games/${gameSessionId}/status`);
    statusRef.on('value', snapshot => {
        const status = snapshot.val();
        
        if (status === 'results') {
            statusRef.off('value');
            showAnswerResult(answerId);
        }
    });
}

// Mostrar resultado de la respuesta
async function showAnswerResult(answerId) {
    // Cambiar pantalla
    answerWaitingScreen.classList.add('hidden');
    answerResultScreen.classList.remove('hidden');
    
    // Obtener respuesta correcta
    const correctAnswer = currentQuestion.answers.find(a => {
        // Buscar en Firestore si la respuesta es correcta
        return rtdb.ref(`games/${gameSessionId}/correct_answer`).once('value')
            .then(snapshot => snapshot.val() === a.id);
    });
    
    // Verificar si la respuesta es correcta
    const isCorrect = answerId === correctAnswer?.id;
    
    if (isCorrect) {
        // Mostrar pantalla de respuesta correcta
        correctAnswerScreen.classList.remove('hidden');
        wrongAnswerScreen.classList.add('hidden');
        
        // Obtener puntos ganados
        const playerRef = rtdb.ref(`games/${gameSessionId}/players/${participantId}`);
        const previousScore = await playerRef.child('previous_score').once('value').then(snap => snap.val() || 0);
        const currentScore = await playerRef.child('score').once('value').then(snap => snap.val() || 0);
        
        const earned = currentScore - previousScore;
        pointsEarned.textContent = earned;
    } else {
        // Mostrar pantalla de respuesta incorrecta
        correctAnswerScreen.classList.add('hidden');
        wrongAnswerScreen.classList.remove('hidden');
        
        // Mostrar respuesta correcta
        if (correctAnswer) {
            correctAnswerText.textContent = correctAnswer.text;
        }
    }
    
    // Escuchar cambios en la pregunta para volver a la pantalla de espera
    const questionRef = rtdb.ref(`games/${gameSessionId}/current_question`);
    const currentIndex = currentQuestion.index;
    
    questionRef.on('value', snapshot => {
        const questionData = snapshot.val();
        
        if (!questionData || questionData.index !== currentIndex) {
            questionRef.off('value');
            waitingScreen.classList.remove('hidden');
            answerResultScreen.classList.add('hidden');
        }
    });
}

// Mostrar pantalla de fin de juego
async function showGameOver() {
    // Cambiar pantalla
    waitingScreen.classList.add('hidden');
    questionScreen.classList.add('hidden');
    answerWaitingScreen.classList.add('hidden');
    answerResultScreen.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
    
    // Obtener clasificación final
    const playersSnapshot = await rtdb.ref(`games/${gameSessionId}/players`).once('value');
    const players = Object.values(playersSnapshot.val() || {});
    
    // Ordenar por puntuación
    players.sort((a, b) => (b.score || 0) - (a.score || 0));
    
    // Encontrar posición del jugador
    const playerIndex = players.findIndex(p => p.id === participantId);
    const position = playerIndex + 1;
    
    // Mostrar posición
    finalRankPosition.textContent = `${position}º`;
    totalPlayers.textContent = players.length;
    
    // Mostrar puntuación final
    finalScore.textContent = score;
}

// Iniciar juego al cargar la página
window.addEventListener('DOMContentLoaded', initializeGame);