import { useJournal } from './context/JournalContext';
import { useAuth } from './context/AuthContext';
import { Home } from './pages/Home';
import { Recording } from './pages/Recording';
import { Results } from './pages/Results';
import { WeeklyInsights } from './pages/WeeklyInsights';
import { AuthPage } from './pages/AuthPage';
import { LoadingSpinner } from './components/LoadingSpinner';

const PAGES = {
  home: Home,
  recording: Recording,
  results: Results,
  insights: WeeklyInsights,
};

export default function App() {
  const { user, loading } = useAuth();
  const { page } = useJournal();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950">
        <AuthPage />
      </div>
    );
  }

  const Page = PAGES[page] || Home;

  return (
    <div className="min-h-screen bg-slate-950">
      <Page />
    </div>
  );
}
