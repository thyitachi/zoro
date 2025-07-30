# Deploying to Vercel

This guide provides two methods for deploying ani-web to Vercel: using the Vercel dashboard (UI) or using the Vercel CLI.

## Method 1: Using Vercel Dashboard (UI)

1. **Fork or Clone the Repository**
   - Fork this repository to your GitHub account or clone it locally

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com/) and sign up or log in
   - Click on "New Project"
   - Import your GitHub repository

3. **Configure Project**
   - Keep the default settings
   - Vercel will automatically detect the Node.js project
   - The `vercel.json` file in the repository will handle the configuration

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application

## Method 2: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Navigate to Your Project Directory**
   ```bash
   cd path/to/ani-web
   ```

4. **Deploy to Vercel**
   ```bash
   vercel
   ```
   - Follow the prompts to configure your project
   - When asked about settings, you can use the defaults

5. **For Production Deployment**
   ```bash
   vercel --prod
   ```

## Environment Variables

If you need to set environment variables for your deployment, you can do so in the Vercel dashboard or using the CLI:

### Using Vercel Dashboard
1. Go to your project in the Vercel dashboard
2. Navigate to "Settings" > "Environment Variables"
3. Add your environment variables

### Using Vercel CLI
```bash
vercel env add
```

## Important Notes

- The application uses SQLite for data storage. In the Vercel serverless environment, the database is stored in the `/tmp` directory, which means data will not persist between deployments.
- For a production environment with persistent data, consider using a database service like MongoDB Atlas, PostgreSQL on Heroku, or other cloud database solutions.