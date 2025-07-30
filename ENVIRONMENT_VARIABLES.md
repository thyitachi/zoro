# Environment Variables in Vercel

This guide explains how to set up and manage environment variables for your ani-web deployment on Vercel.

## Available Environment Variables

The ani-web application uses the following environment variables:

- `PORT`: The port on which the server will run (default: 3000)
- `NODE_ENV`: The environment mode ('development' or 'production')

## Setting Environment Variables in Vercel

### Method 1: Using the Vercel Dashboard

1. Go to your project in the [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to "Settings" > "Environment Variables"
3. Add your environment variables:
   - Key: `NODE_ENV`
   - Value: `production`
   - Environment: Production, Preview, Development (select as needed)
4. Click "Save"

### Method 2: Using the Vercel CLI

```bash
# Add a single environment variable
vercel env add

# Follow the prompts to add the variable
```

### Method 3: Using a .env File

Create a `.env` file in your project root (based on the provided `.env.example`):

```
PORT=3000
NODE_ENV=production
```

Then, when deploying with Vercel CLI:

```bash
vercel --env-file .env
```

## Environment-Specific Configurations

Vercel allows you to set different environment variables for different deployment environments:

- **Production**: Your main deployment
- **Preview**: Deployments from pull/merge requests
- **Development**: Local development with `vercel dev`

When adding environment variables through the dashboard, you can select which environments they apply to.

## Accessing Environment Variables in Code

In your Node.js code, you can access environment variables using `process.env`:

```javascript
const port = process.env.PORT || 3000;
const environment = process.env.NODE_ENV || 'development';
```

## Security Considerations

- Never commit sensitive environment variables to your repository
- Use Vercel's environment variable system for sensitive data
- Consider using Vercel's integration with secret management services for highly sensitive data

## Verifying Environment Variables

To verify that your environment variables are correctly set:

1. Deploy your application to Vercel
2. Go to the "Deployments" tab in your Vercel project
3. Select your deployment
4. Click on "Functions" to see the serverless functions
5. Check the logs for any environment-related issues