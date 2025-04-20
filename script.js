// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBsWi_15CU2PFwkbLViDPDxIEykBy6PY34",
    authDomain: "oasis-juvenil.firebaseapp.com",
    projectId: "oasis-juvenil",
    storageBucket: "oasis-juvenil.appspot.com",
    messagingSenderId: "542689479282",
    appId: "1:542689479282:web:5a76fc4cc49dd872a390eb",
    measurementId: "G-9GL67X6872"
  };
  
  // Inicializar Firebase
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  
  // Referencias a elementos del DOM
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const userProfile = document.getElementById('user-profile');
  const userName = document.getElementById('user-name');
  const userAvatar = document.getElementById('user-avatar');
  const hostBtn = document.getElementById('host-btn');
  const joinBtn = document.getElementById('join-btn');
  const joinGamePanel = document.getElementById('join-game-panel');
  const gamePin = document.getElementById('game-pin');
  const nickname = document.getElementById('nickname');
  const enterGameBtn = document.getElementById('enter-game-btn');
  const loginModal = document.getElementById('login-modal');
  const registerModal = document.getElementById('register-modal');
  const googleLoginBtn = document.getElementById('google-login');
  const googleRegisterBtn = document.getElementById('google-register');
  const showRegisterLink = document.getElementById('show-register');
  const showLoginLink = document.getElementById('show-login');
  const closeModalBtns = document.querySelectorAll('.close-modal');
  const emailLoginForm = document.getElementById('email-login-form');
  const emailRegisterForm = document.getElementById('email-register-form');
  
  // Estado de autenticación
  let currentUser = null;
  
  // Crear elemento para mensajes de bienvenida
  const welcomeMessage = document.createElement('div');
  welcomeMessage.className = 'welcome-message';
  welcomeMessage.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #46178f;
      color: white;
      padding: 15px 30px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-weight: bold;
      text-align: center;
      display: none;
      animation: fadeInOut 4s ease-in-out;
  `;
  
  // Crear estilo para la animación
  const style = document.createElement('style');
  style.textContent = `
      @keyframes fadeInOut {
          0% { opacity: 0; transform: translate(-50%, -20px); }
          15% { opacity: 1; transform: translate(-50%, 0); }
          85% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -20px); }
      }
  `;
  document.head.appendChild(style);
  document.body.appendChild(welcomeMessage);
  
  // Función para mostrar mensaje de bienvenida
  function showWelcomeMessage(name) {
      welcomeMessage.textContent = `¡Bienvenido a OJJ1:9, ${name}! 🎮`;
      welcomeMessage.style.display = 'block';
      
      // Ocultar mensaje después de la animación
      setTimeout(() => {
          welcomeMessage.style.display = 'none';
      }, 4000);
  }
  
  // Comprobar si el usuario está autenticado
  auth.onAuthStateChanged(user => {
      if (user) {
          currentUser = user;
          showUserProfile(user);
          
          // Mostrar mensaje de bienvenida solo si es un inicio de sesión nuevo
          if (sessionStorage.getItem('newLogin') === 'true') {
              const displayName = user.displayName || user.email || 'Invitado';
              showWelcomeMessage(displayName);
              sessionStorage.removeItem('newLogin');
          }
      } else {
          hideUserProfile();
      }
  });
  
  // Mostrar perfil de usuario
  function showUserProfile(user) {
      if (loginBtn) loginBtn.classList.add('hidden');
      if (userProfile) {
          userProfile.classList.remove('hidden');
          userName.textContent = user.displayName || user.email || 'Invitado';
          userAvatar.src = user.photoURL || 'https://via.placeholder.com/40';
      }
  }
  
  // Ocultar perfil de usuario
  function hideUserProfile() {
      if (loginBtn) loginBtn.classList.remove('hidden');
      if (userProfile) userProfile.classList.add('hidden');
  }
  
  // Función para inicio de sesión anónimo con nombre personalizado
  function signInAnonymously(displayName = 'Invitado') {
      // Marcar como nuevo inicio de sesión
      sessionStorage.setItem('newLogin', 'true');
      
      auth.signInAnonymously()
          .then((userCredential) => {
              // Actualizar perfil con nombre personalizado
              return userCredential.user.updateProfile({
                  displayName: displayName
              });
          })
          .then(() => {
              console.log('Usuario anónimo conectado');
              loginModal.classList.add('hidden');
              registerModal.classList.add('hidden');
          })
          .catch((error) => {
              console.error('Error al iniciar sesión anónima:', error);
              alert('Error al iniciar sesión. Inténtalo de nuevo.');
          });
  }
  
  // Eventos de botones
  if (loginBtn) {
      loginBtn.addEventListener('click', () => {
          loginModal.classList.remove('hidden');
      });
  }
  
  if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
          auth.signOut().then(() => {
              console.log('Usuario desconectado');
          }).catch(error => {
              console.error('Error al cerrar sesión:', error);
          });
      });
  }
  
  if (hostBtn) {
      hostBtn.addEventListener('click', () => {
          if (currentUser) {
              window.location.href = 'my-quizzes.html';
          } else {
              loginModal.classList.remove('hidden');
          }
      });
  }
  
  if (joinBtn) {
      joinBtn.addEventListener('click', () => {
          joinGamePanel.classList.remove('hidden');
          joinBtn.classList.add('hidden');
      });
  }
  
  if (enterGameBtn) {
      enterGameBtn.addEventListener('click', () => {
          const pin = gamePin.value.trim();
          const playerName = nickname.value.trim();
          
          if (!pin) {
              alert('Por favor, ingresa el PIN del juego');
              return;
          }
          
          if (!playerName) {
              alert('Por favor, ingresa tu nombre');
              return;
          }
          
          // Si no hay usuario, iniciar sesión anónima con el nombre ingresado
          if (!currentUser) {
              signInAnonymously(playerName);
              // Esperar a que se complete el inicio de sesión
              const unsubscribe = auth.onAuthStateChanged(user => {
                  if (user) {
                      unsubscribe();
                      continueJoinGame(pin, playerName);
                  }
              });
          } else {
              continueJoinGame(pin, playerName);
          }
      });
  }
  
  // Función para continuar el proceso de unirse al juego
  function continueJoinGame(pin, playerName) {
      // Verificar si el PIN existe
      db.collection('game_sessions')
          .where('game_pin', '==', pin)
          .where('status', '==', 'waiting')
          .get()
          .then(snapshot => {
              if (snapshot.empty) {
                  alert('PIN de juego no válido o el juego ya ha comenzado');
                  return;
              }
              
              const gameSession = snapshot.docs[0];
              
              // Guardar información en localStorage para la página de juego
              localStorage.setItem('gamePin', pin);
              localStorage.setItem('playerName', playerName);
              localStorage.setItem('gameSessionId', gameSession.id);
              
              // Registrar al jugador en la sesión de juego
              return db.collection('participants').add({
                  game_session_id: gameSession.id,
                  user_id: currentUser ? currentUser.uid : null,
                  nickname: playerName,
                  score: 0,
                  created_at: firebase.firestore.FieldValue.serverTimestamp()
              });
          })
          .then(participantRef => {
              if (participantRef) {
                  localStorage.setItem('participantId', participantRef.id);
                  window.location.href = 'play-game.html';
              }
          })
          .catch(error => {
              console.error('Error al unirse al juego:', error);
              alert('Error al unirse al juego. Inténtalo de nuevo.');
          });
  }
  
  // Eventos de modales
  if (showRegisterLink) {
      showRegisterLink.addEventListener('click', e => {
          e.preventDefault();
          loginModal.classList.add('hidden');
          registerModal.classList.remove('hidden');
      });
  }
  
  if (showLoginLink) {
      showLoginLink.addEventListener('click', e => {
          e.preventDefault();
          registerModal.classList.add('hidden');
          loginModal.classList.remove('hidden');
      });
  }
  
  closeModalBtns.forEach(btn => {
      btn.addEventListener('click', () => {
          loginModal.classList.add('hidden');
          registerModal.classList.add('hidden');
      });
  });
  
  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', e => {
      if (e.target === loginModal) {
          loginModal.classList.add('hidden');
      }
      if (e.target === registerModal) {
          registerModal.classList.add('hidden');
      }
  });
  
  // Autenticación con Google
  if (googleLoginBtn) {
      googleLoginBtn.addEventListener('click', () => {
          // Marcar como nuevo inicio de sesión
          sessionStorage.setItem('newLogin', 'true');
          
          const provider = new firebase.auth.GoogleAuthProvider();
          auth.signInWithPopup(provider)
              .then(result => {
                  loginModal.classList.add('hidden');
              })
              .catch(error => {
                  console.error('Error al iniciar sesión con Google:', error);
                  // Si falla, usar autenticación anónima como respaldo
                  const emailInput = document.getElementById('email');
                  let displayName = 'Invitado';
                  
                  if (emailInput && emailInput.value) {
                      const emailParts = emailInput.value.split('@');
                      if (emailParts.length > 0) {
                          displayName = emailParts[0];
                      }
                  }
                  
                  signInAnonymously(displayName);
              });
      });
  }
  
  if (googleRegisterBtn) {
      googleRegisterBtn.addEventListener('click', () => {
          // Marcar como nuevo inicio de sesión
          sessionStorage.setItem('newLogin', 'true');
          
          const provider = new firebase.auth.GoogleAuthProvider();
          auth.signInWithPopup(provider)
              .then(result => {
                  registerModal.classList.add('hidden');
              })
              .catch(error => {
                  console.error('Error al registrarse con Google:', error);
                  // Si falla, usar autenticación anónima como respaldo
                  const nameInput = document.getElementById('reg-name');
                  let displayName = 'Invitado';
                  
                  if (nameInput && nameInput.value) {
                      displayName = nameInput.value;
                  }
                  
                  signInAnonymously(displayName);
              });
      });
  }
  
  // Formularios de inicio de sesión y registro
  if (emailLoginForm) {
      emailLoginForm.addEventListener('submit', e => {
          e.preventDefault();
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          
          // Marcar como nuevo inicio de sesión
          sessionStorage.setItem('newLogin', 'true');
          
          auth.signInWithEmailAndPassword(email, password)
              .then(userCredential => {
                  loginModal.classList.add('hidden');
              })
              .catch(error => {
                  console.error('Error al iniciar sesión:', error);
                  alert('Error al iniciar sesión: ' + error.message);
              });
      });
  }
  
  if (emailRegisterForm) {
      emailRegisterForm.addEventListener('submit', e => {
          e.preventDefault();
          const name = document.getElementById('reg-name').value;
          const email = document.getElementById('reg-email').value;
          const password = document.getElementById('reg-password').value;
          const confirmPassword = document.getElementById('reg-confirm-password').value;
          
          if (password !== confirmPassword) {
              alert('Las contraseñas no coinciden');
              return;
          }
          
          // Marcar como nuevo inicio de sesión
          sessionStorage.setItem('newLogin', 'true');
          
          auth.createUserWithEmailAndPassword(email, password)
              .then(userCredential => {
                  return userCredential.user.updateProfile({
                      displayName: name
                  });
              })
              .then(() => {
                  registerModal.classList.add('hidden');
              })
              .catch(error => {
                  console.error('Error al registrarse:', error);
                  alert('Error al registrarse: ' + error.message);
              });
      });
  }