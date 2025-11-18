import { getSession } from "./neo4j";
import { words } from "./words";

export interface GameMessage {
  id: string;
  type: "question" | "guess" | "hint";
  content: string;
  aiResponse?: string;
  playerId: string;
  timestamp: number;
}

export interface Game {
  id: string;
  code?: string;
  secretWord: string; // The word that was active when the game started
  date: string;
  mode: "ai" | "friend";
  status: "active" | "completed";
  winnerId?: string;
  messages: GameMessage[];
  player1Id: string;
  player2Id?: string; // In AI mode, this is "ai"
  currentTurn: string;
  createdAt: number;
  hintsUsed?: number; // Track how many hints the player has used
}

// Get today's word (deterministic based on Mountain Time date)
export function getTodaysWord(): string {
  const now = new Date();

  // Convert current time to Mountain Time
  const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));

  // Get the Mountain Time date components
  const mtYear = mountainTime.getFullYear();
  const mtMonth = mountainTime.getMonth();
  const mtDay = mountainTime.getDate();

  // Start date: November 16, 2025 at midnight Mountain Time
  const startDate = new Date(2025, 10, 16); // Month is 0-indexed, so 10 = November

  // Current date at midnight MT
  const currentMT = new Date(mtYear, mtMonth, mtDay);

  const diff = currentMT.getTime() - startDate.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.floor(diff / oneDay);

  // Use modulo to cycle through words based on days since start
  const wordIndex = daysSinceStart % words.length;

  return words[wordIndex];
}

// Create a new game
export async function createGame(
  playerId: string,
  mode: "ai" | "friend"
): Promise<Game> {
  const session = await getSession();
  try {
    const gameId = generateId();
    const code = mode === "friend" ? generateGameCode() : null;
    const now = new Date();
    const mountainTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Denver' }));
    const today = mountainTime.toISOString().split("T")[0];
    const secretWord = getTodaysWord(); // Get the word for today and store it with the game

    const query = mode === "friend"
      ? `
        CREATE (g:Game {
          id: $id,
          code: $code,
          secretWord: $secretWord,
          date: $date,
          mode: $mode,
          status: 'active',
          player1Id: $playerId,
          currentTurn: $playerId,
          createdAt: timestamp()
        })
        RETURN g
      `
      : `
        CREATE (g:Game {
          id: $id,
          secretWord: $secretWord,
          date: $date,
          mode: $mode,
          status: 'active',
          player1Id: $playerId,
          player2Id: 'ai',
          currentTurn: $playerId,
          createdAt: timestamp()
        })
        RETURN g
      `;

    const params: any = {
      id: gameId,
      secretWord,
      date: today,
      mode,
      playerId,
    };

    if (mode === "friend") {
      params.code = code;
    }

    await session.run(query, params);

    const game: Game = {
      id: gameId,
      secretWord,
      date: today,
      mode,
      status: "active",
      messages: [],
      player1Id: playerId,
      player2Id: mode === "ai" ? "ai" : undefined,
      currentTurn: playerId,
      createdAt: Date.now(),
    };

    if (mode === "friend" && code) {
      game.code = code;
    }

    return game;
  } finally {
    await session.close();
  }
}

// Join a game by code
export async function joinGame(code: string, playerId: string): Promise<Game | null> {
  const session = await getSession();
  try {
    // First check if player is already in the game (rejoining)
    const rejoiningResult = await session.run(
      `
      MATCH (g:Game {code: $code, status: 'active'})
      WHERE g.player1Id = $playerId OR g.player2Id = $playerId
      RETURN g
      `,
      { code, playerId }
    );

    if (rejoiningResult.records.length > 0) {
      // Player is rejoining
      const game = rejoiningResult.records[0].get("g").properties;
      return {
        id: game.id,
        code: game.code,
        secretWord: game.secretWord,
        date: game.date,
        mode: game.mode,
        status: game.status,
        messages: [],
        player1Id: game.player1Id,
        player2Id: game.player2Id,
        currentTurn: game.currentTurn,
        createdAt: Number(game.createdAt),
      };
    }

    // Player is joining for the first time as player2
    const result = await session.run(
      `
      MATCH (g:Game {code: $code, status: 'active'})
      WHERE g.player2Id IS NULL
      SET g.player2Id = $playerId
      RETURN g
      `,
      { code, playerId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const game = result.records[0].get("g").properties;
    return {
      id: game.id,
      code: game.code,
      secretWord: game.secretWord,
      date: game.date,
      mode: game.mode,
      status: game.status,
      messages: [],
      player1Id: game.player1Id,
      player2Id: game.player2Id,
      currentTurn: game.currentTurn,
      createdAt: Number(game.createdAt),
    };
  } finally {
    await session.close();
  }
}

// Add a message to the game
export async function addMessage(
  gameId: string,
  message: GameMessage
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (g:Game {id: $gameId})
      CREATE (m:Message {
        id: $messageId,
        type: $type,
        content: $content,
        aiResponse: $aiResponse,
        playerId: $playerId,
        timestamp: $timestamp
      })
      CREATE (g)-[:HAS_MESSAGE]->(m)
      `,
      {
        gameId,
        messageId: message.id,
        type: message.type,
        content: message.content,
        aiResponse: message.aiResponse || null,
        playerId: message.playerId,
        timestamp: message.timestamp,
      }
    );
  } finally {
    await session.close();
  }
}

// Get game by ID
export async function getGame(gameId: string): Promise<Game | null> {
  const session = await getSession();
  try {
    const result = await session.run(
      `
      MATCH (g:Game {id: $gameId})
      OPTIONAL MATCH (g)-[:HAS_MESSAGE]->(m:Message)
      WITH g, m
      ORDER BY m.timestamp
      RETURN g, collect(m) as messages
      `,
      { gameId }
    );

    if (result.records.length === 0) {
      return null;
    }

    const game = result.records[0].get("g").properties;
    const messages = result.records[0].get("messages")
      .filter((m: any) => m !== null)
      .map((m: any) => m.properties);

    return {
      id: game.id,
      code: game.code,
      secretWord: game.secretWord,
      date: game.date,
      mode: game.mode,
      status: game.status,
      winnerId: game.winnerId,
      messages,
      player1Id: game.player1Id,
      player2Id: game.player2Id,
      currentTurn: game.currentTurn,
      createdAt: Number(game.createdAt),
      hintsUsed: game.hintsUsed ? Number(game.hintsUsed) : 0,
    };
  } finally {
    await session.close();
  }
}

// Update game status (win/lose)
export async function updateGameStatus(
  gameId: string,
  status: "completed",
  winnerId: string
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (g:Game {id: $gameId})
      SET g.status = $status, g.winnerId = $winnerId
      `,
      { gameId, status, winnerId }
    );
  } finally {
    await session.close();
  }
}

// Update current turn
export async function updateTurn(gameId: string, playerId: string): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (g:Game {id: $gameId})
      SET g.currentTurn = $playerId
      `,
      { gameId, playerId }
    );
  } finally {
    await session.close();
  }
}

// Increment hints used
export async function incrementHintsUsed(gameId: string): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (g:Game {id: $gameId})
      SET g.hintsUsed = COALESCE(g.hintsUsed, 0) + 1
      `,
      { gameId }
    );
  } finally {
    await session.close();
  }
}

// Update message AI response
export async function updateMessageResponse(
  messageId: string,
  aiResponse: string
): Promise<void> {
  const session = await getSession();
  try {
    await session.run(
      `
      MATCH (m:Message {id: $messageId})
      SET m.aiResponse = $aiResponse
      `,
      { messageId, aiResponse }
    );
  } finally {
    await session.close();
  }
}

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

