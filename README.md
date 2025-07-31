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

## Deployment

This application can be deployed to any Node.js hosting service of your choice.
