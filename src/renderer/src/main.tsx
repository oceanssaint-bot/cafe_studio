import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { NavProvider } from './context/NavContext'
import { OfficeModeProvider } from './context/OfficeModeContext'
import './assets/main.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <OfficeModeProvider>
        <NavProvider>
          <App />
        </NavProvider>
      </OfficeModeProvider>
    </ThemeProvider>
  </React.StrictMode>
)
