// Player statistics management for localStorage

export interface PlayerStats {
  currentStreak: number;
  longestStreak: number;
  totalGamesPlayed: number;
  totalGamesWon: number;
  totalAttempts: number;
  lastPlayedDate: string | null;
  gamesHistory: GameHistory[];
}

export interface GameHistory {
  date: string; // ISO date string (YYYY-MM-DD)
  won: boolean;
  attempts: number;
  hintsUsed: number;
  gameId: string;
}

const STATS_KEY = "playerStats";

// Get current date in Mountain Time
function getMountainTimeDate(): string {
  const now = new Date();
  const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  return mountainTime.toISOString().split("T")[0];
}

// Get yesterday's date in Mountain Time
function getYesterdayMountainTime(): string {
  const now = new Date();
  const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
  mountainTime.setDate(mountainTime.getDate() - 1);
  return mountainTime.toISOString().split("T")[0];
}

// Initialize or get player stats
export function getPlayerStats(): PlayerStats {
  if (typeof window === "undefined") {
    return getDefaultStats();
  }

  const stored = localStorage.getItem(STATS_KEY);
  if (!stored) {
    const defaultStats = getDefaultStats();
    localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
    return defaultStats;
  }

  try {
    return JSON.parse(stored);
  } catch {
    const defaultStats = getDefaultStats();
    localStorage.setItem(STATS_KEY, JSON.stringify(defaultStats));
    return defaultStats;
  }
}

function getDefaultStats(): PlayerStats {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalGamesPlayed: 0,
    totalGamesWon: 0,
    totalAttempts: 0,
    lastPlayedDate: null,
    gamesHistory: [],
  };
}

// Save player stats
function savePlayerStats(stats: PlayerStats): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }
}

// Check if player has played today
export function hasPlayedToday(): boolean {
  const stats = getPlayerStats();
  const today = getMountainTimeDate();
  return stats.lastPlayedDate === today;
}

// Get today's game if exists
export function getTodayGame(): GameHistory | null {
  const stats = getPlayerStats();
  const today = getMountainTimeDate();
  return stats.gamesHistory.find((game) => game.date === today) || null;
}

// Record a completed game
export function recordGame(won: boolean, attempts: number, hintsUsed: number, gameId: string): void {
  const stats = getPlayerStats();
  const today = getMountainTimeDate();

  // Check if already played today
  const existingGameIndex = stats.gamesHistory.findIndex((game) => game.date === today);

  if (existingGameIndex >= 0) {
    // Update existing game (shouldn't happen normally, but handle it)
    stats.gamesHistory[existingGameIndex] = {
      date: today,
      won,
      attempts,
      hintsUsed,
      gameId,
    };
  } else {
    // Add new game
    stats.gamesHistory.push({
      date: today,
      won,
      attempts,
      hintsUsed,
      gameId,
    });

    stats.totalGamesPlayed += 1;
    if (won) {
      stats.totalGamesWon += 1;
    }
    stats.totalAttempts += attempts;

    // Update streak
    const yesterday = getYesterdayMountainTime();
    if (stats.lastPlayedDate === yesterday) {
      // Continue streak
      stats.currentStreak += 1;
    } else if (stats.lastPlayedDate === null || stats.lastPlayedDate < yesterday) {
      // Start new streak
      stats.currentStreak = 1;
    }
    // If lastPlayedDate === today, keep current streak (shouldn't happen)

    // Update longest streak
    if (stats.currentStreak > stats.longestStreak) {
      stats.longestStreak = stats.currentStreak;
    }

    stats.lastPlayedDate = today;
  }

  savePlayerStats(stats);
}

// Get average attempts (only for completed games)
export function getAverageAttempts(): number {
  const stats = getPlayerStats();
  if (stats.totalGamesPlayed === 0) return 0;
  return Math.round((stats.totalAttempts / stats.totalGamesPlayed) * 10) / 10;
}

// Get win rate percentage
export function getWinRate(): number {
  const stats = getPlayerStats();
  if (stats.totalGamesPlayed === 0) return 0;
  return Math.round((stats.totalGamesWon / stats.totalGamesPlayed) * 100);
}

// Reset stats (for debugging/testing)
export function resetPlayerStats(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STATS_KEY);
    // Also clear old localStorage keys
    localStorage.removeItem("lastPlayedDate");
    localStorage.removeItem("lastPlayedGameId");
    localStorage.removeItem("lastWonDate");
    localStorage.removeItem("lastWonGameId");
  }
}
