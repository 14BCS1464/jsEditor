const firebaseConfig = {
  apiKey: "AIzaSyD4KvJRvfN-bVhfvQ7yb81iazQnR_wImd0",
  authDomain: "editor-a7587.firebaseapp.com",
  projectId: "editor-a7587",
  storageBucket: "editor-a7587.firebasestorage.app",
  messagingSenderId: "219682263547",
  appId: "1:219682263547:web:7b7b55420ba0422a91bb5e",
  measurementId: "G-TF8GD94RV0"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const analytics = firebase.analytics();

// Global variables
let QUESTIONS = [];
let index = 0; 
let score = 0; 
const userSelections = new Map(); // questionId -> Set(indices)

// DOM References
const qtext = document.getElementById('qtext');
const qcode = document.getElementById('qcode');
const optionsEl = document.getElementById('options');
const feedback = document.getElementById('feedback');
const result = document.getElementById('result');
const counter = document.getElementById('counter');
const bar = document.getElementById('bar');
const scorePill = document.getElementById('score');

const prevBtn = document.getElementById('prevBtn');
const skipBtn = document.getElementById('skipBtn');
const checkBtn = document.getElementById('checkBtn');
const nextBtn = document.getElementById('nextBtn');
const finishBtn = document.getElementById('finishBtn');

// Modal elements
const scoreModal = document.getElementById('scoreModal');
const modalContent = document.getElementById('modalContent');
const scoreIcon = document.getElementById('scoreIcon');
const modalTitle = document.getElementById('modalTitle');
const modalScore = document.getElementById('modalScore');
const modalMessage = document.getElementById('modalMessage');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');
const reviewBtn = document.getElementById('reviewBtn');

// Utility functions
const isMulti = (q) => Array.isArray(q.answer);
const eqSet = (a, b) => a.size === b.size && [...a].every(v => b.has(v));

// Score popup functionality
function showScorePopup(score, total, percentage) {
  let config = getScoreConfig(percentage);

  modalContent.className = 'modal-content ' + config.class;
  scoreIcon.textContent = config.icon;
  modalTitle.textContent = config.title;
  modalScore.textContent = `${score}/${total} (${percentage}%)`;
  modalMessage.textContent = config.message;

  if (percentage >= 90) {
    createConfetti();
  }

  scoreModal.style.display = 'block';

  if (percentage < 40) {
    modalContent.style.animation = 'modalSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), shake 0.5s ease-in-out 1s';
  }

  playScoreSound(percentage);
}

function createConfetti() {
  const colors = ['#ff6b6b', '#ffd93d', '#6bcf7f', '#4d9de0', '#ff8cc8', '#a8e6cf'];

  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
    confetti.style.animationDelay = Math.random() * 2 + 's';
    modalContent.appendChild(confetti);

    setTimeout(() => {
      if (confetti.parentNode) {
        confetti.parentNode.removeChild(confetti);
      }
    }, 5000);
  }
}

function playScoreSound(percentage) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    if (percentage >= 90) {
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
    } else if (percentage >= 70) {
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // A4
      oscillator.frequency.setValueAtTime(554.37, audioContext.currentTime + 0.1); // C#5
    } else if (percentage >= 50) {
      oscillator.frequency.setValueAtTime(349.23, audioContext.currentTime); // F4
    } else {
      oscillator.frequency.setValueAtTime(261.63, audioContext.currentTime); // C4
      oscillator.frequency.setValueAtTime(246.94, audioContext.currentTime + 0.1); // B3
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    console.log('Audio not available');
  }
}

function getScoreConfig(percentage) {
  if (percentage >= 90) {
    return {
      class: 'score-excellent',
      icon: '🏆',
      title: 'OUTSTANDING!',
      message: '🌟 Absolutely incredible! You\'ve mastered JavaScript fundamentals like a true pro! 🚀'
    };
  } else if (percentage >= 70) {
    return {
      class: 'score-good',
      icon: '🎯',
      title: 'EXCELLENT!',
      message: '💪 Great work! You have a solid understanding of JavaScript. Keep up the momentum! ⚡'
    };
  } else if (percentage >= 50) {
    return {
      class: 'score-average',
      icon: '📈',
      title: 'GOOD EFFORT!',
      message: '🎓 You\'re on the right track! Review the concepts and come back stronger! 💡'
    };
  } else {
    return {
      class: 'score-poor',
      icon: '💪',
      title: 'KEEP PUSHING!',
      message: '🌱 Every expert was once a beginner! Practice makes perfect - you\'ve got this! 🔥'
    };
  }
}

// Quiz functionality
function resetQuiz() {
  index = 0;
  score = 0;
  userSelections.clear();
  sessionStorage.clear();
  scoreModal.style.display = 'none';
  result.style.display = 'none';
  scorePill.textContent = `Score: ${score}`;
  render();
}

function goHome() {
  window.location.href = '/';
}

function showReviewAnswers() {
  scoreModal.style.display = 'none';
  result.style.display = 'block';
  result.scrollIntoView({ behavior: 'smooth' });
}

async function loadQuestionsFromFirestore() {
  try {
    qtext.textContent = 'Loading questions...';
    const querySnapshot = await db.collection('questions').orderBy('order', 'asc').get();
    const questions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      questions.push({
        id: doc.id,
        ...data
      });
    });
    if (questions.length === 0) {
      throw new Error('No questions found in Firestore');
    }
    return questions;
  } catch (error) {
    console.error('Error loading questions from Firestore:', error);
    throw error;
  }
}

function render() {
  const q = QUESTIONS[index];
  counter.textContent = `Q ${index + 1}/${QUESTIONS.length}`;
  bar.style.width = `${((index + 1) / QUESTIONS.length) * 100}%`;
  feedback.style.display = 'none';
  feedback.textContent = '';
  feedback.className = 'feedback';

  qtext.textContent = q.question;
  if (q.code) {
    qcode.classList.remove('hidden');
    qcode.textContent = q.code;
  } else {
    qcode.classList.add('hidden');
    qcode.textContent = '';
  }

  optionsEl.innerHTML = '';
  const saved = userSelections.get(q.id) || new Set();
  q.options.forEach((opt, i) => {
    const id = `opt-${q.id}-${i}`;
    const wrapper = document.createElement('label');
    wrapper.className = 'opt';
    const input = document.createElement('input');
    input.type = isMulti(q) ? 'checkbox' : 'radio';
    input.name = `q-${q.id}`;
    input.value = i;
    input.checked = saved.has(i);
    input.addEventListener('change', () => {
      const set = userSelections.get(q.id) || new Set();
      if (isMulti(q)) {
        input.checked ? set.add(i) : set.delete(i);
      } else {
        set.clear();
        set.add(i);
      }
      userSelections.set(q.id, set);
    });
    const txt = document.createElement('div');
    txt.textContent = opt;
    wrapper.appendChild(input);
    wrapper.appendChild(txt);
    optionsEl.appendChild(wrapper);
  });

  prevBtn.disabled = index === 0;
  nextBtn.disabled = index >= QUESTIONS.length - 1;
}

function checkAnswer() {
  const q = QUESTIONS[index];
  const sel = userSelections.get(q.id) || new Set();
  if (sel.size === 0) {
    feedback.classList.add('bad');
    feedback.textContent = 'Please select at least one option.';
    feedback.style.display = 'block';
    return;
  }

  let correct = false;
  if (isMulti(q)) {
    const ans = new Set(q.answer);
    correct = eqSet(sel, ans);
  } else {
    correct = sel.has(Number(q.answer));
  }

  if (correct) {
    feedback.classList.add('ok');
    feedback.textContent = 'Correct! ' + (q.explain || '');
    const key = `scored-${q.id}`;
    if (!sessionStorage.getItem(key)) {
      score += 1;
      scorePill.textContent = `Score: ${score}`;
      sessionStorage.setItem(key, '1');
    }
  } else {
    feedback.classList.add('bad');
    feedback.textContent = 'Not quite. ' + (q.explain || '');
  }
  feedback.style.display = 'block';
}

function finishQuiz() {
  const total = QUESTIONS.length;
  const percentage = total > 0 ? Math.round((score / total) * 10000) / 100 : 0;

  showScorePopup(score, total, percentage);

  result.innerHTML = `
    <h3 style="margin:0 0 8px">Your Result</h3>
    <p>Score: <strong>${score}</strong> / ${total} (${percentage}%)</p>
    <details>
      <summary>Review answers</summary>
      <ol style="margin-top:10px; line-height:1.7">
        ${QUESTIONS.map(q => {
          const sel = [...(userSelections.get(q.id) || new Set())];
          const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
          const ok = eqSet(new Set(sel), new Set(ans));
          const selText = sel.length ? sel.map(i => q.options[i]).join(', ') : '—';
          const ansText = ans.map(i => q.options[i]).join(', ');
          return `<li>
            <div><strong>${q.question}</strong></div>
            ${q.code ? `<pre class='code'>${q.code.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]))}</pre>` : ''}
            <div class="pill" style="${ok ? 'background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.25)' : 'background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.25)'}">${ok ? 'Correct' : 'Incorrect'}</div>
            <div><em>Your answer:</em> ${selText}</div>
            <div><em>Correct answer:</em> ${ansText}</div>
            ${q.explain ? `<div style='margin-top:6px;color:#aab3d6'>${q.explain}</div>` : ''}
          </li>`;
        }).join('')}
      </ol>
    </details>
  `;
}

// Event Listeners
prevBtn.addEventListener('click', () => {
  if (index > 0) {
    index--;
    render();
  }
});

nextBtn.addEventListener('click', () => {
  if (index < QUESTIONS.length - 1) {
    index++;
    render();
  }
});

skipBtn.addEventListener('click', () => {
  if (index < QUESTIONS.length - 1) {
    index++;
    render();
  }
});

checkBtn.addEventListener('click', checkAnswer);
finishBtn.addEventListener('click', finishQuiz);

retryBtn.addEventListener('click', resetQuiz);
homeBtn.addEventListener('click', goHome);
reviewBtn.addEventListener('click', showReviewAnswers);

scoreModal.addEventListener('click', (e) => {
  if (e.target === scoreModal) {
    scoreModal.style.display = 'none';
  }
});

// Initialize quiz
async function initializeQuiz() {
  try {
    QUESTIONS = await loadQuestionsFromFirestore();
    scorePill.textContent = `Score: ${score}`;
    render();
  } catch (error) {
    console.error('Failed to load from Firestore:', error);
    await fallbackToLocalQuestions();
  }
}

async function fallbackToLocalQuestions() {
  try {
    const response = await fetch('questions.json');
    const data = await response.json();
    QUESTIONS = data;
    scorePill.textContent = `Score: ${score}`;
    render();
    console.log('Loaded questions from local JSON as fallback');
  } catch (error) {
    console.error('Both Firestore and local fallback failed:', error);
    qtext.textContent = 'Unable to load questions from any source.';
  }
}

// Start the quiz
initializeQuiz();