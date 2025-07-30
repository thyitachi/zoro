# Deploying ani-web to Render.com

## Prerequisites

- A GitHub account
- Your ani-web project pushed to a GitHub repository
- A Render.com account linked to your GitHub account

## Deployment Steps

### 1. Prepare Your Repository

Ensure your repository contains the following files:

- `render.yaml` - Configuration file for Render.com
- `Procfile` - Specifies the command to start your application
- `.env` - Environment variables (this should be added to .gitignore and set in Render.com dashboard)

### 2. Deploy Using Render Blueprint

1. Log in to your Render.com account
2. Click on the "New" button in the dashboard
3. Select "Blueprint" from the dropdown menu
4. Connect your GitHub repository if not already connected
5. Select the repository containing your ani-web application
6. Render will automatically detect the `render.yaml` configuration
7. Review the settings and click "Apply" to start the deployment

### 3. Manual Deployment (Alternative)

If you prefer to set up the service manually:

1. Log in to your Render.com account
2. Click on the "New" button and select "Web Service"
3. Connect your GitHub repository
4. Configure the service with the following settings:
   - **Name**: ani-web (or your preferred name)
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. Add the following environment variables:
   - `NODE_ENV`: production
   - `PORT`: 10000 (Render will automatically set the PORT variable, but you can specify it here)
6. Click "Create Web Service" to deploy

### 4. Verify Deployment

1. Once deployment is complete, Render will provide a URL for your application
2. Visit the URL to ensure your application is running correctly
3. Check the logs in the Render dashboard for any errors

### 5. Database Considerations

This application uses SQLite, which stores data in a file. On Render.com:

1. The database file will be created in the application's directory
2. Data will persist as long as the disk is attached to your service
3. Use the `/backup-db` endpoint to create backups of your database

### 6. Troubleshooting

If you encounter issues:

1. Check the logs in the Render dashboard
2. Ensure all environment variables are set correctly
3. Verify that your application works locally before deploying
4. Check that the port configuration in your code matches Render's requirements

### 7. Updating Your Application

To update your application:

1. Push changes to your GitHub repository
2. Render will automatically detect the changes and redeploy your application

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)