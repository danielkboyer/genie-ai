import { initializeDatabase } from "../lib/neo4j";

async function main() {
  console.log("Initializing database...");
  try {
    await initializeDatabase();
    console.log("✅ Database initialized successfully!");
    console.log("  - Created constraints for unique game IDs");
    console.log("  - Created constraints for unique daily word dates");
    console.log("  - Created index for game codes");
    process.exit(0);
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    process.exit(1);
  }
}

main();
