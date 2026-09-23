import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEADERBOARD_FILE = path.join(__dirname, '../data/leaderboard.json');

// Helper to decode HTML entities returned by Open Trivia DB
function decodeHTMLEntities(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&ouml;/g, 'ö')
    .replace(/&uuml;/g, 'ü')
    .replace(/&deg;/g, '°')
    .replace(/&pi;/g, 'π')
    .replace(/&micro;/g, 'µ')
    .replace(/&hellip;/g, '...');
}

// Fisher-Yates shuffle helper
function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Offline / Fallback Question Bank
const FALLBACK_QUESTIONS = [
  {
    id: "fb-1",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "medium",
    question: "Which data structure uses FIFO (First In, First Out) ordering?",
    correct_answer: "Queue",
    incorrect_answers: ["Stack", "Binary Tree", "Hash Table"],
    explanation: "A Queue enforces FIFO structure where items added first are processed first."
  },
  {
    id: "fb-2",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "easy",
    question: "What does HTML stand for in web development?",
    correct_answer: "HyperText Markup Language",
    incorrect_answers: [
      "HighTech Modern Language",
      "Hyperlink Text Management Logic",
      "Home Tool Markup Language"
    ],
    explanation: "HTML stands for HyperText Markup Language and structures web documents."
  },
  {
    id: "fb-3",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "easy",
    question: "Which HTTP status code signifies a successful '200 OK' response?",
    correct_answer: "200",
    incorrect_answers: ["404", "500", "301"],
    explanation: "200 OK indicates that an HTTP request has succeeded."
  },
  {
    id: "fb-4",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "medium",
    question: "In JavaScript, which method converts a JSON string into a JavaScript object?",
    correct_answer: "JSON.parse()",
    incorrect_answers: ["JSON.stringify()", "JSON.toObject()", "Object.fromJSON()"],
    explanation: "JSON.parse() parses a JSON string into a native JavaScript object."
  },
  {
    id: "fb-5",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "hard",
    question: "What is the time complexity of searching an item in a balanced Binary Search Tree (BST)?",
    correct_answer: "O(log n)",
    incorrect_answers: ["O(1)", "O(n)", "O(n log n)"],
    explanation: "A balanced BST halves the search space at each step, yielding logarithmic O(log n) time complexity."
  },
  {
    id: "fb-6",
    category: "General Knowledge",
    type: "multiple",
    difficulty: "easy",
    question: "Which planet in our solar system is known as the Red Planet?",
    correct_answer: "Mars",
    incorrect_answers: ["Venus", "Jupiter", "Saturn"],
    explanation: "Mars appears red due to iron oxide (rust) on its surface."
  },
  {
    id: "fb-7",
    category: "General Knowledge",
    type: "multiple",
    difficulty: "medium",
    question: "Which web browser feature allows client-side key-value storage across sessions without expiration?",
    correct_answer: "localStorage API",
    incorrect_answers: ["sessionStorage API", "HTTP Cookie", "IndexedDB Cache"],
    explanation: "localStorage stores data with no expiration time until explicitly cleared."
  },
  {
    id: "fb-8",
    category: "General Knowledge",
    type: "multiple",
    difficulty: "medium",
    question: "What handles asynchronous non-blocking I/O operations in Node.js?",
    correct_answer: "Event Loop (libuv)",
    incorrect_answers: ["Multi-threading Manager", "Apache Worker", "Synchronous Scheduler"],
    explanation: "Node.js relies on an Event Loop powered by libuv to handle async I/O off the main thread."
  },
  {
    id: "fb-9",
    category: "Science & Computers",
    type: "multiple",
    difficulty: "hard",
    question: "Which protocol operates at the Transport Layer (Layer 4) of the OSI model?",
    correct_answer: "TCP",
    incorrect_answers: ["HTTP", "IP", "Ethernet"],
    explanation: "TCP (Transmission Control Protocol) operates at Layer 4 (Transport Layer)."
  },
  {
    id: "fb-10",
    category: "General Knowledge",
    type: "multiple",
    difficulty: "easy",
    question: "What keyword is used in JavaScript ES6 to declare a block-scoped variable that cannot be reassigned?",
    correct_answer: "const",
    incorrect_answers: ["let", "var", "static"],
    explanation: "const creates read-only references to block-scoped variables."
  }
];

// GET /api/categories - Returns category list
router.get('/categories', (req, res) => {
  res.json({
    success: true,
    categories: [
      { id: 'any', name: 'Any Category' },
      { id: '18', name: 'Science: Computers' },
      { id: '17', name: 'Science & Nature' },
      { id: '19', name: 'Science: Mathematics' },
      { id: '9', name: 'General Knowledge' },
      { id: '21', name: 'Sports' },
      { id: '23', name: 'History' },
      { id: '22', name: 'Geography' }
    ]
  });
});

// GET /api/quiz/questions - Asynchronously consume public REST API
router.get('/quiz/questions', async (req, res) => {
  const amount = parseInt(req.query.amount) || 10;
  const category = req.query.category || 'any';
  const difficulty = req.query.difficulty || 'any';

  try {
    let apiUrl = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
    if (category !== 'any') apiUrl += `&category=${category}`;
    if (difficulty !== 'any') apiUrl += `&difficulty=${difficulty}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 sec timeout

    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.response_code === 0 && data.results && data.results.length > 0) {
        const formatted = data.results.map((q, idx) => {
          const rawOptions = [...q.incorrect_answers, q.correct_answer].map(decodeHTMLEntities);
          const shuffledOptions = shuffleArray(rawOptions);
          return {
            id: `api-${idx}-${Date.now()}`,
            category: decodeHTMLEntities(q.category),
            difficulty: q.difficulty,
            question: decodeHTMLEntities(q.question),
            correct_answer: decodeHTMLEntities(q.correct_answer),
            options: shuffledOptions,
            explanation: `Correct Answer: "${decodeHTMLEntities(q.correct_answer)}". Source: Public Trivia REST API.`
          };
        });

        return res.json({
          success: true,
          source: 'Open Trivia REST API',
          count: formatted.length,
          questions: formatted
        });
      }
    }
    throw new Error('Public API returned non-zero response code or empty results');
  } catch (error) {
    console.warn('Async REST API fetch failed or timed out. Serving fallback questions:', error.message);

    // Filter fallback questions based on difficulty if requested
    let selected = [...FALLBACK_QUESTIONS];
    if (difficulty !== 'any') {
      selected = selected.filter(q => q.difficulty === difficulty);
      if (selected.length < 5) selected = [...FALLBACK_QUESTIONS];
    }

    const preparedFallback = shuffleArray(selected).slice(0, amount).map((q, idx) => {
      const rawOptions = [...q.incorrect_answers, q.correct_answer];
      return {
        ...q,
        id: `fb-${idx}-${Date.now()}`,
        options: shuffleArray(rawOptions)
      };
    });

    return res.json({
      success: true,
      source: 'Fallback Local Question Engine',
      isFallback: true,
      count: preparedFallback.length,
      questions: preparedFallback
    });
  }
});

// GET /api/leaderboard - Retrieve saved leaderboard entries
router.get('/leaderboard', async (req, res) => {
  try {
    const data = await fs.readFile(LEADERBOARD_FILE, 'utf-8');
    const leaderboard = JSON.parse(data);
    res.json({ success: true, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to read leaderboard data' });
  }
});

// POST /api/leaderboard - Save new high score entry
router.post('/leaderboard', async (req, res) => {
  try {
    const { name, avatar, score, accuracy, timeSpent, category, difficulty } = req.body;
    if (!name || score === undefined) {
      return res.status(400).json({ success: false, error: 'Name and score are required' });
    }

    const newEntry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim().slice(0, 30),
      avatar: avatar || '👤',
      score: Number(score),
      accuracy: Number(accuracy) || 0,
      timeSpent: Number(timeSpent) || 0,
      category: category || 'General Knowledge',
      difficulty: difficulty || 'medium',
      date: new Date().toISOString()
    };

    let leaderboard = [];
    try {
      const data = await fs.readFile(LEADERBOARD_FILE, 'utf-8');
      leaderboard = JSON.parse(data);
    } catch (readErr) {
      leaderboard = [];
    }

    leaderboard.push(newEntry);
    // Sort descending by score, then ascending by timeSpent
    leaderboard.sort((a, b) => b.score - a.score || a.timeSpent - b.timeSpent);
    // Keep top 100 entries
    leaderboard = leaderboard.slice(0, 100);

    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2), 'utf-8');

    res.json({ success: true, entry: newEntry, leaderboard });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to write leaderboard entry' });
  }
});

// DELETE /api/leaderboard - Reset leaderboard entries
router.delete('/leaderboard', async (req, res) => {
  try {
    await fs.writeFile(LEADERBOARD_FILE, JSON.stringify([], null, 2), 'utf-8');
    res.json({ success: true, message: 'Leaderboard reset successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to reset leaderboard' });
  }
});

export default router;
