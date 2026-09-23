// Asynchronous REST API Client for Timed Quiz App

export class QuizAPI {
  static async fetchCategories() {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        return data.categories || [];
      }
    } catch (e) {
      console.warn('Backend categories endpoint unreachable. Returning default list.');
    }
    return [
      { id: 'any', name: 'Any Category' },
      { id: '18', name: 'Science: Computers' },
      { id: '17', name: 'Science & Nature' },
      { id: '9', name: 'General Knowledge' },
      { id: '23', name: 'History' }
    ];
  }

  static async fetchQuestions({ category = 'any', difficulty = 'any', amount = 10 }) {
    try {
      const url = `/api/quiz/questions?amount=${amount}&category=${category}&difficulty=${difficulty}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.questions) {
          return {
            questions: data.questions,
            source: data.source || 'REST API',
            isFallback: !!data.isFallback
          };
        }
      }
    } catch (e) {
      console.warn('Backend server fetch failed. Attempting direct OpenTDB fetch:', e);
    }

    // Direct Client-Side Fallback fetch if server isn't running or endpoint fails
    try {
      let directUrl = `https://opentdb.com/api.php?amount=${amount}&type=multiple`;
      if (category !== 'any') directUrl += `&category=${category}`;
      if (difficulty !== 'any') directUrl += `&difficulty=${difficulty}`;

      const directRes = await fetch(directUrl);
      if (directRes.ok) {
        const data = await directRes.json();
        if (data.response_code === 0 && data.results) {
          const questions = data.results.map((q, idx) => ({
            id: `direct-${idx}-${Date.now()}`,
            category: q.category,
            difficulty: q.difficulty,
            question: q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            correct_answer: q.correct_answer.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&'),
            options: [...q.incorrect_answers, q.correct_answer].map(opt => opt.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')).sort(() => Math.random() - 0.5),
            explanation: `Correct Answer: ${q.correct_answer}`
          }));
          return { questions, source: 'Direct Public API', isFallback: false };
        }
      }
    } catch (directErr) {
      console.error('Direct public API failed as well:', directErr);
    }

    throw new Error('Unable to retrieve questions from REST API or fallback provider.');
  }

  static async fetchLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        return data.leaderboard || [];
      }
    } catch (e) {
      console.warn('Server leaderboard unavailable. Returning empty array for local fallback.');
    }
    return [];
  }

  static async submitScore(entry) {
    try {
      const res = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      console.warn('Failed to submit score to server backend:', e);
    }
    return null;
  }

  static async resetLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard', { method: 'DELETE' });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Failed to reset backend leaderboard:', e);
    }
    return null;
  }
}
