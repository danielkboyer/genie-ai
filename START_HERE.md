# 🎮 Genie AI - Getting Started

Congratulations! Your Genie AI word guessing game is ready to play!

## ✅ Build Successful!

The project has been successfully built and is ready to run.

## 🚀 Quick Start

### 1. Set Up Your Environment Variables

Edit the `.env` file in the root directory and add your credentials:

```env
# Neo4j Database
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password

# OpenAI API Key
OPENAI_API_KEY=your_openai_api_key_here

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

**Getting Your API Keys:**

- **OpenAI API Key**:
  1. Go to https://platform.openai.com/api-keys
  2. Create a new API key
  3. Copy and paste it into `.env`

- **Neo4j Database**:
  - **Option A (Local)**: Download Neo4j Desktop from https://neo4j.com/download/
  - **Option B (Cloud)**: Create a free database at https://neo4j.com/cloud/aura/

### 2. Initialize the Database

```bash
npm run init-db
```

This creates the necessary database schema (constraints and indexes).

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Open Your Browser

Go to http://localhost:3000 and start playing!

## 🎯 How to Play

1. **Play vs AI**:
   - Click "Play vs AI"
   - Ask yes/no questions to figure out the secret word
   - The AI will respond with: yes, no, sometimes, maybe, or not relevant
   - Make your guess when you think you know the word!

2. **Play with a Friend**:
   - Click "Play with Friend"
   - Share the 6-character code with your friend
   - Take turns asking questions
   - First to guess correctly wins!

## 📝 Game Features

✅ Daily word (changes every day like Wordle)
✅ AI-powered responses using GPT-4o-mini
✅ Multiplayer with shareable codes
✅ iMessage-style chat interface
✅ Win/loss tracking
✅ Game history stored in Neo4j

## 📚 Documentation

- **[README.md](./README.md)** - Full project documentation
- **[QUICKSTART.md](./QUICKSTART.md)** - Detailed setup guide
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - How to deploy to Vercel
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** - Complete project overview

## 🔧 Troubleshooting

### Neo4j Connection Error

Make sure:
- Neo4j is running
- URI, username, and password are correct in `.env`
- The database is accessible

### OpenAI API Error

Make sure:
- Your API key is valid and has credits
- The key is correctly set in `.env`

### Build Errors

Try:
```bash
rm -rf .next node_modules
npm install
npm run build
```

## 🚀 Deploy to Production

When you're ready to share your game with the world:

1. Push your code to GitHub
2. Deploy to Vercel (it's free!)
3. See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions

## 📞 Need Help?

Check the documentation files or review the code comments.

## 🎉 Have Fun!

Enjoy playing Genie AI! Try to guess the word in as few questions as possible!

---

**Next Steps:**
1. Update your `.env` file with real credentials
2. Run `npm run init-db`
3. Run `npm run dev`
4. Visit http://localhost:3000
5. Start playing! 🧞‍♂️
