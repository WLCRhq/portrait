import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DeckDetail from './pages/DeckDetail.jsx';
import LinkManager from './pages/LinkManager.jsx';
import Viewer from './pages/Viewer.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/decks/:deckId" element={<DeckDetail />} />
      <Route path="/dashboard/decks/:deckId/links" element={<LinkManager />} />
      <Route path="/view/:slug" element={<Viewer />} />
    </Routes>
  );
}
