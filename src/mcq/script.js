import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  getDocs, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";


const firebaseConfig = {
  apiKey: "AIzaSyD4KvJRvfN-bVhfvQ7yb81iazQnR_wImd0",
  authDomain: "editor-a7587.firebaseapp.com",
  projectId: "editor-a7587",
  storageBucket: "editor-a7587.firebasestorage.app",
  messagingSenderId: "219682263547",
  appId: "1:219682263547:web:7b7b55420ba0422a91bb5e",
  measurementId: "G-TF8GD94RV0"
};


const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);


let QUESTIONS = [];
let index = 0; // current question index
let score = 0; // number of correct answers
const userSelections = new Map(); // questionId -> Set(indices)

// --- DOM Refs ---
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

// --- Helpers ---
const isMulti = (q) => Array.isArray(q.answer);
const eqSet = (a, b) => a.size === b.size && [...a].every(v => b.has(v));

// --- Firebase Functions ---
async function loadQuestionsFromFirestore() {
  try {
    // Show loading state
    qtext.textContent = 'Loading questions...';
    
    // Query questions collection, optionally ordered
    const q = query(collection(db, "questions"), orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);
    
    const questions = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      questions.push({
        id: doc.id, // Use Firestore document ID
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

// --- Quiz Functions ---
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

  // Determine correctness
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
    // Increase score only on the first time a question becomes correct
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
  const pct = Math.round((score / total) * 100);
  result.innerHTML = `
    <h3 style="margin:0 0 8px">Your Result</h3>
    <p>Score: <strong>${score}</strong> / ${total} (${pct}%)</p>
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
            ${q.code ? `<pre class='code'>${q.code.replace(/[<>&]/g, ch => ({'<': '&lt;', '>': '&gt;', '&': '&amp;'}[ch]))}</pre>` : ''}
            <div class="pill" style="${ok ? 'background:rgba(34,197,94,0.12);border-color:rgba(34,197,94,0.25)' : 'background:rgba(239,68,68,0.12);border-color:rgba(239,68,68,0.25)'}">${ok ? 'Correct' : 'Incorrect'}</div>
            <div><em>Your answer:</em> ${selText}</div>
            <div><em>Correct answer:</em> ${ansText}</div>
            ${q.explain ? `<div style='margin-top:6px;color:#aab3d6'>${q.explain}</div>` : ''}
          </li>`;
        }).join('')}
      </ol>
    </details>
  `;
  result.style.display = 'block';
}

// --- Event Listeners ---
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

// --- Initialize Quiz ---
async function initializeQuiz() {
  try {
    // Load questions from Firestore
    QUESTIONS = await loadQuestionsFromFirestore();
    
    // Initialize score display
    scorePill.textContent = `Score: ${score}`;
    
    // Render first question
    render();
    
  } catch (error) {
    console.error('Failed to initialize quiz:', error);
    qtext.textContent = 'Failed to load questions. Please check your internet connection and try again.';
    
    // Optionally, you could fall back to local questions.json
    fallbackToLocalQuestions();
  }
}

// Optional: Fallback to local JSON if Firestore fails
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

// Start the quiz when the page loads
initializeQuiz();