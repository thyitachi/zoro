# Comprehensive Guide to Deploying ani-web on Vercel

## Introduction

This guide provides detailed instructions for deploying the ani-web application to Vercel. Vercel is a cloud platform for static sites and serverless functions that enables developers to host websites and web services with zero configuration.

## Prerequisites

- A GitHub account
- A Vercel account (you can sign up at [vercel.com](https://vercel.com) using your GitHub account)
- Basic familiarity with Git and command-line operations

## Deployment Methods

### Method 1: Using the Vercel Dashboard (Recommended for Beginners)

1. **Fork the Repository**
   - Go to the ani-web GitHub repository
   - Click the "Fork" button in the top-right corner
   - This creates a copy of the repository in your GitHub account

2. **Connect to Vercel**
   - Go to [Vercel](https://vercel.com/) and sign up or log in
   - Click on "Add New..." > "Project"
   - Select "Import Git Repository"
   - Find and select your forked ani-web repository

3. **Configure Project**
   - Project Name: Choose a name or use the default
   - Framework Preset: Select "Other"
   - Root Directory: Leave as default (./)
   - Build Command: `npm run build`
   - Output Directory: Leave blank
   - Install Command: `npm install`
   - Development Command: `npm start`

4. **Environment Variables (Optional)**
   - Click "Environment Variables"
   - Add the following variables:
     - `NODE_ENV`: `production`

5. **Deploy**
   - Click "Deploy"
   - Wait for the deployment to complete

6. **Access Your Application**
   - Once deployment is complete, click on the provided URL to access your application

### Method 2: Using the Vercel CLI

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/ani-web.git
   cd ani-web
   ```

2. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

3. **Login to Vercel**
   ```bash
   vercel login
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

## Understanding the Configuration

### vercel.json

The `vercel.json` file in the repository configures how Vercel deploys the application:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/server.js"
    }
  ]
}
```

This configuration:
- Uses the Node.js builder for the server.js file
- Routes all requests to the server.js file

### Environment Variables

The application uses environment variables for configuration:

- `PORT`: The port on which the server will run (default: 3000)
- `NODE_ENV`: The environment mode ('development' or 'production')

These are already configured in the code to work with Vercel's environment.

## Database Considerations

### SQLite in Serverless Environment

The application uses SQLite for data storage. In Vercel's serverless environment:

- The database is stored in the `/tmp` directory
- Data will not persist between deployments or after periods of inactivity
- The application is configured to handle this by using different paths for development and production

### Alternatives for Persistent Data

For a production environment with persistent data, consider:

1. **Vercel Postgres**: Vercel's integrated PostgreSQL service
2. **MongoDB Atlas**: Cloud-hosted MongoDB service
3. **Supabase**: Open source Firebase alternative with PostgreSQL
4. **Firebase**: Google's app development platform

Implementing these would require modifying the application code.

## Troubleshooting

### Common Issues

1. **Deployment Fails**
   - Check the build logs in the Vercel dashboard
   - Ensure all dependencies are correctly specified in package.json

2. **Application Errors After Deployment**
   - Check the function logs in the Vercel dashboard
   - Verify environment variables are correctly set

3. **Database Issues**
   - Remember that the SQLite database in `/tmp` is ephemeral
   - Use the backup/restore functionality for important data

## Updating Your Deployment

To update your deployment after making changes:

1. **Push Changes to GitHub**
   ```bash
   git add .
   git commit -m "Your update message"
   git push
   ```
   Vercel will automatically redeploy if you deployed via GitHub integration.

2. **Using Vercel CLI**
   ```bash
   vercel --prod
   ```

## Conclusion

You've now deployed ani-web to Vercel! The application should be accessible at the URL provided by Vercel. Remember that the SQLite database is stored in a temporary location, so consider implementing a more persistent storage solution for production use.