# Quick Start Guide for Genie AI

## Prerequisites

- Node.js 18+ installed
- Neo4j database (local or cloud)
- OpenAI API key

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```env
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Set Up Neo4j

**Option A: Neo4j Desktop (Local)**
1. Download [Neo4j Desktop](https://neo4j.com/download/)
2. Create a new database
3. Start the database
4. Note the bolt URL (usually `bolt://localhost:7687`)
5. Use the username/password you set

**Option B: Neo4j AuraDB (Cloud - Free Tier)**
1. Sign up at [Neo4j AuraDB](https://neo4j.com/cloud/aura/)
2. Create a free database instance
3. Download the connection details
4. Use the provided URI, username, and password

### 4. Initialize Database Schema

```bash
npm run init-db
```

This creates the necessary constraints and indexes.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to play!

## Troubleshooting

### Neo4j Connection Issues

If you get connection errors:
- Make sure Neo4j is running
- Verify the URI, username, and password in `.env`
- Check if the bolt port (7687) is open

### OpenAI API Issues

If AI responses fail:
- Verify your OpenAI API key is correct
- Check you have credits in your OpenAI account
- The default model is `gpt-4o-mini` (cost-effective)

### Build Errors

If you get TypeScript or build errors:
```bash
rm -rf .next node_modules
npm install
npm run dev
```

## Next Steps

1. Play the game locally
2. Customize the word list in `lib/db-operations.ts`
3. Deploy to Vercel (see README.md)

## Game Features Checklist

- ✅ Play vs AI
- ✅ Play with Friend (multiplayer)
- ✅ Daily word system
- ✅ iMessage-style chat UI
- ✅ AI responses (yes/no/sometimes/maybe/not relevant)
- ✅ Win/Loss detection
- ✅ Game summary on completion

Enjoy playing Genie AI!
