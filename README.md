# ani-web

A web application for streaming anime.

## Important Notes

- The application uses SQLite for data storage. The database is stored in the root directory as `anime.db`.
- The application includes `/backup-db` and `/restore-db` endpoints that can be used for a simple backup solution.

## Local Development

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The application will be available at http://localhost:3000.

## Deployment to Render.com

This application is configured for easy deployment to Render.com:

1. Create a Render.com account and link it to your GitHub repository
2. In the Render dashboard, click "New" and select "Blueprint"
3. Select your repository containing this application
4. Render will automatically detect the `render.yaml` configuration file
5. Click "Apply" to deploy the application

The application will be deployed and available at the URL provided by Render.
