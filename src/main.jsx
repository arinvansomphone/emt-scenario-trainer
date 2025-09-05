import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import SelectionScreen from './SelectionScreen.jsx'
import { HashRouter, Routes, Route } from 'react-router-dom';
import About from './About';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<SelectionScreen />} />
        <Route path="/selection" element={<SelectionScreen />} />
        <Route path="/app" element={<App />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
)
