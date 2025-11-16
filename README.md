# Genie AI - Word Guessing Game

A Next.js-based word guessing game where players compete against AI or friends to guess the daily secret word by asking yes/no questions.

## Features

- **Daily Word System**: New secret word every day (like Wordle)
- **Two Game Modes**:
  - Play vs AI: Challenge Genie AI to guess the word
  - Play with Friend: Share a code and compete with friends
- **AI-Powered Responses**: Ask questions and get intelligent responses (yes/no/sometimes/maybe/not relevant)
- **iMessage-Style UI**: Beautiful chat interface mimicking iMessage
- **Real-time Updates**: Game state updates automatically
- **Neo4j Database**: All games and messages stored in Neo4j

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **UI Components**: ShadCN + Tailwind CSS
- **Database**: Neo4j
- **AI**: Vercel AI SDK with OpenAI
- **Deployment**: Vercel

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Neo4j Database

You need a Neo4j database instance. You can either:

- **Local Installation**: Download and install [Neo4j Desktop](https://neo4j.com/download/)
- **Cloud**: Use [Neo4j AuraDB](https://neo4j.com/cloud/aura/) (free tier available)

### 3. Environment Variables

Create a `.env` file in the root directory:

```env
# Neo4j Database Configuration
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password_here

# OpenAI API Key (for AI responses)
OPENAI_API_KEY=your_openai_api_key_here

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Getting API Keys**:
- **OpenAI API Key**: Sign up at [OpenAI Platform](https://platform.openai.com/) and create an API key

### 4. Initialize Database

The database schema will be automatically created on first connection. The constraints include:
- Unique game IDs
- Unique daily word dates
- Indexed game codes

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Play

1. **Start a Game**:
   - Click "Play vs AI" to play against Genie AI
   - Click "Play with Friend" to get a shareable game code
   - Or enter a friend's game code to join their game

2. **Ask Questions or Guess**:
   - Use the toggle to switch between "Ask Question" and "Guess Word"
   - Ask yes/no questions to narrow down possibilities
   - The AI will respond with: yes, no, sometimes, maybe, or not relevant

3. **Take Turns**:
   - In friend mode, players alternate turns
   - In AI mode, you can go continuously

4. **Win the Game**:
   - First player to guess the secret word correctly wins!

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles
│   └── game/[id]/
│       └── page.tsx        # Game page
├── components/
│   ├── ui/                 # ShadCN components
│   ├── GameChat.tsx        # Main game chat interface
│   └── MessageBubble.tsx   # Chat message bubble
├── lib/
│   ├── neo4j.ts            # Neo4j connection
│   ├── db-operations.ts    # Database operations
│   └── utils.ts            # Utility functions
├── pages/api/
│   ├── ai-respond.ts       # AI response endpoint
│   └── game/
│       ├── create.ts       # Create game endpoint
│       ├── join.ts         # Join game endpoint
│       ├── message.ts      # Send message endpoint
│       └── [id].ts         # Get game endpoint
└── README.md
```

## API Endpoints

- `POST /api/game/create` - Create a new game
- `POST /api/game/join` - Join a game with code
- `POST /api/game/message` - Send a message/guess
- `GET /api/game/[id]` - Get game state
- `POST /api/ai-respond` - Get AI response to question

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the repository in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your Vercel project settings:
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`
- `OPENAI_API_KEY`
- `NEXT_PUBLIC_BASE_URL` (your production URL)

## Future Enhancements

- Leaderboard system
- Custom word lists
- Multiplayer tournaments
- Social sharing
- Daily streaks and statistics
- More AI models to choose from

## License

MIT

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
