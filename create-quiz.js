// Configuración de Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Referencias a elementos del DOM
const userProfile = document.getElementById('user-profile');
const userName = document.getElementById('user-name');
const userAvatar = document.getElementById('user-avatar');
const logoutBtn = document.getElementById('logout-btn');
const quizTitle = document.getElementById('quiz-title');
const quizDescription = document.getElementById('quiz-description');
const questionsContainer = document.getElementById('questions-container');
const addQuestionBtn = document.getElementById('add-question-btn');
const saveQuizBtn = document.getElementById('save-quiz-btn');
const cancelQuizBtn = document.getElementById('cancel-quiz-btn');
const questionTemplate = document.getElementById('question-template');

// Estado de autenticación
let currentUser = null;

// Comprobar si el usuario está autenticado
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        showUserProfile(user);
    } else {
        // Redirigir al inicio si no hay usuario autenticado
        window.location.href = 'index.html';
    }
});

// Mostrar perfil de usuario
function showUserProfile(user) {
    userName.textContent = user.displayName || user.email.split('@')[0];
    userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
}

// Eventos de botones
logoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        window.location.href = 'index.html';
    }).catch(error => {
        console.error('Error al cerrar sesión:', error);
    });
});

// Agregar pregunta
addQuestionBtn.addEventListener('click', () => {
    addNewQuestion();
});

// Guardar cuestionario
saveQuizBtn.addEventListener('click', () => {
    saveQuiz();
});

// Cancelar creación
cancelQuizBtn.addEventListener('click', () => {
    if (confirm('¿Estás seguro de que quieres cancelar? Se perderán todos los cambios.')) {
        window.location.href = 'my-quizzes.html';
    }
});

// Función para agregar una nueva pregunta
function addNewQuestion() {
    const questionCount = questionsContainer.children.length + 1;
    const questionNode = document.importNode(questionTemplate.content, true);
    
    // Actualizar número de pregunta
    questionNode.querySelector('.question-number').textContent = questionCount;
    
    // Actualizar nombre del grupo de radio buttons
    const radioButtons = questionNode.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        radio.name = `correct-${questionCount}`;
    });
    
    // Evento para eliminar pregunta
    const deleteBtn = questionNode.querySelector('.delete-question');
    deleteBtn.addEventListener('click', function() {
        if (confirm('¿Estás seguro de que quieres eliminar esta pregunta?')) {
            this.closest('.question-card').remove();
            updateQuestionNumbers();
        }
    });
    
    // Evento para previsualizar imagen
    const imageInput = questionNode.querySelector('.question-image');
    const imagePreview = questionNode.querySelector('.image-preview');
    
    imageInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.createElement('img');
                img.src = e.target.result;
                imagePreview.innerHTML = '';
                imagePreview.appendChild(img);
            };
            reader.readAsDataURL(this.files[0]);
        }
    });
    
    questionsContainer.appendChild(questionNode);
}

// Actualizar números de preguntas
function updateQuestionNumbers() {
    const questions = questionsContainer.querySelectorAll('.question-card');
    questions.forEach((question, index) => {
        question.querySelector('.question-number').textContent = index + 1;
        
        // Actualizar nombre del grupo de radio buttons
        const radioButtons = question.querySelectorAll('input[type="radio"]');
        radioButtons.forEach(radio => {
            radio.name = `correct-${index + 1}`;
        });
    });
}

// Guardar cuestionario en la base de datos
async function saveQuiz() {
    const title = quizTitle.value.trim();
    if (!title) {
        alert('Por favor, ingresa un título para el cuestionario');
        return;
    }
    
    const questions = questionsContainer.querySelectorAll('.question-card');
    if (questions.length === 0) {
        alert('Por favor, agrega al menos una pregunta');
        return;
    }
    
    // Validar que todas las preguntas tengan texto y respuestas
    for (let i = 0; i < questions.length; i++) {
        const questionText = questions[i].querySelector('.question-text').value.trim();
        if (!questionText) {
            alert(`La pregunta ${i + 1} no tiene texto`);
            return;
        }
        
        const answers = questions[i].querySelectorAll('.answer-text');
        for (let j = 0; j < answers.length; j++) {
            if (!answers[j].value.trim()) {
                alert(`La respuesta ${j + 1} de la pregunta ${i + 1} está vacía`);
                return;
            }
        }
    }
    
    try {
        // Crear cuestionario
        const quizRef = await db.collection('quizzes').add({
            title: title,
            description: quizDescription.value.trim(),
            user_id: currentUser.uid,
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Procesar cada pregunta
        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const questionText = question.querySelector('.question-text').value.trim();
            const timeLimit = parseInt(question.querySelector('.time-limit').value);
            const imageFile = question.querySelector('.question-image').files[0];
            
            let imageUrl = null;
            
            // Subir imagen si existe
            if (imageFile) {
                const storageRef = storage.ref(`quiz_images/${quizRef.id}/${Date.now()}_${imageFile.name}`);
                const snapshot = await storageRef.put(imageFile);
                imageUrl = await snapshot.ref.getDownloadURL();
            }
            
            // Crear pregunta
            const questionRef = await db.collection('questions').add({
                quiz_id: quizRef.id,
                question: questionText,
                time_limit: timeLimit,
                points: 1000,
                image_url: imageUrl,
                position: i + 1,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // Obtener respuestas y la correcta
            const answerTexts = question.querySelectorAll('.answer-text');
            const correctAnswerIndex = parseInt(question.querySelector('input[type="radio"]:checked').value);
            
            // Crear respuestas
            for (let j = 0; j < answerTexts.length; j++) {
                await db.collection('answers').add({
                    question_id: questionRef.id,
                    answer: answerTexts[j].value.trim(),
                    is_correct: j === correctAnswerIndex,
                    position: j + 1
                });
            }
        }
        
        alert('¡Cuestionario guardado con éxito!');
        window.location.href = 'my-quizzes.html';
        
    } catch (error) {
        console.error('Error al guardar el cuestionario:', error);
        alert('Error al guardar el cuestionario. Inténtalo de nuevo.');
    }
}

// Agregar primera pregunta al cargar la página
addNewQuestion();