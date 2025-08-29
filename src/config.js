// src/config.js
const config = {
  // API base URL - changes based on environment
  apiBaseUrl: process.env.NODE_ENV === 'production' 
    ? 'http://localhost:3000/api'  // Temporarily use localhost until backend is deployed
    : 'http://localhost:3000/api',
  
  // Environment detection
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  
  // GitHub Pages base path
  basePath: process.env.NODE_ENV === 'production' ? '/emt-scenario-trainer' : '',
  
  // Backend deployment status
  backendDeployed: false, // Set to true when backend is deployed
};

export default config;
