# Vercel Deployment Checklist

Use this checklist to ensure you've completed all necessary steps for deploying ani-web to Vercel.

## Pre-Deployment Preparation

- [x] Create vercel.json configuration file
- [x] Update server.js to handle environment-specific paths
- [x] Update package.json with appropriate build scripts
- [x] Create .env.example file
- [x] Update .gitignore to exclude Vercel-specific files

## Database Considerations

- [x] Configure SQLite to use /tmp directory in production
- [x] Handle profile picture uploads appropriately
- [x] Document database persistence limitations
- [x] Implement backup/restore functionality

## Deployment Steps

### Using Vercel Dashboard

1. [ ] Fork or clone the repository to your GitHub account
2. [ ] Sign up or log in to Vercel
3. [ ] Create a new project and import your GitHub repository
4. [ ] Configure project settings (use defaults)
5. [ ] Set environment variables if needed
6. [ ] Deploy the project
7. [ ] Verify the deployment works correctly

### Using Vercel CLI

1. [ ] Install Vercel CLI: `npm install -g vercel`
2. [ ] Log in to Vercel: `vercel login`
3. [ ] Navigate to your project directory
4. [ ] Deploy to Vercel: `vercel`
5. [ ] For production deployment: `vercel --prod`
6. [ ] Verify the deployment works correctly

## Post-Deployment

- [ ] Test all functionality in the deployed application
- [ ] Verify database operations work correctly
- [ ] Check profile picture uploads
- [ ] Test backup/restore functionality
- [ ] Monitor application logs for any errors

## Long-Term Considerations

- [ ] Consider implementing a more persistent database solution
- [ ] Set up monitoring for the application
- [ ] Implement proper authentication if needed
- [ ] Create a CI/CD pipeline for automated deployments

## Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Node.js on Vercel](https://vercel.com/docs/frameworks/nodejs)
- [Environment Variables on Vercel](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel CLI Documentation](https://vercel.com/docs/cli)