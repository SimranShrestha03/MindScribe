import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { JournalProvider } from './context/JournalContext';
import { ThemeProvider } from './context/ThemeContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <JournalProvider>
          <App />
        </JournalProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
