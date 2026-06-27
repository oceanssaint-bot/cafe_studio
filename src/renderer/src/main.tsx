import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './context/ThemeContext'
import { NavProvider } from './context/NavContext'
import { OfficeModeProvider } from './context/OfficeModeContext'
import { ActivityProvider } from './context/ActivityContext'
import './assets/main.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ActivityProvider>
        <OfficeModeProvider>
          <NavProvider>
            <App />
          </NavProvider>
        </OfficeModeProvider>
      </ActivityProvider>
    </ThemeProvider>
  </React.StrictMode>
)
