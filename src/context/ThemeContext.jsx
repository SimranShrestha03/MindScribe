import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const THEME_KEY = 'mindscribe_theme';
const ThemeContext = createContext(null);

function readInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'dark';
}

function applyThemeAttribute(theme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
  } else {
    root.classList.add('light');
    root.classList.remove('dark');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readInitialTheme);

  useEffect(() => {
    applyThemeAttribute(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // localStorage may be unavailable (private mode); ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
