# Deployment Guide - Vercel

## Prerequisites

- GitHub account
- Vercel account (free tier is fine)
- Neo4j AuraDB account (free tier available)
- OpenAI API key

## Deployment Steps

### 1. Prepare Neo4j Database

For production, use Neo4j AuraDB (cloud):

1. Go to [Neo4j AuraDB](https://neo4j.com/cloud/aura/)
2. Create a free database instance
3. Download the connection details (URI, username, password)
4. Keep these credentials safe - you'll need them for Vercel

### 2. Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Genie AI game"

# Create repository on GitHub and push
git remote add origin https://github.com/YOUR_USERNAME/genie-ai.git
git branch -M main
git push -u origin main
```

### 3. Deploy to Vercel

1. Go to [Vercel](https://vercel.com)
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`

### 4. Set Environment Variables

In Vercel project settings, add these environment variables:

```
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_auradb_password
OPENAI_API_KEY=sk-...
NEXT_PUBLIC_BASE_URL=https://your-app.vercel.app
```

**Important**:
- For AuraDB, use the `neo4j+s://` protocol (not `bolt://`)
- Set `NEXT_PUBLIC_BASE_URL` to your actual Vercel deployment URL

### 5. Initialize Database

After deployment, you need to initialize the database schema:

**Option A: Use Vercel CLI**
```bash
vercel env pull .env.local
npm run init-db
```

**Option B: Create One-Time API Route**

Create a temporary API route to initialize:

1. Add file `pages/api/setup.ts`:
```typescript
import { NextApiRequest, NextApiResponse } from "next";
import { initializeDatabase } from "@/lib/neo4j";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Add authentication here in production!
  if (req.method === "POST") {
    await initializeDatabase();
    res.status(200).json({ success: true });
  }
}
```

2. Visit `https://your-app.vercel.app/api/setup` (POST request)
3. Delete the file after setup

### 6. Test Your Deployment

1. Visit your Vercel URL
2. Click "Play vs AI"
3. Try asking a question
4. Verify the game works end-to-end

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `NEO4J_URI` | Neo4j database connection URI | `neo4j+s://xxx.databases.neo4j.io` |
| `NEO4J_USER` | Neo4j username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | `your-secure-password` |
| `OPENAI_API_KEY` | OpenAI API key for AI responses | `sk-...` |
| `NEXT_PUBLIC_BASE_URL` | Your app's public URL | `https://genie-ai.vercel.app` |

## Post-Deployment

### Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXT_PUBLIC_BASE_URL` environment variable

### Monitoring

- Check Vercel Analytics for usage
- Monitor Neo4j AuraDB dashboard for database metrics
- Track OpenAI API usage in OpenAI dashboard

### Performance Tips

1. **Enable Edge Runtime** (optional):
   Add to API routes for faster responses:
   ```typescript
   export const runtime = 'edge';
   ```

2. **Database Connection Pooling**:
   The app already uses connection pooling via Neo4j driver

3. **Caching**:
   Consider adding Redis for caching daily words and game states

## Troubleshooting Deployment

### Build Fails

- Check build logs in Vercel
- Verify all dependencies are in `package.json`
- Make sure TypeScript has no errors

### Runtime Errors

- Check Vercel function logs
- Verify environment variables are set correctly
- Ensure Neo4j database is accessible from Vercel

### Neo4j Connection Issues

- Verify URI uses `neo4j+s://` for AuraDB
- Check firewall rules in AuraDB
- Ensure credentials are correct

### AI Responses Not Working

- Verify OpenAI API key is valid
- Check you have credits in OpenAI account
- Review Vercel function logs for errors

## Cost Estimation

**Free Tier**:
- Vercel: Free (with limits)
- Neo4j AuraDB: Free tier available
- OpenAI: Pay per use (~$0.0001-0.0002 per game)

**Expected Costs** (for 1000 games/month):
- Vercel: $0 (within free tier)
- Neo4j: $0 (free tier sufficient)
- OpenAI: ~$0.20-0.40

## Security Considerations

1. Never commit `.env` to Git
2. Use strong passwords for Neo4j
3. Rotate API keys regularly
4. Consider adding rate limiting
5. Add authentication for production use

## Scaling

If your game gets popular:

1. **Upgrade Neo4j**: Move to paid tier for better performance
2. **Add Caching**: Use Vercel Edge Config or Redis
3. **Rate Limiting**: Implement per-user rate limits
4. **CDN**: Vercel automatically uses Edge Network
5. **Database Indexes**: Monitor and optimize queries

---

Your Genie AI game should now be live! 🎉

Share the URL with friends and start playing!
