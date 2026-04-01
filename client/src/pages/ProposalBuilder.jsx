import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Link2, GripVertical, ArrowUp, ArrowDown, Trash2, Plus, Image, FileText } from 'lucide-react';
import { useProposal } from '../hooks/useProposals.js';
import { useDecks } from '../hooks/useDecks.js';
import api, { setCsrfToken } from '../lib/api.js';

// --- Constants ---

const FREQ = ['one-time', 'hourly', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'per project'];
const UNITS = ['hours', 'days', 'months', 'seats', 'projects', 'pages', 'emails', 'campaigns', 'domains', 'GB', 'requests', 'items', 'flat fee'];
const CATS = [
  { id: 'strategy', label: 'Strategy & Discovery', color: '#7F77DD' },
  { id: 'design', label: 'Design & Creative', color: '#D4537E' },
  { id: 'marketing', label: 'Marketing & Demand Gen', color: '#BA7517' },
  { id: 'engineering', label: 'Engineering & Development', color: '#378ADD' },
  { id: 'infra', label: 'Infrastructure & Hosting', color: '#1D9E75' },
  { id: 'software', label: 'Software Licenses & Tools', color: '#888780' },
  { id: 'pm', label: 'Project Management & Ops', color: '#D85A30' },
  { id: 'retainer', label: 'Retainer & Ongoing', color: '#639922' },
];

// Categories excluded from PM percentage base (pass-through costs)
const PM_EXCLUDED_CATS = ['infra', 'software', 'pm'];

const DEFAULT_ROWS = {
  strategy: [
    { name: 'Brand strategy & positioning', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Discovery & research sprint', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Content strategy', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Go-to-market strategy', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
  ],
  design: [
    { name: 'Brand identity & visual system', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'UX research & wireframing', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'UI design', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Prototyping', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Design QA & handoff', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
  ],
  marketing: [
    { name: 'Paid media strategy & management', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: false, notes: '' },
    { name: 'SEO strategy & implementation', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Email marketing & automation', unit: 'emails', qty: '1', rate: '', freq: 'monthly', passThrough: false, notes: '' },
    { name: 'Content creation & copywriting', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Marketing analytics & reporting', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: false, notes: '' },
  ],
  engineering: [
    { name: 'Web / app development', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'CMS implementation', unit: 'flat fee', qty: '1', rate: '', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'API development & integrations', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'QA testing', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
    { name: 'Performance optimization', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '' },
  ],
  infra: [
    { name: 'Hosting', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
    { name: 'Domain registration & DNS', unit: 'domains', qty: '1', rate: '', freq: 'annually', passThrough: true, notes: 'Pass-through' },
    { name: 'Cloud infrastructure', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
    { name: 'Database hosting', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
  ],
  software: [
    { name: 'Design tool licenses (Figma)', unit: 'seats', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
    { name: 'CMS platform license', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
    { name: 'Analytics platform', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: true, notes: 'Pass-through' },
  ],
  pm: [
    { name: 'Project management', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '', calcMode: 'fixed' },
    { name: 'Account management', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: false, notes: '', calcMode: 'fixed' },
    { name: 'Stakeholder facilitation', unit: 'hours', qty: '1', rate: '240', freq: 'one-time', passThrough: false, notes: '', calcMode: 'fixed' },
  ],
  retainer: [
    { name: 'Design retainer', unit: 'hours', qty: '1', rate: '240', freq: 'monthly', passThrough: false, notes: '' },
    { name: 'Engineering retainer', unit: 'hours', qty: '1', rate: '240', freq: 'monthly', passThrough: false, notes: '' },
    { name: 'Maintenance & support SLA', unit: 'months', qty: '1', rate: '', freq: 'monthly', passThrough: false, notes: '' },
  ],
};

function fmtCurrency(v) {
  if (!v) return '\u2014';
  return '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function calcLineTotal(row, percentBase) {
  if (row.calcMode === 'percent_onetime' || row.calcMode === 'percent_monthly') {
    const pct = parseFloat(row.rate);
    if (!pct || !percentBase) return null;
    return (pct / 100) * percentBase;
  }
  const q = parseFloat(row.qty);
  const r = parseFloat(row.rate);
  if (!q || !r) return null;
  return q * r;
}

// Calculate the base totals that PM percentages apply to (excludes infra, software, pm)
function calcPercentBases(sections) {
  let oneTime = 0;
  let monthly = 0;
  for (const [catId, sec] of Object.entries(sections)) {
    if (PM_EXCLUDED_CATS.includes(catId) || !sec.included) continue;
    for (const row of sec.rows) {
      if (!row.name) continue;
      const t = calcLineTotal(row);
      if (!t) continue;
      if (row.freq === 'one-time' || row.freq === 'per project') oneTime += t;
      else monthly += t;
    }
  }
  return { oneTime, monthly };
}

// --- Main Component ---

export default function ProposalBuilder() {
  const { proposalId } = useParams();
  const { proposal, loading, refetch, updateProposal, updateSlides } = useProposal(proposalId);
  const { decks } = useDecks();
  const [activeTab, setActiveTab] = useState('setup');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Ensure CSRF token is available for mutations
  useEffect(() => {
    api.get('/auth/me').then(res => {
      if (res.data.csrfToken) setCsrfToken(res.data.csrfToken);
    }).catch(() => {});
  }, []);

  // Local editable state
  const [title, setTitle] = useState('');
  const [client, setClient] = useState('');
  const [deckId, setDeckId] = useState('');
  const [sowMeta, setSowMeta] = useState({ sowDate: '', version: '1.0', preparedBy: '', expiresDate: '' });
  const [sowSections, setSowSections] = useState(() => {
    const s = {};
    CATS.forEach(c => { s[c.id] = { included: false, rows: DEFAULT_ROWS[c.id].map(r => ({ ...r, _id: Math.random().toString(36).slice(2) })) }; });
    return s;
  });
  const [slideOrder, setSlideOrder] = useState([]);

  // Populate state from loaded proposal
  useEffect(() => {
    if (!proposal) return;
    setTitle(proposal.title || '');
    setClient(proposal.client || '');
    setDeckId(proposal.deckId || '');
    setSowMeta(proposal.sowMeta || { sowDate: '', version: '1.0', preparedBy: '', expiresDate: '' });

    // Restore SOW data
    if (proposal.sowData) {
      setSowSections(prev => {
        const next = { ...prev };
        Object.entries(proposal.sowData).forEach(([catId, data]) => {
          if (next[catId]) {
            next[catId] = {
              included: data.included,
              rows: data.rows.map(r => ({ ...r, _id: Math.random().toString(36).slice(2) })),
            };
          }
        });
        return next;
      });
    }

    // Restore slide order
    if (proposal.slides?.length) {
      setSlideOrder(proposal.slides.map(s => ({
        type: s.type,
        sourceSlideIndex: s.sourceSlideIndex,
        sowCategoryId: s.sowCategoryId,
        content: s.content,
        _id: Math.random().toString(36).slice(2),
      })));
    }
  }, [proposal]);

  const readyDecks = decks.filter(d => d.exportStatus === 'done');
  const selectedDeck = decks.find(d => d.id === deckId);

  // --- Save handlers ---

  const saveMetadata = useCallback(async () => {
    setSaving(true);
    try {
      await updateProposal({
        title,
        client: client || null,
        deckId: deckId || null,
        sowMeta,
      });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }, [title, client, deckId, sowMeta, updateProposal]);

  const saveSOW = useCallback(async () => {
    setSaving(true);
    try {
      const sowData = {};
      CATS.forEach(c => {
        const sec = sowSections[c.id];
        sowData[c.id] = {
          included: sec.included,
          rows: sec.rows.map(({ _id, ...rest }) => rest),
        };
      });
      await updateProposal({ sowData });
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }, [sowSections, updateProposal]);

  const saveSlides = useCallback(async () => {
    setSaving(true);
    try {
      const slides = slideOrder.map(({ _id, ...rest }) => rest);
      await updateSlides(slides);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    }
    setSaving(false);
  }, [slideOrder, updateSlides]);

  // --- SOW section handlers ---

  const toggleSection = (catId) => {
    setSowSections(prev => ({
      ...prev,
      [catId]: { ...prev[catId], included: !prev[catId].included },
    }));
  };

  const updateRow = (catId, rowId, field, val) => {
    setSowSections(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        rows: prev[catId].rows.map(r => r._id === rowId ? { ...r, [field]: val } : r),
      },
    }));
  };

  const addRow = (catId) => {
    const isHourly = !['infra', 'software'].includes(catId);
    const newRow = {
      _id: Math.random().toString(36).slice(2),
      name: '', unit: isHourly ? 'hours' : 'months', qty: '1',
      rate: isHourly ? '240' : '', freq: 'one-time', passThrough: false, notes: '',
      ...(catId === 'pm' && { calcMode: 'fixed' }),
    };
    setSowSections(prev => ({
      ...prev,
      [catId]: { ...prev[catId], rows: [...prev[catId].rows, newRow] },
    }));
  };

  const removeRow = (catId, rowId) => {
    setSowSections(prev => ({
      ...prev,
      [catId]: {
        ...prev[catId],
        rows: prev[catId].rows.filter(r => r._id !== rowId),
      },
    }));
  };

  // --- Slide order helpers ---

  const buildSlideOrder = useCallback(() => {
    const slides = [];

    // Add deck slides if a deck is selected
    if (selectedDeck) {
      for (let i = 0; i < selectedDeck.slideCount; i++) {
        slides.push({
          type: 'deck_slide',
          sourceSlideIndex: i,
          _id: `deck_${i}`,
        });
      }
    }

    // Add SOW category slides
    CATS.forEach(cat => {
      if (!sowSections[cat.id].included) return;
      const rows = sowSections[cat.id].rows.filter(r => r.name);
      if (!rows.length) return;
      slides.push({
        type: 'sow_section',
        sowCategoryId: cat.id,
        content: { rows: rows.map(({ _id, ...rest }) => rest) },
        _id: `sow_${cat.id}`,
      });
    });

    // Add totals slide if we have any SOW sections
    const includedCats = CATS.filter(c => sowSections[c.id].included);
    if (includedCats.length > 0) {
      const categories = includedCats.map(cat => {
        const rows = sowSections[cat.id].rows.filter(r => r.name);
        const subtotal = rows.reduce((acc, r) => { const t = calcLineTotal(r); return t ? acc + t : acc; }, 0);
        const passThrough = rows.filter(r => r.passThrough).reduce((acc, r) => { const t = calcLineTotal(r); return t ? acc + t : acc; }, 0);
        return { categoryId: cat.id, subtotal, passThrough };
      }).filter(c => c.subtotal > 0);

      if (categories.length > 0) {
        slides.push({
          type: 'sow_totals',
          content: { categories, sowMeta },
          _id: 'sow_totals',
        });
      }
    }

    setSlideOrder(slides);
  }, [selectedDeck, sowSections, sowMeta]);

  const moveSlide = (index, direction) => {
    const newOrder = [...slideOrder];
    const target = index + direction;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    setSlideOrder(newOrder);
  };

  const removeSlide = (index) => {
    setSlideOrder(prev => prev.filter((_, i) => i !== index));
  };

  // --- Render ---

  if (loading || !proposal) {
    return (
      <div className="container">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 120 }} />)}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'setup', label: 'Setup' },
    { id: 'sow', label: 'SOW' },
    { id: 'arrange', label: 'Arrange' },
    { id: 'links', label: 'Links' },
  ];

  return (
    <div className="container">
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link to="/dashboard/proposals" style={{ color: 'var(--text)' }}><ArrowLeft size={20} /></Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 24 }}>{proposal.title}</h1>
          {proposal.client && <p style={{ fontSize: 13, marginTop: 2 }}>{proposal.client}</p>}
        </div>
        {lastSaved && <span style={{ fontSize: 12, color: 'var(--text)' }}>Saved {lastSaved.toLocaleTimeString()}</span>}
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              fontSize: 14, padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: activeTab === t.id ? 'var(--text-h)' : 'var(--text)',
              fontWeight: activeTab === t.id ? 600 : 400, cursor: 'pointer',
              marginBottom: -1,
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Setup Tab */}
      {activeTab === 'setup' && (
        <SetupTab
          title={title} setTitle={setTitle}
          client={client} setClient={setClient}
          deckId={deckId} setDeckId={setDeckId}
          sowMeta={sowMeta} setSowMeta={setSowMeta}
          readyDecks={readyDecks}
          saving={saving} onSave={saveMetadata}
        />
      )}

      {/* SOW Tab */}
      {activeTab === 'sow' && (
        <SOWTab
          sections={sowSections}
          toggleSection={toggleSection}
          updateRow={updateRow}
          addRow={addRow}
          removeRow={removeRow}
          saving={saving}
          onSave={saveSOW}
          allSections={sowSections}
        />
      )}

      {/* Arrange Tab */}
      {activeTab === 'arrange' && (
        <ArrangeTab
          slideOrder={slideOrder}
          setSlideOrder={setSlideOrder}
          removeSlide={removeSlide}
          buildSlideOrder={buildSlideOrder}
          deckId={deckId}
          saving={saving}
          onSave={saveSlides}
        />
      )}

      {/* Links Tab */}
      {activeTab === 'links' && (
        <LinksTab proposalId={proposalId} />
      )}
    </div>
  );
}

// --- Sub-components ---

function SetupTab({ title, setTitle, client, setClient, deckId, setDeckId, sowMeta, setSowMeta, readyDecks, saving, onSave }) {
  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Proposal Details</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Project title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Project title" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Client name</label>
            <input value={client} onChange={e => setClient(e.target.value)} placeholder="Client name" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>SOW Metadata</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>SOW date</label>
            <input value={sowMeta.sowDate} onChange={e => setSowMeta(m => ({ ...m, sowDate: e.target.value }))} placeholder="YYYY-MM-DD" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Version</label>
            <input value={sowMeta.version} onChange={e => setSowMeta(m => ({ ...m, version: e.target.value }))} placeholder="1.0" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Prepared by</label>
            <input value={sowMeta.preparedBy} onChange={e => setSowMeta(m => ({ ...m, preparedBy: e.target.value }))} placeholder="Name" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 4 }}>Expires</label>
            <input value={sowMeta.expiresDate} onChange={e => setSowMeta(m => ({ ...m, expiresDate: e.target.value }))} placeholder="YYYY-MM-DD" />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 16 }}>Linked Presentation</h3>
        <select value={deckId} onChange={e => setDeckId(e.target.value)} style={{ width: '100%' }}>
          <option value="">No deck linked</option>
          {readyDecks.map(d => (
            <option key={d.id} value={d.id}>{d.title} ({d.slideCount} slides)</option>
          ))}
        </select>
        <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 8 }}>
          Slides from this deck will be available to include in your proposal.
        </p>
      </div>

      <button className="btn btn-primary" onClick={onSave} disabled={saving}>
        <Save size={14} /> {saving ? 'Saving...' : 'Save Setup'}
      </button>
    </div>
  );
}

function SOWTab({ sections, toggleSection, updateRow, addRow, removeRow, saving, onSave, allSections }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const percentBases = calcPercentBases(allSections);

  const isPm = (catId) => catId === 'pm';
  const CALC_MODES = [
    { value: 'fixed', label: 'Fixed' },
    { value: 'percent_onetime', label: '% of one-time fees' },
    { value: 'percent_monthly', label: '% of monthly fees' },
  ];

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--text)', marginBottom: 16 }}>
        Select service categories to include, then configure line items for each.
      </p>

      {CATS.map(cat => {
        const sec = sections[cat.id];
        const isExpanded = expandedCat === cat.id;
        const subtotal = sec.rows.filter(r => r.name).reduce((acc, r) => {
          const base = r.calcMode === 'percent_onetime' ? percentBases.oneTime : r.calcMode === 'percent_monthly' ? percentBases.monthly : undefined;
          const t = calcLineTotal(r, base);
          return t ? acc + t : acc;
        }, 0);

        return (
          <div key={cat.id} className="card" style={{ marginBottom: 8, padding: 0 }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                background: sec.included ? 'var(--bg-secondary)' : 'transparent',
              }}
              onClick={() => toggleSection(cat.id)}
            >
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: sec.included ? cat.color : 'var(--border)', flexShrink: 0,
              }} />
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1, color: 'var(--text-h)' }}>{cat.label}</span>
              {sec.included && subtotal > 0 && (
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{fmtCurrency(subtotal)}</span>
              )}
              <span
                className={`badge ${sec.included ? 'badge-success' : ''}`}
                style={!sec.included ? { background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' } : {}}
              >
                {sec.included ? 'included' : 'not included'}
              </span>
              {sec.included && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpandedCat(isExpanded ? null : cat.id); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text)', fontSize: 16, padding: '0 4px' }}
                >
                  {isExpanded ? '\u25BE' : '\u25B8'}
                </button>
              )}
            </div>

            {sec.included && isExpanded && (
              <div style={{ padding: '0 16px 12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {[
                        'Line item',
                        ...(isPm(cat.id) ? ['Pricing'] : []),
                        'Unit', 'Qty',
                        isPm(cat.id) ? 'Rate / %' : 'Rate',
                        'Freq', 'Pass-through', 'Notes', '',
                      ].map(h => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sec.rows.map(row => {
                      const isPercent = row.calcMode === 'percent_onetime' || row.calcMode === 'percent_monthly';
                      const base = row.calcMode === 'percent_onetime' ? percentBases.oneTime : row.calcMode === 'percent_monthly' ? percentBases.monthly : undefined;
                      const lineTotal = calcLineTotal(row, base);

                      return (
                        <tr key={row._id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '4px 6px' }}><input value={row.name} onChange={e => updateRow(cat.id, row._id, 'name', e.target.value)} placeholder="Line item" style={{ fontSize: 13 }} /></td>
                          {isPm(cat.id) && (
                            <td style={{ padding: '4px 6px', width: 150 }}>
                              <select value={row.calcMode || 'fixed'} onChange={e => updateRow(cat.id, row._id, 'calcMode', e.target.value)} style={{ fontSize: 12 }}>
                                {CALC_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                              </select>
                            </td>
                          )}
                          <td style={{ padding: '4px 6px', width: 110 }}>
                            {isPercent ? (
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>
                                {row.calcMode === 'percent_onetime' ? `of ${fmtCurrency(percentBases.oneTime)}` : `of ${fmtCurrency(percentBases.monthly)}`}
                              </span>
                            ) : (
                              <select value={row.unit} onChange={e => updateRow(cat.id, row._id, 'unit', e.target.value)} style={{ fontSize: 13 }}>
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px', width: 70 }}>
                            {isPercent ? (
                              <span style={{ fontSize: 12, color: 'var(--text)', textAlign: 'right', display: 'block' }}>{lineTotal ? fmtCurrency(lineTotal) : '\u2014'}</span>
                            ) : (
                              <input type="number" value={row.qty} onChange={e => updateRow(cat.id, row._id, 'qty', e.target.value)} placeholder="1" min="0" style={{ fontSize: 13, textAlign: 'right' }} />
                            )}
                          </td>
                          <td style={{ padding: '4px 6px', width: 90 }}>
                            <div style={{ position: 'relative' }}>
                              <input type="number" value={row.rate} onChange={e => updateRow(cat.id, row._id, 'rate', e.target.value)} placeholder={isPercent ? '10' : '0.00'} min="0" style={{ fontSize: 13, textAlign: 'right', paddingRight: isPercent ? 20 : undefined }} />
                              {isPercent && <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text)', pointerEvents: 'none' }}>%</span>}
                            </div>
                          </td>
                          <td style={{ padding: '4px 6px', width: 110 }}>
                            {isPercent ? (
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{row.calcMode === 'percent_onetime' ? 'one-time' : 'monthly'}</span>
                            ) : (
                              <select value={row.freq} onChange={e => updateRow(cat.id, row._id, 'freq', e.target.value)} style={{ fontSize: 13 }}>
                                {FREQ.map(f => <option key={f} value={f}>{f}</option>)}
                              </select>
                            )}
                          </td>
                          <td style={{ padding: '4px 6px', width: 40, textAlign: 'center' }}>
                            <input type="checkbox" checked={row.passThrough} onChange={e => updateRow(cat.id, row._id, 'passThrough', e.target.checked)} style={{ accentColor: '#1D9E75' }} />
                          </td>
                          <td style={{ padding: '4px 6px' }}><input value={row.notes} onChange={e => updateRow(cat.id, row._id, 'notes', e.target.value)} placeholder="Notes..." style={{ fontSize: 13 }} /></td>
                          <td style={{ padding: '4px 6px', width: 30, textAlign: 'center' }}>
                            <button onClick={() => removeRow(cat.id, row._id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 14, padding: 0 }}>&times;</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <button onClick={() => addRow(cat.id)} style={{ fontSize: 12, color: 'var(--text)', background: 'none', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', padding: '4px 12px', marginTop: 8, cursor: 'pointer' }}>
                  + add line item
                </button>
                {isPm(cat.id) && (percentBases.oneTime > 0 || percentBases.monthly > 0) && (
                  <div style={{ fontSize: 11, color: 'var(--text)', marginTop: 8, padding: '6px 0', borderTop: '1px solid var(--border)' }}>
                    Percentage bases (excl. infra, software, PM): one-time {fmtCurrency(percentBases.oneTime)} &middot; monthly {fmtCurrency(percentBases.monthly)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-primary" onClick={onSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save SOW'}
        </button>
      </div>
    </div>
  );
}

function ArrangeTab({ slideOrder, setSlideOrder, removeSlide, buildSlideOrder, deckId, saving, onSave }) {
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  const catInfo = {
    strategy: { label: 'Strategy & Discovery', color: '#7F77DD' },
    design: { label: 'Design & Creative', color: '#D4537E' },
    marketing: { label: 'Marketing & Demand Gen', color: '#BA7517' },
    engineering: { label: 'Engineering & Development', color: '#378ADD' },
    infra: { label: 'Infrastructure & Hosting', color: '#1D9E75' },
    software: { label: 'Software Licenses & Tools', color: '#888780' },
    pm: { label: 'Project Management & Ops', color: '#D85A30' },
    retainer: { label: 'Retainer & Ongoing', color: '#639922' },
  };

  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image slightly transparent
    if (e.currentTarget) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== overIndex) setOverIndex(index);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const newOrder = [...slideOrder];
    const [dragged] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, dragged);
    setSlideOrder(newOrder);
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn-secondary btn-sm" onClick={buildSlideOrder}>
          Rebuild slide order from Setup &amp; SOW
        </button>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Order'}
        </button>
      </div>

      {slideOrder.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--text)' }}>
            No slides yet. Configure your deck and SOW sections first, then click "Rebuild slide order".
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {slideOrder.map((slide, i) => {
            const cat = slide.sowCategoryId ? catInfo[slide.sowCategoryId] : null;
            const isDragging = dragIndex === i;
            const isOver = overIndex === i && dragIndex !== i;

            return (
              <div
                key={slide._id || i}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => handleDragOver(e, i)}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                className="card"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  cursor: 'grab',
                  opacity: isDragging ? 0.4 : 1,
                  borderTop: isOver && dragIndex > i ? '2px solid var(--accent)' : undefined,
                  borderBottom: isOver && dragIndex < i ? '2px solid var(--accent)' : undefined,
                  transition: 'border 0.1s ease',
                }}
              >
                <GripVertical size={14} color="var(--text)" style={{ flexShrink: 0, opacity: 0.4 }} />
                <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, width: 24, textAlign: 'center', flexShrink: 0 }}>{i + 1}</span>

                {slide.type === 'deck_slide' ? (
                  <>
                    <Image size={16} color="var(--accent)" />
                    <span style={{ flex: 1, fontSize: 14 }}>
                      Deck slide {slide.sourceSlideIndex + 1}
                    </span>
                    {deckId && (
                      <img
                        src={`/api/decks/${deckId}/slides/${slide.sourceSlideIndex}/image`}
                        alt=""
                        style={{ height: 40, borderRadius: 4, border: '1px solid var(--border)' }}
                        draggable={false}
                      />
                    )}
                  </>
                ) : slide.type === 'sow_section' ? (
                  <>
                    <div style={{ width: 16, height: 16, borderRadius: '50%', background: cat?.color || '#666', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>
                      <FileText size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                      {cat?.label || slide.sowCategoryId}
                    </span>
                  </>
                ) : (
                  <>
                    <FileText size={16} color="var(--success)" />
                    <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>Investment Summary</span>
                  </>
                )}

                <button className="btn btn-danger btn-sm" style={{ padding: '4px 6px' }} onClick={() => removeSlide(i)}>
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p style={{ fontSize: 12, color: 'var(--text)', marginTop: 12 }}>
        Total: {slideOrder.length} slide{slideOrder.length !== 1 ? 's' : ''}. Drag to reorder.
      </p>
    </div>
  );
}

function LinksTab({ proposalId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState('');
  const [copied, setCopied] = useState(null);

  const fetchLinks = useCallback(async () => {
    try {
      const res = await api.get(`/api/proposals/${proposalId}/links`);
      setLinks(res.data);
    } catch {
      // handle silently
    }
    setLoading(false);
  }, [proposalId]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const createLink = async () => {
    setCreating(true);
    try {
      const res = await api.post(`/api/proposals/${proposalId}/links`, { label: label || undefined });
      setLinks(prev => [res.data, ...prev]);
      setLabel('');
    } catch {
      // handle silently
    }
    setCreating(false);
  };

  const toggleActive = async (linkId, active) => {
    await api.patch(`/api/proposals/${proposalId}/links/${linkId}`, { active });
    setLinks(prev => prev.map(l => l.id === linkId ? { ...l, active } : l));
  };

  const deleteLink = async (linkId) => {
    await api.delete(`/api/proposals/${proposalId}/links/${linkId}`);
    setLinks(prev => prev.filter(l => l.id !== linkId));
  };

  const copyUrl = (slug) => {
    const url = `${window.location.origin}/view/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, marginBottom: 12 }}>Create Share Link</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Optional label (e.g. 'Client review')"
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary btn-sm" onClick={createLink} disabled={creating}>
            <Link2 size={14} /> {creating ? 'Creating...' : 'Create Link'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 80 }} />
      ) : links.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ color: 'var(--text)' }}>No share links yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {links.map(link => (
            <div key={link.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  {link.label && <span style={{ fontWeight: 500, fontSize: 14 }}>{link.label}</span>}
                  <span className={`badge ${link.active ? 'badge-success' : 'badge-danger'}`}>
                    {link.active ? 'Active' : 'Inactive'}
                  </span>
                  {link._count?.sessions > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{link._count.sessions} view{link._count.sessions !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <code style={{ fontSize: 12, color: 'var(--text)' }}>/view/{link.slug}</code>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyUrl(link.slug)}>
                  {copied === link.slug ? 'Copied!' : 'Copy'}
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => toggleActive(link.id, !link.active)}
                >
                  {link.active ? 'Disable' : 'Enable'}
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => deleteLink(link.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
