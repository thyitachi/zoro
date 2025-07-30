# Database Persistence with Vercel

## Understanding the Challenge

When deploying ani-web to Vercel, it's important to understand that Vercel uses a serverless architecture. This means:

1. The filesystem is ephemeral (temporary)
2. The `/tmp` directory is the only writable location
3. Data in `/tmp` does not persist between function invocations
4. SQLite databases stored in `/tmp` will lose data over time

## Solutions for Database Persistence

### Option 1: Use a Cloud Database Service

The most robust solution is to modify the application to use a cloud database service instead of SQLite:

- **MongoDB Atlas**: A cloud-hosted MongoDB service with a free tier
- **Supabase or PostgreSQL**: SQL databases with cloud hosting options
- **Firebase Firestore**: NoSQL document database by Google

This would require modifying the application code to use these services instead of SQLite.

### Option 2: Use Vercel Postgres

Vercel offers a PostgreSQL database service that integrates well with Vercel deployments:

1. Go to your Vercel dashboard
2. Navigate to Storage > Create Database > PostgreSQL
3. Follow the setup instructions
4. Update your application to use the Vercel Postgres client

### Option 3: Use External Storage for SQLite

If you want to keep using SQLite, you could store the database file in an external service:

1. **S3 or similar object storage**: Download the database on startup and upload it periodically
2. **Sync with GitHub**: Use GitHub as a database backup mechanism

## Implementing a Simple Backup Solution

For a simple solution, you could implement a backup/restore mechanism:

1. Add an API endpoint that allows downloading the current database state
2. Add an API endpoint that allows uploading a database backup
3. Instruct users to periodically backup their data

This approach is already implemented in ani-web with the `/backup-db` and `/restore-db` endpoints.

## Recommended Approach for Production

For a production deployment, we recommend:

1. Modify the application to use a proper cloud database service
2. Implement proper user authentication
3. Set up regular database backups

## Local Development vs. Production

The current implementation uses environment detection to determine where to store the database:

```javascript
const dbPath = process.env.NODE_ENV === 'production' 
  ? path.join('/tmp', 'anime.db')
  : path.join(__dirname, 'anime.db');
```

This allows for seamless development locally while adapting to Vercel's constraints in production.