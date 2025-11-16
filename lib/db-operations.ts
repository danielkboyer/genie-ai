import { getSession } from "./neo4j";

export interface GameMessage {
  id: string;
  type: "question" | "guess";
  content: string;
  aiResponse?: string;
  playerId: string;
  timestamp: number;
}

export interface Game {
  id: string;
  code?: string;
  secretWord: string;
  date: string;
  mode: "ai" | "friend";
  status: "active" | "completed";
  winnerId?: string;
  messages: GameMessage[];
  player1Id: string;
  player2Id?: string;
  currentTurn: string;
  createdAt: number;
}

// Get or create today's word
export async function getTodayWord(): Promise<string> {
  const session = await getSession();
  try {
    const today = new Date().toISOString().split("T")[0];

    const result = await session.run(
      `
      MERGE (d:DailyWord {date: $date})
      ON CREATE SET d.word = $word
      RETURN d.word as word
      `,
      {
        date: today,
        word: await generateRandomWord() // You'll need to implement this
      }
    );

    return result.records[0].get("word");
  } finally {
    await session.close();
  }
}

// Create a new game
export async function createGame(
  playerId: string,
  mode: "ai" | "friend",
  secretWord: string
): Promise<Game> {
  const session = await getSession();
  try {
    const gameId = generateId();
    const code = mode === "friend" ? generateGameCode() : undefined;
    const today = new Date().toISOString().split("T")[0];

    await session.run(
      `
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
      `,
      {
        id: gameId,
        code,
        secretWord,
        date: today,
        mode,
        playerId,
      }
    );

    return {
      id: gameId,
      code,
      secretWord,
      date: today,
      mode,
      status: "active",
      messages: [],
      player1Id: playerId,
      currentTurn: playerId,
      createdAt: Date.now(),
    };
  } finally {
    await session.close();
  }
}

// Join a game by code
export async function joinGame(code: string, playerId: string): Promise<Game | null> {
  const session = await getSession();
  try {
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
      RETURN g, collect(m) as messages
      ORDER BY m.timestamp
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

// Utility functions
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}

function generateGameCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function generateRandomWord(): Promise<string> {
  // For now, return a random word from a list
  // You can enhance this to use an API or larger word list
  const words = [
    "elephant", "computer", "guitar", "rainbow", "pizza",
    "astronaut", "mountain", "butterfly", "telephone", "umbrella",
    "chocolate", "dinosaur", "symphony", "volcano", "penguin",
    "telescope", "hurricane", "champagne", "submarine", "kangaroo"
  ];
  return words[Math.floor(Math.random() * words.length)];
}
