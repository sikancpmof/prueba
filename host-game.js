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
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// Referencias a elementos del DOM
const quizTitle = document.getElementById('quiz-title');
const gamePin = document.getElementById('game-pin');
const playerCount = document.getElementById('player-count');
const playersList = document.getElementById('players-list');
const startGameBtn = document.getElementById('start-game-btn');

// Pantallas del juego
const lobbyScreen = document.getElementById('lobby-screen');
const questionScreen = document.getElementById('question-screen');
const answerResultsScreen = document.getElementById('answer-results-screen');
const finalResultsScreen = document.getElementById('final-results-screen');

// Elementos de la pantalla de preguntas
const countdownTimer = document.getElementById('countdown-timer');
const currentQuestion = document.getElementById('current-question');
const questionImage = document.getElementById('question-image');
const answersCount = document.getElementById('answers-count');
const totalPlayers = document.getElementById('total-players');

// Elementos de la pantalla de resultados
const correctAnswer = document.getElementById('correct-answer');
const correctCount = document.getElementById('correct-count');
const incorrectCount = document.getElementById('incorrect-count');
const nextQuestionBtn = document.getElementById('next-question-btn');

// Elementos de la pantalla final
const firstPlace = document.getElementById('first-place');
const secondPlace = document.getElementById('second-place');
const thirdPlace = document.getElementById('third-place');
const finalScoresList = document.getElementById('final-scores-list');
const playAgainBtn = document.getElementById('play-again-btn');
const backToHomeBtn = document.getElementById('back-to-home-btn');

// Variables de estado
let currentUser = null;
let gameSessionId = null;
let quizId = null;
let questions = [];
let currentQuestionIndex = 0;
let players = [];
let playerAnswers = {};
let timerInterval = null;
let gameState = 'waiting'; // waiting, question, results, finished

// Comprobar si el usuario está autenticado
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        initializeGame();
    } else {
        // Redirigir al inicio si no hay usuario autenticado
        window.location.href = 'index.html';
    }
});

// Inicializar juego
async function initializeGame() {
    // Obtener ID del cuestionario de la URL
    const urlParams = new URLSearchParams(window.location.search);
    quizId = urlParams.get('quiz');
    
    if (!quizId) {
        alert('No se ha especificado un cuestionario');
        window.location.href = 'my-quizzes.html';
        return;
    }
    
    try {
        // Obtener información del cuestionario
        const quizDoc = await db.collection('quizzes').doc(quizId).get();
        
        if (!quizDoc.exists) {
            alert('El cuestionario no existe');
            window.location.href = 'my-quizzes.html';
            return;
        }
        
        const quizData = quizDoc.data();
        quizTitle.textContent = quizData.title;
        
        // Generar PIN aleatorio de 6 dígitos
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        gamePin.textContent = pin;
        
        // Crear sesión de juego
        const gameSessionRef = await db.collection('game_sessions').add({
            quiz_id: quizId,
            host_id: currentUser.uid,
            game_pin: pin,
            status: 'waiting',
            current_question_index: 0,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        gameSessionId = gameSessionRef.id;
        
        // Crear referencia en tiempo real para los jugadores
        const gameRef = rtdb.ref(`games/${gameSessionId}`);
        await gameRef.set({
            status: 'waiting',
            players: {},
            current_question: null,
            answers: {}
        });
        
        // Escuchar cambios en los jugadores
        rtdb.ref(`games/${gameSessionId}/players`).on('value', snapshot => {
            const playersData = snapshot.val() || {};
            players = Object.values(playersData);
            
            // Actualizar contador y lista de jugadores
            playerCount.textContent = players.length;
            renderPlayersList();
            
            // Habilitar botón de inicio si hay al menos un jugador
            startGameBtn.disabled = players.length === 0;
            
            // Actualizar contador de jugadores en pantalla de pregunta
            if (totalPlayers) {
                totalPlayers.textContent = players.length;
            }
        });
        
        // Escuchar cambios en las respuestas
        rtdb.ref(`games/${gameSessionId}/answers`).on('value', snapshot => {
            const answersData = snapshot.val() || {};
            playerAnswers = answersData;
            
            // Actualizar contador de respuestas
            if (answersCount) {
                const answerCount = Object.keys(playerAnswers).length;
                answersCount.textContent = answerCount;
                
                // Si todos han respondido, mostrar resultados automáticamente
                if (answerCount === players.length && gameState === 'question') {
                    clearInterval(timerInterval);
                    showQuestionResults();
                }
            }
        });
        
        // Cargar preguntas
        await loadQuestions();
        
        // Eventos de botones
        startGameBtn.addEventListener('click', startGame);
        nextQuestionBtn.addEventListener('click', showNextQuestion);
        playAgainBtn.addEventListener('click', restartGame);
        backToHomeBtn.addEventListener('click', () => {
            window.location.href = 'my-quizzes.html';
        });
        
    } catch (error) {
        console.error('Error al inicializar el juego:', error);
        alert('Error al inicializar el juego. Inténtalo de nuevo.');
    }
}

// Cargar preguntas del cuestionario
async function loadQuestions() {
    try {
        const questionsSnapshot = await db.collection('questions')
            .where('quiz_id', '==', quizId)
            .orderBy('position')
            .get();
        
        const questionsData = [];
        
        for (const doc of questionsSnapshot.docs) {
            const questionData = doc.data();
            const answersSnapshot = await db.collection('answers')
                .where('question_id', '==', doc.id)
                .orderBy('position')
                .get();
            
            const answers = answersSnapshot.docs.map(answerDoc => ({
                id: answerDoc.id,
                ...answerDoc.data()
            }));
            
            questionsData.push({
                id: doc.id,
                ...questionData,
                answers
            });
        }
        
        questions = questionsData;
        
    } catch (error) {
        console.error('Error al cargar preguntas:', error);
        alert('Error al cargar preguntas. Inténtalo de nuevo.');
    }
}

// Renderizar lista de jugadores
function renderPlayersList() {
    playersList.innerHTML = '';
    
    players.forEach(player => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item';
        playerItem.textContent = player.nickname;
        playersList.appendChild(playerItem);
    });
}

// Iniciar juego
async function startGame() {
    if (players.length === 0) {
        alert('No hay jugadores en la sala');
        return;
    }
    
    try {
        // Actualizar estado de la sesión
        await db.collection('game_sessions').doc(gameSessionId).update({
            status: 'active',
            started_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar estado en tiempo real
        await rtdb.ref(`games/${gameSessionId}`).update({
            status: 'active'
        });
        
        // Mostrar primera pregunta
        currentQuestionIndex = 0;
        showQuestion();
        
    } catch (error) {
        console.error('Error al iniciar el juego:', error);
        alert('Error al iniciar el juego. Inténtalo de nuevo.');
    }
}

// Mostrar pregunta actual
async function showQuestion() {
    if (currentQuestionIndex >= questions.length) {
        endGame();
        return;
    }
    
    // Cambiar pantalla
    lobbyScreen.classList.add('hidden');
    questionScreen.classList.remove('hidden');
    answerResultsScreen.classList.add('hidden');
    
    // Obtener pregunta actual
    const question = questions[currentQuestionIndex];
    
    // Actualizar interfaz
    currentQuestion.textContent = question.question;
    
    // Mostrar/ocultar imagen
    if (question.image_url) {
        questionImage.classList.remove('hidden');
        questionImage.querySelector('img').src = question.image_url;
    } else {
        questionImage.classList.add('hidden');
    }
    
    // Mostrar respuestas
    for (let i = 0; i < question.answers.length; i++) {
        const answerElement = document.getElementById(`answer-${i}`);
        answerElement.textContent = question.answers[i].answer;
    }
    
    // Actualizar estado
    gameState = 'question';
    
    // Limpiar respuestas anteriores
    playerAnswers = {};
    await rtdb.ref(`games/${gameSessionId}/answers`).set({});
    
    // Actualizar pregunta actual en tiempo real
    await rtdb.ref(`games/${gameSessionId}`).update({
        current_question: {
            index: currentQuestionIndex,
            id: question.id,
            text: question.question,
            answers: question.answers.map(a => ({
                id: a.id,
                text: a.answer
            }))
        }
    });
    
    // Iniciar temporizador
    let timeLeft = question.time_limit;
    countdownTimer.textContent = timeLeft;
    
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        countdownTimer.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            showQuestionResults();
        }
    }, 1000);
}

// Mostrar resultados de la pregunta
async function showQuestionResults() {
    if (gameState !== 'question') return;
    
    // Cambiar pantalla
    questionScreen.classList.add('hidden');
    answerResultsScreen.classList.remove('hidden');
    
    // Cambiar estado
    gameState = 'results';
    
    // Obtener pregunta actual
    const question = questions[currentQuestionIndex];
    
    // Encontrar respuesta correcta
    const correctAnswerObj = question.answers.find(a => a.is_correct);
    
    // Mostrar respuesta correcta
    correctAnswer.textContent = correctAnswerObj.answer;
    correctAnswer.className = 'answer-block';
    
    // Determinar clase de color para la respuesta correcta
    const answerIndex = question.answers.findIndex(a => a.is_correct);
    const colorClasses = ['answer-red', 'answer-blue', 'answer-yellow', 'answer-green'];
    correctAnswer.classList.add(colorClasses[answerIndex]);
    
    // Contar respuestas correctas e incorrectas
    let correct = 0;
    let incorrect = 0;
    
    // Calcular puntuaciones
    for (const playerId in playerAnswers) {
        const playerAnswer = playerAnswers[playerId];
        const isCorrect = playerAnswer.answer_id === correctAnswerObj.id;
        
        if (isCorrect) {
            correct++;
            // Calcular puntos basados en tiempo de respuesta
            const points = Math.round(question.points * (1 - playerAnswer.response_time / question.time_limit / 2));
            
            // Actualizar puntuación del jugador
            const playerRef = players.find(p => p.id === playerId);
            if (playerRef) {
                playerRef.score = (playerRef.score || 0) + points;
                
                // Actualizar en tiempo real
                await rtdb.ref(`games/${gameSessionId}/players/${playerId}`).update({
                    score: playerRef.score
                });
                
                // Guardar en Firestore
                await db.collection('participants').doc(playerId).update({
                    score: playerRef.score
                });
            }
        } else {
            incorrect++;
        }
    }
    
    // Actualizar contadores
    correctCount.textContent = correct;
    incorrectCount.textContent = incorrect;
    
    // Actualizar estado en tiempo real
    await rtdb.ref(`games/${gameSessionId}`).update({
        status: 'results'
    });
}

// Mostrar siguiente pregunta
function showNextQuestion() {
    currentQuestionIndex++;
    
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        endGame();
    }
}

// Finalizar juego
async function endGame() {
    try {
        // Actualizar estado de la sesión
        await db.collection('game_sessions').doc(gameSessionId).update({
            status: 'completed',
            ended_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Actualizar estado en tiempo real
        await rtdb.ref(`games/${gameSessionId}`).update({
            status: 'completed'
        });
        
        // Cambiar pantalla
        lobbyScreen.classList.add('hidden');
        questionScreen.classList.add('hidden');
        answerResultsScreen.classList.add('hidden');
        finalResultsScreen.classList.remove('hidden');
        
        // Ordenar jugadores por puntuación
        players.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        // Mostrar podio
        if (players.length > 0) {
            const first = players[0];
            firstPlace.querySelector('.player-name').textContent = first.nickname;
            firstPlace.querySelector('.player-score').textContent = first.score || 0;
        }
        
        if (players.length > 1) {
            const second = players[1];
            secondPlace.querySelector('.player-name').textContent = second.nickname;
            secondPlace.querySelector('.player-score').textContent = second.score || 0;
        }
        
        if (players.length > 2) {
            const third = players[2];
            thirdPlace.querySelector('.player-name').textContent = third.nickname;
            thirdPlace.querySelector('.player-score').textContent = third.score || 0;
        }
        
        // Mostrar tabla de puntuaciones
        finalScoresList.innerHTML = '';
        
        players.forEach((player, index) => {
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            
            const rankSpan = document.createElement('span');
            rankSpan.className = 'score-rank';
            rankSpan.textContent = `${index + 1}.`;
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'score-name';
            nameSpan.textContent = player.nickname;
            
            const scoreSpan = document.createElement('span');
            scoreSpan.className = 'score-value';
            scoreSpan.textContent = player.score || 0;
            
            scoreItem.appendChild(rankSpan);
            scoreItem.appendChild(nameSpan);
            scoreItem.appendChild(scoreSpan);
            
            finalScoresList.appendChild(scoreItem);
        });
        
    } catch (error) {
        console.error('Error al finalizar el juego:', error);
        alert('Error al finalizar el juego. Inténtalo de nuevo.');
    }
}

// Reiniciar juego
async function restartGame() {
    try {
        // Crear nueva sesión de juego
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        
        const gameSessionRef = await db.collection('game_sessions').add({
            quiz_id: quizId,
            host_id: currentUser.uid,
            game_pin: pin,
            status: 'waiting',
            current_question_index: 0,
            created_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Redirigir a la nueva sesión
        window.location.href = `host-game.html?quiz=${quizId}&session=${gameSessionRef.id}`;
        
    } catch (error) {
        console.error('Error al reiniciar el juego:', error);
        alert('Error al reiniciar el juego. Inténtalo de nuevo.');
    }
}