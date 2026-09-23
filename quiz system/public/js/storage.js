// Local Storage Persistence Manager for Timed Quiz App

const KEYS = {
  PROFILE: 'quiz_user_profile',
  ACTIVE_SESSION: 'quiz_active_session',
  LOCAL_LEADERBOARD: 'quiz_local_leaderboard',
  SETTINGS: 'quiz_app_settings'
};

export class StorageManager {
  // User Profile
  static getProfile() {
    try {
      const data = localStorage.getItem(KEYS.PROFILE);
      return data ? JSON.parse(data) : { name: 'Player One', avatar: '⚡', sound: true, theme: 'dark' };
    } catch (e) {
      return { name: 'Player One', avatar: '⚡', sound: true, theme: 'dark' };
    }
  }

  static saveProfile(profile) {
    try {
      const current = this.getProfile();
      const updated = { ...current, ...profile };
      localStorage.setItem(KEYS.PROFILE, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  // Active Session Persistence (State Recovery on Reload)
  static saveActiveSession(sessionState) {
    try {
      if (!sessionState) {
        localStorage.removeItem(KEYS.ACTIVE_SESSION);
      } else {
        localStorage.setItem(KEYS.ACTIVE_SESSION, JSON.stringify({
          ...sessionState,
          timestamp: Date.now()
        }));
      }
    } catch (e) {
      console.error('LocalStorage save session error:', e);
    }
  }

  static getActiveSession() {
    try {
      const data = localStorage.getItem(KEYS.ACTIVE_SESSION);
      if (!data) return null;
      const session = JSON.parse(data);
      // Expire session if older than 30 minutes
      if (Date.now() - session.timestamp > 30 * 60 * 1000) {
        this.clearActiveSession();
        return null;
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  static clearActiveSession() {
    localStorage.removeItem(KEYS.ACTIVE_SESSION);
  }

  // Local Leaderboard Cache (Offline fallback for scores)
  static getLocalLeaderboard() {
    try {
      const data = localStorage.getItem(KEYS.LOCAL_LEADERBOARD);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  static saveScoreLocally(entry) {
    try {
      const leaderboard = this.getLocalLeaderboard();
      leaderboard.push(entry);
      leaderboard.sort((a, b) => b.score - a.score || a.timeSpent - b.timeSpent);
      localStorage.setItem(KEYS.LOCAL_LEADERBOARD, JSON.stringify(leaderboard.slice(0, 50)));
      return leaderboard;
    } catch (e) {
      console.error('LocalStorage leaderboard save error:', e);
    }
  }

  static clearLocalLeaderboard() {
    localStorage.removeItem(KEYS.LOCAL_LEADERBOARD);
  }

  // Export / Import Leaderboard Data
  static exportDataJSON() {
    const data = {
      profile: this.getProfile(),
      localLeaderboard: this.getLocalLeaderboard(),
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  static importDataJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) this.saveProfile(parsed.profile);
      if (Array.isArray(parsed.localLeaderboard)) {
        localStorage.setItem(KEYS.LOCAL_LEADERBOARD, JSON.stringify(parsed.localLeaderboard));
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}
