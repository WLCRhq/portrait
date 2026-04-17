import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import DeckDetail from './pages/DeckDetail.jsx';
import LinkManager from './pages/LinkManager.jsx';
import Proposals from './pages/Proposals.jsx';
import ProposalBuilder from './pages/ProposalBuilder.jsx';
import Viewer from './pages/Viewer.jsx';
import api, { setCsrfToken } from './lib/api.js';

export default function App() {
  // Initialize CSRF token once on app load so all pages can make mutations
  useEffect(() => {
    api.get('/auth/me').then(res => {
      if (res.data?.csrfToken) setCsrfToken(res.data.csrfToken);
    }).catch(() => {});
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dashboard/decks/:deckId" element={<DeckDetail />} />
      <Route path="/dashboard/decks/:deckId/links" element={<LinkManager />} />
      <Route path="/dashboard/proposals" element={<Proposals />} />
      <Route path="/dashboard/proposals/:proposalId" element={<ProposalBuilder />} />
      <Route path="/view/:slug" element={<Viewer />} />
    </Routes>
  );
}
