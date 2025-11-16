import neo4j, { Driver, Session } from "neo4j-driver";

let driver: Driver | null = null;

export function getDriver(): Driver {
  if (!driver) {
    const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
    const user = process.env.NEO4J_USER || "neo4j";
    const password = process.env.NEO4J_PASSWORD || "password";

    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }
  return driver;
}

export async function getSession(): Promise<Session> {
  const driver = getDriver();
  return driver.session();
}

export async function closeDriver(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

// Database initialization
export async function initializeDatabase() {
  const session = await getSession();
  try {
    // Create constraints and indexes
    await session.run(`
      CREATE CONSTRAINT game_id_unique IF NOT EXISTS
      FOR (g:Game) REQUIRE g.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT daily_word_date_unique IF NOT EXISTS
      FOR (d:DailyWord) REQUIRE d.date IS UNIQUE
    `);

    await session.run(`
      CREATE INDEX game_code IF NOT EXISTS
      FOR (g:Game) ON (g.code)
    `);
  } finally {
    await session.close();
  }
}
