import { soundFx } from './audio.js';
import { StorageManager } from './storage.js';
import { QuizAPI } from './api.js';

class TimedQuizApp {
  constructor() {
    // App State
    this.profile = StorageManager.getProfile();
    this.categories = [];
    this.questions = [];
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.userAnswers = []; // { question, selected, correct, timeTaken, points }

    // Timer State
    this.durationPerQuestion = 15; // seconds default
    this.timeRemaining = 15;
    this.timerInterval = null;
    this.questionStartTime = 0;

    // Quiz Options
    this.quizConfig = {
      category: 'any',
      difficulty: 'medium',
      amount: 10,
      duration: 15
    };

    this.initElements();
    this.bindEvents();
    this.initApp();
  }

  initElements() {
    // Screens
    this.screens = {
      setup: document.getElementById('setup-screen'),
      quiz: document.getElementById('quiz-screen'),
      results: document.getElementById('results-screen'),
      leaderboard: document.getElementById('leaderboard-screen'),
      labReport: document.getElementById('lab-report-screen')
    };

    // Navigation Buttons
    this.navBtns = {
      home: document.getElementById('nav-home-btn'),
      leaderboard: document.getElementById('nav-leaderboard-btn'),
      report: document.getElementById('nav-report-btn'),
      soundToggle: document.getElementById('sound-toggle-btn'),
      themeToggle: document.getElementById('theme-toggle-btn')
    };

    // Setup Screen Elements
    this.setupForm = document.getElementById('quiz-setup-form');
    this.playerNameInput = document.getElementById('player-name-input');
    this.avatarSelect = document.getElementById('avatar-select');
    this.categorySelect = document.getElementById('category-select');
    this.difficultySelect = document.getElementById('difficulty-select');
    this.amountSelect = document.getElementById('amount-select');
    this.durationSelect = document.getElementById('duration-select');
    this.startBtn = document.getElementById('start-quiz-btn');

    // Quiz Elements
    this.questionText = document.getElementById('question-text');
    this.categoryBadge = document.getElementById('category-badge');
    this.difficultyBadge = document.getElementById('difficulty-badge');
    this.questionProgress = document.getElementById('question-progress');
    this.optionsContainer = document.getElementById('options-container');
    this.nextBtn = document.getElementById('next-question-btn');
    this.explanationCard = document.getElementById('explanation-card');
    this.explanationText = document.getElementById('explanation-text');
    this.scoreDisplay = document.getElementById('live-score-display');
    this.streakBadge = document.getElementById('streak-badge');
    this.streakCount = document.getElementById('streak-count');

    // Timer Elements
    this.timerText = document.getElementById('timer-text');
    this.timerCircle = document.getElementById('timer-circle');

    // Results Elements
    this.resultScore = document.getElementById('result-score');
    this.resultAccuracy = document.getElementById('result-accuracy');
    this.resultTime = document.getElementById('result-time');
    this.resultStreak = document.getElementById('result-streak');
    this.resultsList = document.getElementById('results-breakdown-list');
    this.restartBtn = document.getElementById('restart-quiz-btn');
    this.viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');

    // Leaderboard Elements
    this.leaderboardTableBody = document.getElementById('leaderboard-table-body');
    this.leaderboardSearch = document.getElementById('leaderboard-search');
    this.clearLeaderboardBtn = document.getElementById('clear-leaderboard-btn');
    this.exportDataBtn = document.getElementById('export-data-btn');
    this.importFileInput = document.getElementById('import-file-input');
  }

  async initApp() {
    // Apply saved profile and theme settings
    this.playerNameInput.value = this.profile.name;
    this.avatarSelect.value = this.profile.avatar || '⚡';
    soundFx.toggleSound(this.profile.sound);
    this.updateSoundToggleUI();
    this.applyTheme(this.profile.theme || 'dark');

    // Populate categories from Async REST API
    try {
      this.categories = await QuizAPI.fetchCategories();
      this.categorySelect.innerHTML = this.categories
        .map(c => `<option value="${c.id}">${c.name}</option>`)
        .join('');
    } catch (e) {
      console.warn('Could not populate categories:', e);
    }

    // Check for active unfinished quiz session in LocalStorage (Recovery feature)
    const activeSession = StorageManager.getActiveSession();
    if (activeSession && confirm('An unfinished quiz session was found! Would you like to resume it?')) {
      this.resumeSession(activeSession);
      return;
    } else {
      StorageManager.clearActiveSession();
    }

    this.showScreen('setup');
  }

  bindEvents() {
    // Navigation
    this.navBtns.home.addEventListener('click', () => this.showScreen('setup'));
    this.navBtns.leaderboard.addEventListener('click', () => {
      this.loadAndRenderLeaderboard();
      this.showScreen('leaderboard');
    });
    this.navBtns.report.addEventListener('click', () => this.showScreen('labReport'));

    // Toggles
    this.navBtns.soundToggle.addEventListener('click', () => {
      this.profile.sound = !this.profile.sound;
      soundFx.toggleSound(this.profile.sound);
      StorageManager.saveProfile({ sound: this.profile.sound });
      this.updateSoundToggleUI();
    });

    this.navBtns.themeToggle.addEventListener('click', () => {
      const newTheme = this.profile.theme === 'dark' ? 'light' : 'dark';
      this.profile.theme = newTheme;
      StorageManager.saveProfile({ theme: newTheme });
      this.applyTheme(newTheme);
    });

    // Form Submit -> Start Quiz
    this.setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.startQuiz();
    });

    // Next Question Button
    this.nextBtn.addEventListener('click', () => this.handleNextQuestion());

    // Results screen buttons
    this.restartBtn.addEventListener('click', () => this.showScreen('setup'));
    this.viewLeaderboardBtn.addEventListener('click', () => {
      this.loadAndRenderLeaderboard();
      this.showScreen('leaderboard');
    });

    // Leaderboard actions
    this.leaderboardSearch.addEventListener('input', () => this.filterLeaderboard());
    this.clearLeaderboardBtn.addEventListener('click', async () => {
      if (confirm('Are you sure you want to clear all leaderboard entries?')) {
        StorageManager.clearLocalLeaderboard();
        await QuizAPI.resetLeaderboard();
        this.loadAndRenderLeaderboard();
      }
    });

    this.exportDataBtn.addEventListener('click', () => {
      const dataStr = StorageManager.exportDataJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timed_quiz_leaderboard_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    this.importFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (StorageManager.importDataJSON(event.target.result)) {
            alert('Leaderboard data imported successfully!');
            this.loadAndRenderLeaderboard();
          } else {
            alert('Invalid backup file format.');
          }
        };
        reader.readAsText(file);
      }
    });
  }

  showScreen(screenName) {
    Object.keys(this.screens).forEach(key => {
      if (key === screenName) {
        this.screens[key].classList.remove('hidden');
        this.screens[key].classList.add('animate-pop-in');
      } else {
        this.screens[key].classList.add('hidden');
        this.screens[key].classList.remove('animate-pop-in');
      }
    });
    window.scrollTo(0, 0);
  }

  applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      this.navBtns.themeToggle.innerHTML = '🌙';
    } else {
      document.documentElement.classList.remove('dark');
      this.navBtns.themeToggle.innerHTML = '☀️';
    }
  }

  updateSoundToggleUI() {
    this.navBtns.soundToggle.innerHTML = this.profile.sound ? '🔊' : '🔇';
  }

  async startQuiz() {
    // Save User Profile to LocalStorage
    this.profile.name = this.playerNameInput.value.trim() || 'Player One';
    this.profile.avatar = this.avatarSelect.value;
    StorageManager.saveProfile(this.profile);

    this.quizConfig = {
      category: this.categorySelect.value,
      difficulty: this.difficultySelect.value,
      amount: parseInt(this.amountSelect.value, 10),
      duration: parseInt(this.durationSelect.value, 10)
    };

    this.durationPerQuestion = this.quizConfig.duration;

    // Reset Quiz State
    this.currentIndex = 0;
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.userAnswers = [];
    this.scoreDisplay.textContent = '0';
    this.streakCount.textContent = '0';
    this.streakBadge.classList.add('hidden');

    // Show Loading Spinner on Button
    this.startBtn.disabled = true;
    this.startBtn.innerHTML = `
      <svg class="animate-spin h-5 w-5 mr-2 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg> Fetching REST API Questions...
    `;

    try {
      const apiResult = await QuizAPI.fetchQuestions(this.quizConfig);
      this.questions = apiResult.questions;

      if (!this.questions || this.questions.length === 0) {
        throw new Error('No questions returned');
      }

      this.showScreen('quiz');
      this.renderQuestion();
    } catch (err) {
      alert(`Error starting quiz: ${err.message}`);
    } finally {
      this.startBtn.disabled = false;
      this.startBtn.innerHTML = '🚀 Start Timed Quiz';
    }
  }

  resumeSession(session) {
    this.questions = session.questions;
    this.currentIndex = session.currentIndex;
    this.score = session.score;
    this.streak = session.streak;
    this.maxStreak = session.maxStreak;
    this.correctCount = session.correctCount;
    this.userAnswers = session.userAnswers;
    this.quizConfig = session.quizConfig;
    this.durationPerQuestion = session.quizConfig.duration;

    this.scoreDisplay.textContent = this.score.toString();
    this.updateStreakUI();
    this.showScreen('quiz');
    this.renderQuestion();
  }

  persistSessionState() {
    StorageManager.saveActiveSession({
      questions: this.questions,
      currentIndex: this.currentIndex,
      score: this.score,
      streak: this.streak,
      maxStreak: this.maxStreak,
      correctCount: this.correctCount,
      userAnswers: this.userAnswers,
      quizConfig: this.quizConfig
    });
  }

  renderQuestion() {
    this.clearIntervals();

    const currentQ = this.questions[this.currentIndex];
    this.questionStartTime = Date.now();

    // Update Progress UI
    this.questionProgress.textContent = `Question ${this.currentIndex + 1} of ${this.questions.length}`;
    this.questionText.textContent = currentQ.question;
    this.categoryBadge.textContent = currentQ.category || 'General';
    this.difficultyBadge.textContent = (currentQ.difficulty || 'medium').toUpperCase();

    // Render Options
    this.optionsContainer.innerHTML = currentQ.options.map((opt, idx) => `
      <button 
        data-index="${idx}" 
        data-option="${this.escapeHtml(opt)}"
        class="option-btn w-full text-left p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-gray-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 font-medium transition-all transform hover:-translate-y-0.5 flex items-center justify-between group shadow-sm"
      >
        <span class="flex items-center space-x-3">
          <span class="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-sm flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            ${String.fromCharCode(65 + idx)}
          </span>
          <span class="text-gray-900 dark:text-gray-100 text-base">${this.escapeHtml(opt)}</span>
        </span>
        <span class="status-icon text-xl opacity-0 transition-opacity"></span>
      </button>
    `).join('');

    // Attach click events to option buttons
    const optionBtns = this.optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const selected = btn.getAttribute('data-option');
        this.handleAnswerSelection(selected, btn);
      });
    });

    // Hide Next button & Explanation card initially
    this.nextBtn.classList.add('hidden');
    this.explanationCard.classList.add('hidden');

    // Start Question Timer
    this.startTimer();
    this.persistSessionState();
  }

  startTimer() {
    this.timeRemaining = this.durationPerQuestion;
    this.updateTimerUI(this.timeRemaining);

    const circumference = 2 * Math.PI * 40; // R = 40
    this.timerCircle.style.strokeDasharray = `${circumference}`;

    const tickRateMs = 100;
    const totalTicks = (this.durationPerQuestion * 1000) / tickRateMs;
    let ticksElapsed = 0;

    this.timerInterval = setInterval(() => {
      ticksElapsed++;
      const secondsLeft = Math.max(0, this.durationPerQuestion - (ticksElapsed * tickRateMs / 1000));
      this.timeRemaining = secondsLeft;

      // Update timer ring stroke offset
      const progressRatio = secondsLeft / this.durationPerQuestion;
      const offset = circumference - (progressRatio * circumference);
      this.timerCircle.style.strokeDashoffset = offset;

      // Color warning threshold
      if (secondsLeft <= 3.5) {
        this.timerCircle.style.stroke = '#ef4444'; // Red alert
        this.timerText.classList.add('animate-pulse-urgent', 'text-red-500');
        if (ticksElapsed % 10 === 0) soundFx.playTick(); // Tick sound on seconds
      } else {
        this.timerCircle.style.stroke = '#6366f1'; // Indigo normal
        this.timerText.classList.remove('animate-pulse-urgent', 'text-red-500');
      }

      this.timerText.textContent = Math.ceil(secondsLeft);

      if (secondsLeft <= 0) {
        this.clearIntervals();
        soundFx.playTimeout();
        this.handleAnswerSelection(null, null); // Time out answer
      }
    }, tickRateMs);
  }

  clearIntervals() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  handleAnswerSelection(selectedOption, selectedBtn) {
    this.clearIntervals();

    const currentQ = this.questions[this.currentIndex];
    const isCorrect = selectedOption === currentQ.correct_answer;
    const timeTaken = Math.min(this.durationPerQuestion, (Date.now() - this.questionStartTime) / 1000);

    // Score Calculation: Base Points (100) + Speed Bonus (remaining sec * 15) * Streak Multiplier
    let points = 0;
    if (isCorrect) {
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;
      this.correctCount++;

      const streakMultiplier = this.streak >= 3 ? 1.5 : (this.streak >= 2 ? 1.2 : 1.0);
      const speedBonus = Math.round(this.timeRemaining * 15);
      points = Math.round((100 + speedBonus) * streakMultiplier);
      this.score += points;

      soundFx.playCorrect();
    } else {
      this.streak = 0;
      soundFx.playWrong();
    }

    this.scoreDisplay.textContent = this.score.toString();
    this.updateStreakUI();

    // Record answer history
    this.userAnswers.push({
      question: currentQ.question,
      selected: selectedOption || '(Timed Out)',
      correct: currentQ.correct_answer,
      isCorrect,
      timeTaken: Number(timeTaken.toFixed(1)),
      points,
      explanation: currentQ.explanation
    });

    // Disable all option buttons and highlight results
    const optionBtns = this.optionsContainer.querySelectorAll('.option-btn');
    optionBtns.forEach(btn => {
      btn.disabled = true;
      const optText = btn.getAttribute('data-option');
      const iconSpan = btn.querySelector('.status-icon');

      if (optText === currentQ.correct_answer) {
        btn.classList.remove('bg-white', 'dark:bg-gray-800', 'border-gray-200', 'dark:border-gray-700');
        btn.classList.add('bg-emerald-100', 'dark:bg-emerald-950/80', 'border-emerald-500', 'text-emerald-900', 'dark:text-emerald-200');
        iconSpan.textContent = '✅';
        iconSpan.classList.remove('opacity-0');
      } else if (optText === selectedOption && !isCorrect) {
        btn.classList.remove('bg-white', 'dark:bg-gray-800', 'border-gray-200', 'dark:border-gray-700');
        btn.classList.add('bg-rose-100', 'dark:bg-rose-950/80', 'border-rose-500', 'text-rose-900', 'dark:text-rose-200');
        iconSpan.textContent = '❌';
        iconSpan.classList.remove('opacity-0');
      }
    });

    // Show Explanation Card
    this.explanationText.textContent = currentQ.explanation || `Correct Answer: "${currentQ.correct_answer}"`;
    this.explanationCard.classList.remove('hidden');

    // Show Next Question button
    this.nextBtn.classList.remove('hidden');
    this.nextBtn.textContent = (this.currentIndex === this.questions.length - 1) ? '🏆 View Final Results' : 'Next Question ➔';

    this.persistSessionState();
  }

  updateStreakUI() {
    if (this.streak >= 2) {
      this.streakCount.textContent = `${this.streak}x`;
      this.streakBadge.classList.remove('hidden');
      this.streakBadge.classList.add('animate-pop-in');
    } else {
      this.streakBadge.classList.add('hidden');
    }
  }

  handleNextQuestion() {
    this.currentIndex++;

    if (this.currentIndex < this.questions.length) {
      this.renderQuestion();
    } else {
      this.finishQuiz();
    }
  }

  async finishQuiz() {
    this.clearIntervals();
    StorageManager.clearActiveSession();

    const totalQuestions = this.questions.length;
    const accuracy = Math.round((this.correctCount / totalQuestions) * 100);
    const totalTimeSpent = this.userAnswers.reduce((sum, a) => sum + a.timeTaken, 0);

    // Display Results
    this.resultScore.textContent = this.score.toString();
    this.resultAccuracy.textContent = `${accuracy}%`;
    this.resultTime.textContent = `${totalTimeSpent.toFixed(1)}s`;
    this.resultStreak.textContent = `${this.maxStreak} 🔥`;

    // Render detailed question review
    this.resultsList.innerHTML = this.userAnswers.map((a, idx) => `
      <div class="p-4 rounded-xl border ${a.isCorrect ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30'} flex flex-col space-y-2">
        <div class="flex items-start justify-between">
          <span class="font-semibold text-sm ${a.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}">
            Q${idx + 1}. ${a.isCorrect ? 'Correct (+ ' + a.points + ' pts)' : 'Incorrect (0 pts)'}
          </span>
          <span class="text-xs text-gray-500 font-mono">${a.timeTaken}s</span>
        </div>
        <p class="text-gray-900 dark:text-gray-100 font-medium text-sm">${a.question}</p>
        <div class="text-xs space-y-1">
          <p><span class="font-semibold text-gray-600 dark:text-gray-400">Your Answer:</span> <span class="${a.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${this.escapeHtml(a.selected)}</span></p>
          ${!a.isCorrect ? `<p><span class="font-semibold text-gray-600 dark:text-gray-400">Correct Answer:</span> <span class="text-emerald-600 dark:text-emerald-400">${this.escapeHtml(a.correct)}</span></p>` : ''}
        </div>
      </div>
    `).join('');

    soundFx.playFanfare();
    this.showScreen('results');

    // Save Score to LocalStorage & Express Backend Leaderboard
    const entry = {
      name: this.profile.name,
      avatar: this.profile.avatar,
      score: this.score,
      accuracy,
      timeSpent: Math.round(totalTimeSpent),
      category: this.questions[0]?.category || 'General',
      difficulty: this.quizConfig.difficulty
    };

    StorageManager.saveScoreLocally(entry);
    await QuizAPI.submitScore(entry);
  }

  async loadAndRenderLeaderboard() {
    this.leaderboardTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">
          Loading leaderboard data...
        </td>
      </tr>
    `;

    // Retrieve both server and local leaderboard entries
    const serverEntries = await QuizAPI.fetchLeaderboard();
    const localEntries = StorageManager.getLocalLeaderboard();

    // Merge and deduplicate
    const combined = [...serverEntries, ...localEntries];
    const uniqueMap = new Map();
    combined.forEach(item => {
      const key = `${item.name}-${item.score}-${item.date || item.id}`;
      if (!uniqueMap.has(key)) uniqueMap.set(key, item);
    });

    this.currentLeaderboardData = Array.from(uniqueMap.values());
    this.currentLeaderboardData.sort((a, b) => b.score - a.score || a.timeSpent - b.timeSpent);

    this.renderLeaderboardTable(this.currentLeaderboardData);
  }

  renderLeaderboardTable(data) {
    if (!data || data.length === 0) {
      this.leaderboardTableBody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-8 text-gray-500 dark:text-gray-400">
            No high scores recorded yet. Be the first to play!
          </td>
        </tr>
      `;
      return;
    }

    this.leaderboardTableBody.innerHTML = data.map((entry, idx) => {
      const rankBadge = idx === 0 ? '🥇' : (idx === 1 ? '🥈' : (idx === 2 ? '🥉' : `#${idx + 1}`));
      const rowBg = idx < 3 ? 'bg-amber-500/5 dark:bg-amber-500/10 font-medium' : '';

      return `
        <tr class="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${rowBg}">
          <td class="py-3 px-4 text-center text-base">${rankBadge}</td>
          <td class="py-3 px-4 flex items-center space-x-3">
            <span class="text-2xl">${entry.avatar || '👤'}</span>
            <span class="text-gray-900 dark:text-gray-100 font-semibold">${this.escapeHtml(entry.name)}</span>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-base">${entry.score}</td>
          <td class="py-3 px-4">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
              ${entry.accuracy}%
            </span>
          </td>
          <td class="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">${entry.category || 'General'}</td>
          <td class="py-3 px-4 text-xs font-mono text-gray-500">${entry.timeSpent || 0}s</td>
        </tr>
      `;
    }).join('');
  }

  filterLeaderboard() {
    const query = this.leaderboardSearch.value.toLowerCase().trim();
    if (!query) {
      this.renderLeaderboardTable(this.currentLeaderboardData);
      return;
    }
    const filtered = this.currentLeaderboardData.filter(item => 
      item.name.toLowerCase().includes(query) || 
      (item.category && item.category.toLowerCase().includes(query))
    );
    this.renderLeaderboardTable(filtered);
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Initialize App when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new TimedQuizApp();
});
