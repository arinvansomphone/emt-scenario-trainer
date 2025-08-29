// src/config.js
const config = {
  // API base URL - changes based on environment
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'https://your-backend-url.com/api'  // Replace with your deployed backend URL
    : 'http://localhost:3000/api',
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // GitHub Pages base path
  basePath: process.env.NODE_ENV === 'production' ? '/emt-scenario-trainer' : '',
};

export default config;
