import { useState } from 'react';
import { verifyAccountNature, auditBalanceAccounts, auditCrossAccountMovements } from '../utils/financeCalculations';

// Cellule adaptative intelligente avec échelle de division et arrondi
const NumCell = ({ val, isBold, color, activeDivisor = 1, rounding = 2, style = {} }) => {
  if (val === undefined || val === null || Math.abs(val) < 0.001) {
    return <td className="right" style={{ padding: '4px 3px', color: 'var(--text-sub)', ...style }}>—</td>;
  }
  const scaled = val / activeDivisor;
  const decimals = Number.isInteger(rounding) ? rounding : 2;
  const str = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(scaled);
  const len = str.length;

  let fontSize = '0.72rem';
  let letterSpacing = 'normal';
  if (len > 15) {
    fontSize = '0.54rem';
    letterSpacing = '-0.04em';
  } else if (len > 12) {
    fontSize = '0.60rem';
    letterSpacing = '-0.03em';
  } else if (len > 9) {
    fontSize = '0.66rem';
    letterSpacing = '-0.02em';
  }

  return (
    <td
      className="right"
      title={`${str} (Val. réelles: ${val.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} DA)`}
      style={{
        padding: '4px 3px',
        fontSize,
        letterSpacing,
        fontWeight: isBold ? 800 : 400,
        color: color || 'inherit',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style
      }}
    >
      {str}
    </td>
  );
};

export function BalanceView({ rows }) {
  const [divisor, setDivisor] = useState(1);
  const [customDivisorInput, setCustomDivisorInput] = useState('1000');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [rounding, setRounding] = useState(2); // 0 (entier), 1 (.0), 2 (.00)

  const activeDivisor = Math.max(1, Number(divisor) || 1);

  const cleanLib = (str) => {
    if (!str) return '';
    return str.replace(/\uFFFD/g, "'").trim();
  };

  const [mainFilter, setMainFilter] = useState('all'); // 'all', 'bilan', 'gestion'
  const [subFilter, setSubFilter] = useState('all');
  const [simFilter, setSimFilter] = useState('all'); // 'all', 'sim_only', 'real_only'
  const [auditFilter, setAuditFilter] = useState('all'); // 'all', 'anomalies', 'atypiques', 'conformes'
  const [viewMode, setViewMode] = useState('full'); // 'full' (6 col) ou 'summary' (soldes finaux)
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeAuditTab, setActiveAuditTab] = useState('natures'); // 'natures' | 'flux'

  const audit = rows && rows.length > 0 ? auditBalanceAccounts(rows) : null;
  const crossAudit = rows && rows.length > 0 ? auditCrossAccountMovements(rows) : null;

  if (!rows || rows.length === 0) {
    return (
      <div className="card fade-in" style={{ maxWidth: 450, margin: '60px auto', textAlign: 'center', padding: '48px 32px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }}>account_balance</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>Balance non disponible</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Veuillez d'abord importer une balance comptable.</p>
      </div>
    );
  }

  const getAccountType = (compte) => {
    if (!compte) return 'unknown';
    const c = compte.toString().trim();
    if (/^[1-5]/.test(c)) return 'bilan';
    if (/^[6-7]/.test(c)) return 'gestion';
    return 'unknown';
  };

  const matchesSubFilter = (row) => {
    if (subFilter === 'all') return true;
    const c = String(row.compte || '').trim();
    const solde = row.solde || 0;

    if (mainFilter === 'bilan') {
      switch (subFilter) {
        case 'immo': return c.startsWith('2');
        case 'capitaux': return c.startsWith('1') && !c.startsWith('16');
        case 'stock': return c.startsWith('3');
        case 'client': return c.startsWith('41');
        case 'emprunt': return c.startsWith('16');
        case 'fournisseur': return c.startsWith('40');
        case 'autres_deb': return c.startsWith('4') && !c.startsWith('40') && !c.startsWith('41') && solde > 0;
        case 'autres_cred': return c.startsWith('4') && !c.startsWith('40') && !c.startsWith('41') && solde < 0;
        case 'tres_actif': return c.startsWith('5') && !c.startsWith('519') && solde >= 0;
        case 'tres_passif': return c.startsWith('519') || (c.startsWith('5') && solde < 0);
        default: return true;
      }
    } else if (mainFilter === 'gestion') {
      switch (subFilter) {
        case 'charges': return c.startsWith('6');
        case 'produits': return c.startsWith('7');
        default: return true;
      }
    }
    return true;
  };

  const filteredRows = rows.filter(row => {
    if (mainFilter !== 'all' && getAccountType(row.compte) !== mainFilter) return false;
    if (!matchesSubFilter(row)) return false;

    // 📝 Filtre Écritures Simulées vs Comptes Réels
    const isSim = !!(row.isSimulation || row.isSimulationImpacted);
    if (simFilter === 'sim_only' && !isSim) return false;
    if (simFilter === 'real_only' && isSim) return false;

    // 🛡️ Filtre Audit & Natures SCF
    if (auditFilter !== 'all') {
      const deb = Number(row.soldeFinDebit) || (row.solde > 0 ? row.solde : 0);
      const cred = Number(row.soldeFinCredit) || (row.solde < 0 ? -row.solde : 0);
      const verif = verifyAccountNature(row.compte, deb, cred);
      if (auditFilter === 'anomalies' && verif.statut !== 'ANOMALIE') return false;
      if (auditFilter === 'atypiques' && verif.statut !== 'ATYPIQUE') return false;
      if (auditFilter === 'conformes' && verif.statut !== 'CONFORME') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const compte = String(row.compte || '').toLowerCase();
      const libelle = String(row.libelle || '').toLowerCase();
      return compte.includes(q) || libelle.includes(q);
    }
    return true;
  });

  const totals = filteredRows.reduce((acc, cur) => {
    if (cur.ignore) return acc;
    return {
      soldeDebutDebit:  acc.soldeDebutDebit  + (cur.soldeDebutDebit  || 0),
      soldeDebutCredit: acc.soldeDebutCredit + (cur.soldeDebutCredit || 0),
      mouvementDebit:   acc.mouvementDebit   + (cur.mouvementDebit   || 0),
      mouvementCredit:  acc.mouvementCredit  + (cur.mouvementCredit  || 0),
      soldeFinDebit:    acc.soldeFinDebit    + (cur.soldeFinDebit    || 0),
      soldeFinCredit:   acc.soldeFinCredit   + (cur.soldeFinCredit   || 0),
    };
  }, { soldeDebutDebit: 0, soldeDebutCredit: 0, mouvementDebit: 0, mouvementCredit: 0, soldeFinDebit: 0, soldeFinCredit: 0 });

  const handleMainFilter = (f) => {
    setMainFilter(f);
    setSubFilter('all');
    setCurrentPage(1);
  };

  const handleSubFilter = (sf) => {
    setSubFilter(sf);
    setCurrentPage(1);
  };

  const handleSearch = (q) => {
    setSearchQuery(q);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalItems = filteredRows.length;
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize);
  const startIndex = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex   = pageSize === 'all' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedRows = pageSize === 'all' ? filteredRows : filteredRows.slice(startIndex, endIndex);

  const bilanSubFilters = [
    { id: 'all', label: 'Tous (1-5)' },
    { id: 'capitaux', label: '1 — Capitaux' },
    { id: 'immo', label: '2 — Immobilisations' },
    { id: 'stock', label: '3 — Stocks' },
    { id: 'fournisseur', label: '40 — Fournisseurs' },
    { id: 'client', label: '41 — Clients' },
    { id: 'emprunt', label: '16 — Emprunts' },
    { id: 'tres_actif', label: '5 — Trésorerie Active' },
    { id: 'tres_passif', label: '519 — Découverts' },
  ];

  const gestionSubFilters = [
    { id: 'all', label: 'Tous (6-7)' },
    { id: 'charges', label: '6 — Charges' },
    { id: 'produits', label: '7 — Produits' },
  ];

  const isSummary = viewMode === 'summary';

  const getDivisorLabel = () => {
    if (activeDivisor === 1) return 'Dinars (Unité)';
    if (activeDivisor === 1000) return 'Milliers de Dinars (kDA)';
    if (activeDivisor === 1000000) return 'Millions de Dinars (MDA)';
    return `Diviseur ÷ ${activeDivisor.toLocaleString('fr-FR')}`;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
      {/* Top Header & Search Bar */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h2 className="section-title" style={{ fontSize: '1.35rem', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              Balance Générale des Comptes
              {activeDivisor > 1 && (
                <span style={{ fontSize: '0.7rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 10px', borderRadius: 20 }}>
                  en {getDivisorLabel()}
                </span>
              )}
            </h2>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Consultation interactive du Grand Livre et contrôle des mouvements.
            </div>
          </div>

          {/* Controls: Search Box, Divisor & View Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>

            {/* 🧮 Sélecteur de Diviseur / Échelle d'affichage */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: '#2563eb' }}>tune</span>
                Diviseur :
              </span>
              {[
                { val: 1, label: 'x1 (DA)' },
                { val: 1000, label: 'x1 000 (kDA)' },
                { val: 1000000, label: 'x1M (MDA)' },
              ].map(d => (
                <button
                  key={d.val}
                  onClick={() => { setDivisor(d.val); setIsCustomMode(false); }}
                  style={{
                    padding: '4px 8px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                    background: !isCustomMode && activeDivisor === d.val ? '#2563eb' : 'transparent',
                    color: !isCustomMode && activeDivisor === d.val ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s'
                  }}
                >
                  {d.label}
                </button>
              ))}

              {/* Saisie personnalisée */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 4, paddingLeft: 6, borderLeft: '1px solid var(--border)' }}>
                <input
                  type="number"
                  placeholder="Ex: 1000"
                  value={customDivisorInput}
                  onChange={e => {
                    setCustomDivisorInput(e.target.value);
                    const parsed = Number(e.target.value);
                    if (parsed > 0) {
                      setDivisor(parsed);
                      setIsCustomMode(true);
                    }
                  }}
                  style={{ width: 64, padding: '3px 6px', fontSize: '0.72rem', fontWeight: 800, border: isCustomMode ? '1px solid #2563eb' : '1px solid var(--border)', borderRadius: 6, outline: 'none', background: isCustomMode ? '#eff6ff' : '#fff' }}
                />
              </div>
            </div>

            {/* Sélecteur d'Arrondi (0, 1, 2 décimales) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8fafc', padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>ARRONDI :</span>
              <div style={{ display: 'flex', background: '#e2e8f0', padding: 2, borderRadius: 6, gap: 1 }}>
                {[
                  { id: 0, label: '0 (Entier)' },
                  { id: 1, label: '1 (.0)' },
                  { id: 2, label: '2 (.00)' },
                ].map(r => (
                  <button
                    key={r.id}
                    onClick={() => setRounding(r.id)}
                    style={{
                      padding: '3px 7px',
                      borderRadius: 5,
                      border: 'none',
                      fontSize: '0.71rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: rounding === r.id ? '#2563eb' : 'transparent',
                      color: rounding === r.id ? '#ffffff' : 'var(--text)',
                      boxShadow: rounding === r.id ? '0 1px 3px rgba(37,99,235,0.3)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Toggle Button */}
            <div style={{ display: 'flex', background: '#f1f5f9', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
              <button
                onClick={() => setViewMode('summary')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: isSummary ? '#ffffff' : 'transparent',
                  color: isSummary ? 'var(--primary-dk)' : 'var(--text-muted)',
                  boxShadow: isSummary ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Vue Synthétique (4 col.)
              </button>
              <button
                onClick={() => setViewMode('full')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 6,
                  border: 'none',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: !isSummary ? '#ffffff' : 'transparent',
                  color: !isSummary ? 'var(--primary-dk)' : 'var(--text-muted)',
                  boxShadow: !isSummary ? 'var(--shadow-sm)' : 'none'
                }}
              >
                Vue Complète (6 col.)
              </button>
            </div>

            {/* Search Box */}
            <div style={{ position: 'relative', minWidth: 220, maxWidth: 280 }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-sub)' }}>search</span>
              <input
                type="text"
                placeholder="Chercher compte..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 32px 8px 34px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: '#f8fafc',
                  fontSize: '0.82rem',
                  outline: 'none',
                  color: 'var(--text)',
                  fontFamily: 'Inter, sans-serif'
                }}
              />
              {searchQuery && (
                <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Primary Tabs & Simulation Filter */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'Tous les comptes (1 à 7)', icon: 'list_alt' },
                { id: 'bilan', label: 'Comptes de Bilan (1 à 5)', icon: 'account_balance' },
                { id: 'gestion', label: 'Comptes de Gestion (6 et 7)', icon: 'analytics' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => handleMainFilter(f.id)}
                  className={`btn ${mainFilter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                  style={{
                    fontSize: '0.76rem',
                    padding: '6px 12px',
                    borderRadius: 8,
                    fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{f.icon}</span>
                  {f.label}
                </button>
              ))}
            </div>

            {/* 📝 Filtre Écritures de Simulation */}
            <div style={{ display: 'flex', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: 3, gap: 2 }}>
              {[
                { id: 'all',       label: 'Tous les comptes', icon: 'apps' },
                { id: 'sim_only',  label: 'Écritures Simulées 📝', icon: 'edit_note' },
                { id: 'real_only', label: 'Comptes Réels 🔵', icon: 'verified' },
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSimFilter(s.id); setCurrentPage(1); }}
                  style={{
                    padding: '4px 10px', borderRadius: 6, border: 'none', fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer',
                    background: simFilter === s.id ? '#059669' : 'transparent',
                    color: simFilter === s.id ? '#ffffff' : '#166534',
                    transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 4
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{s.icon}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-filters chips */}
          {mainFilter !== 'all' && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
              {(mainFilter === 'bilan' ? bilanSubFilters : gestionSubFilters).map(sf => (
                <button
                  key={sf.id}
                  onClick={() => handleSubFilter(sf.id)}
                  style={{
                    padding: '3px 10px',
                    borderRadius: 20,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: '1px solid',
                    borderColor: subFilter === sf.id ? 'var(--primary)' : 'var(--border)',
                    background: subFilter === sf.id ? 'var(--primary-lt)' : '#ffffff',
                    color: subFilter === sf.id ? 'var(--primary-dk)' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sf.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Account Counter & Pagination Controls Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-blue" style={{ fontSize: '0.73rem', padding: '4px 10px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 13, marginRight: 4 }}>tag</span>
            {totalItems} comptes affichés
          </span>
          {activeDivisor > 1 && (
            <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
              (Montants divisés par ÷ {activeDivisor.toLocaleString('fr-FR')})
            </span>
          )}
          {auditFilter !== 'all' && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: auditFilter === 'anomalies' ? '#dc2626' : auditFilter === 'atypiques' ? '#d97706' : '#059669' }}>
              [Filtre Audit : {auditFilter.toUpperCase()}]
            </span>
          )}
          {searchQuery && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              pour « <strong>{searchQuery}</strong> »
            </span>
          )}
        </div>

        {/* Pagination & Rows per page */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Afficher:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                setPageSize(val);
                setCurrentPage(1);
              }}
              style={{
                padding: '3px 8px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                fontSize: '0.75rem',
                color: 'var(--text)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value="all">Tous ({totalItems})</option>
            </select>
          </div>

          {pageSize !== 'all' && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="btn btn-ghost"
                style={{ padding: '3px 6px', fontSize: '0.75rem', opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chevron_left</span>
              </button>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)', padding: '0 4px' }}>
                Page {currentPage} / {totalPages}
              </span>

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="btn btn-ghost"
                style={{ padding: '3px 6px', fontSize: '0.75rem', opacity: currentPage === totalPages ? 0.4 : 1 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>chevron_right</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Data Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ maxHeight: '680px', overflowY: 'auto' }}>
          <table className="data-table compact-table grid-lines" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.74rem' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-alt)' }}>
              {isSummary ? (
                <tr>
                  <th style={{ width: '10%' }}>COMPTE</th>
                  <th style={{ width: '50%' }}>INTITULÉ DU COMPTE</th>
                  <th className="right" style={{ color: 'var(--primary-dk)', width: '20%' }}>SOLDE DÉBIT (N)</th>
                  <th className="right" style={{ color: 'var(--primary-dk)', width: '20%' }}>SOLDE CRÉDIT (N)</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '8%', padding: '6px 6px' }}>COMPTE</th>
                  <th style={{ width: '32%', padding: '6px 8px' }}>INTITULÉ DU COMPTE</th>
                  <th className="right" style={{ width: '10%', padding: '6px 4px' }}>INIT. DÉB.</th>
                  <th className="right" style={{ width: '10%', padding: '6px 4px' }}>INIT. CRÉD.</th>
                  <th className="right" style={{ width: '10%', padding: '6px 4px' }}>MOUV. DÉB.</th>
                  <th className="right" style={{ width: '10%', padding: '6px 4px' }}>MOUV. CRÉD.</th>
                  <th className="right" style={{ color: 'var(--primary-dk)', width: '10%', padding: '6px 4px' }}>FIN DÉB.</th>
                  <th className="right" style={{ color: 'var(--primary-dk)', width: '10%', padding: '6px 4px' }}>FIN CRÉD.</th>
                </tr>
              )}
            </thead>
            <tbody>
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={isSummary ? 4 : 8} style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aucun compte ne correspond aux filtres sélectionnés.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, i) => {
                  const cleanedLib = cleanLib(row.libelle);
                  const isDebitFin = (row.soldeFinDebit || 0) > 0.001;
                  const isCreditFin = (row.soldeFinCredit || 0) > 0.001;

                  if (isSummary) {
                    return (
                      <tr key={i} style={{ opacity: row.ignore ? 0.5 : 1, background: row.isSimulation ? 'rgba(16,185,129,0.08)' : row.isSimulationImpacted ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                        <td style={{ padding: '5px 8px' }}>
                          <span className="mono" style={{ fontWeight: 700, color: row.isSimulation ? '#059669' : 'var(--primary-dk)', fontSize: '0.78rem' }}>
                            {row.compte}
                          </span>
                        </td>
                        <td style={{ padding: '5px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cleanedLib}>
                          {cleanedLib}
                          {(row.isSimulation || row.isSimulationImpacted) && (
                            <span style={{ marginLeft: 8, fontSize: '0.62rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>
                              SIMULATION 📝
                            </span>
                          )}
                        </td>
                        <NumCell val={row.soldeFinDebit} activeDivisor={activeDivisor} rounding={rounding} isBold={isDebitFin} color={isDebitFin ? 'var(--primary-dk)' : null} />
                        <NumCell val={row.soldeFinCredit} activeDivisor={activeDivisor} rounding={rounding} isBold={isCreditFin} color={isCreditFin ? 'var(--primary-dk)' : null} />
                      </tr>
                    );
                  }

                  return (
                    <tr key={i} style={{ opacity: row.ignore ? 0.5 : 1, background: row.isSimulation ? 'rgba(16,185,129,0.08)' : row.isSimulationImpacted ? 'rgba(59,130,246,0.08)' : 'transparent' }}>
                      <td style={{ padding: '4px 6px' }}>
                        <span className="mono" style={{ fontWeight: 700, color: row.isSimulation ? '#059669' : 'var(--primary-dk)', fontSize: '0.75rem' }}>
                          {row.compte}
                        </span>
                      </td>
                      <td style={{ padding: '4px 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cleanedLib}>
                        {cleanedLib}
                        {(row.isSimulation || row.isSimulationImpacted) && (
                          <span style={{ marginLeft: 8, fontSize: '0.62rem', background: '#dcfce7', color: '#166534', border: '1px solid #86efac', padding: '1px 6px', borderRadius: 10, fontWeight: 800 }}>
                            SIMULATION 📝
                          </span>
                        )}
                      </td>
                      <NumCell val={row.soldeDebutDebit} activeDivisor={activeDivisor} rounding={rounding} />
                      <NumCell val={row.soldeDebutCredit} activeDivisor={activeDivisor} rounding={rounding} />
                      <NumCell val={row.mouvementDebit} activeDivisor={activeDivisor} rounding={rounding} />
                      <NumCell val={row.mouvementCredit} activeDivisor={activeDivisor} rounding={rounding} />
                      <NumCell val={row.soldeFinDebit} activeDivisor={activeDivisor} rounding={rounding} isBold={isDebitFin} color={isDebitFin ? 'var(--primary-dk)' : null} />
                      <NumCell val={row.soldeFinCredit} activeDivisor={activeDivisor} rounding={rounding} isBold={isCreditFin} color={isCreditFin ? 'var(--primary-dk)' : null} />
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {isSummary ? (
                <tr>
                  <td colSpan="2" style={{ fontWeight: 800, padding: '6px 8px', fontSize: '0.74rem' }}>TOTAUX SÉLECTIONNÉS</td>
                  <NumCell val={totals.soldeFinDebit} activeDivisor={activeDivisor} rounding={rounding} isBold color="var(--primary-dk)" style={{ padding: '6px 8px' }} />
                  <NumCell val={totals.soldeFinCredit} activeDivisor={activeDivisor} rounding={rounding} isBold color="var(--primary-dk)" style={{ padding: '6px 8px' }} />
                </tr>
              ) : (
                <tr>
                  <td colSpan="2" style={{ fontWeight: 800, padding: '6px 8px', fontSize: '0.7rem', letterSpacing: '0.02em' }}>TOTAUX SÉLECTIONNÉS</td>
                  <NumCell val={totals.soldeDebutDebit} activeDivisor={activeDivisor} rounding={rounding} isBold />
                  <NumCell val={totals.soldeDebutCredit} activeDivisor={activeDivisor} rounding={rounding} isBold />
                  <NumCell val={totals.mouvementDebit} activeDivisor={activeDivisor} rounding={rounding} isBold />
                  <NumCell val={totals.mouvementCredit} activeDivisor={activeDivisor} rounding={rounding} isBold />
                  <NumCell val={totals.soldeFinDebit} activeDivisor={activeDivisor} rounding={rounding} isBold color="var(--primary-dk)" />
                  <NumCell val={totals.soldeFinCredit} activeDivisor={activeDivisor} rounding={rounding} isBold color="var(--primary-dk)" />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
