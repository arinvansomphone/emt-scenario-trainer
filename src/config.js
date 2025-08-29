// src/config.js
const config = {
  // API base URL - changes based on environment
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://emt-scenario-trainer.onrender.com/api'  // Deployed backend on Render
    : 'http://localhost:3000/api',
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // GitHub Pages base path
  basePath: process.env.NODE_ENV === 'production' ? '/emt-scenario-trainer' : '',
  
  // Backend deployment status
  backendDeployed: true, // Backend is now deployed and running
  
  // Backend deployment URL
  backendUrl: 'https://emt-scenario-trainer.onrender.com', // Deployed backend on Render
};

export default config;
