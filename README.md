# ani-web

A web application for streaming anime.

## Deploying to Vercel

Follow these steps to deploy ani-web to Vercel:

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

5. **Access Your Application**
   - Once deployment is complete, you can access your application at the URL provided by Vercel

## Important Notes

- The application uses SQLite for data storage. In the Vercel serverless environment, the database is stored in the `/tmp` directory, which means data will not persist between deployments.
- For a production environment with persistent data, consider using a database service like MongoDB Atlas, PostgreSQL on Heroku, or other cloud database solutions.

## Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at http://localhost:3000.
