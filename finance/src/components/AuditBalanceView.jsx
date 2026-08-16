import { useState } from 'react';
import { auditBalanceAccounts, auditCrossAccountMovements } from '../utils/financeCalculations';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * AUDIT BALANCE VIEW — SCF ALGÉRIE
 * Onglets : Natures (audit par nature de compte) + Flux Croisés (règles SCF)
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function AuditBalanceView({ rows, formatCurrency }) {
  const [activeTab, setActiveTab]       = useState('natures');
  const [natureFilter, setNatureFilter] = useState('all');
  const [cycleFilter, setCycleFilter]   = useState('all');
  const [searchQuery, setSearchQuery]   = useState('');
  const [pageSize, setPageSize]         = useState(50);
  const [currentPage, setCurrentPage]   = useState(1);
  const [selectedRuleForDetail, setSelectedRuleForDetail] = useState(null);
  const [hideZeroAccounts, setHideZeroAccounts] = useState(true);

  const cleanLibelle = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/[\uFFFD\u0080-\u009F\uFFFE\uFFFF]/g, "'")
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  };

  const safeNum = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const s = String(v).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const fmt = (v) => {
    const num = safeNum(v);
    return formatCurrency ? formatCurrency(num) : num.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DA';
  };

  if (!rows || rows.length === 0) {
    return (
      <div className="card fade-in" style={{ maxWidth: 450, margin: '60px auto', textAlign: 'center', padding: '48px 32px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }}>fact_check</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>Audit non disponible</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Veuillez d'abord importer une balance comptable pour exécuter l'audit SCF.</p>
      </div>
    );
  }

  const audit      = auditBalanceAccounts(rows);
  const crossAudit = auditCrossAccountMovements(rows);

  // ── Filtrage onglet Natures ──────────────────────────────────────────────
  const filteredAccounts = audit.comptesAudit.filter(c => {
    if (hideZeroAccounts && Math.abs(c.deb) < 0.001 && Math.abs(c.cred) < 0.001 && Math.abs(c.mouvDeb || 0) < 0.001 && Math.abs(c.mouvCred || 0) < 0.001) return false;
    if (natureFilter === 'anomalies' && c.verification.statut !== 'ANOMALIE')  return false;
    if (natureFilter === 'atypiques' && c.verification.statut !== 'ATYPIQUE')  return false;
    if (natureFilter === 'conformes' && c.verification.statut !== 'CONFORME')  return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return String(c.compte || '').toLowerCase().includes(q) || String(c.libelle || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Pagination
  const totalItems  = filteredAccounts.length;
  const totalPages  = pageSize === 'all' ? 1 : Math.ceil(totalItems / pageSize);
  const startIndex  = pageSize === 'all' ? 0 : (currentPage - 1) * pageSize;
  const endIndex    = pageSize === 'all' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedAccounts = pageSize === 'all' ? filteredAccounts : filteredAccounts.slice(startIndex, endIndex);

  // ── Filtrage onglet Flux Croisés ─────────────────────────────────────────
  const filteredRegles = crossAudit.regles.filter(r => {
    if (cycleFilter !== 'all' && r.cycle !== cycleFilter) return false;
    return true;
  });

  const cycles = [...new Set((crossAudit.regles || []).map(r => r.cycle))];

  // ── Score global ─────────────────────────────────────────────────────────
  const scoreColor = audit.scoreCoherence >= 90 ? '#10b981' : audit.scoreCoherence >= 70 ? '#f59e0b' : '#ef4444';
  const scoreBg    = audit.scoreCoherence >= 90 ? 'rgba(16, 185, 129, 0.15)' : audit.scoreCoherence >= 70 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';

  const statutLabel = (s) => {
    if (s === 'CONFORME') return '✓ CONFORME';
    if (s === 'ANOMALIE') return '✕ ANOMALIE';
    if (s === 'ATYPIQUE') return '△ ATYPIQUE';
    if (s === 'NON_MOUVEMENTE') return '⚪ NON MOUV.';
    return s ? s.replace(/_/g, ' ') : '—';
  };
  const statutColor  = (s) => s === 'CONFORME' ? '#34d399' : s === 'ANOMALIE' ? '#f87171' : s === 'NON_MOUVEMENTE' ? '#94a3b8' : '#fbbf24';
  const statutBg     = (s) => s === 'CONFORME' ? 'rgba(16, 185, 129, 0.2)' : s === 'ANOMALIE' ? 'rgba(239, 68, 68, 0.2)' : s === 'NON_MOUVEMENTE' ? 'rgba(148, 163, 184, 0.15)' : 'rgba(245, 158, 11, 0.2)';
  const statutBorder = (s) => s === 'CONFORME' ? '#059669' : s === 'ANOMALIE' ? '#dc2626' : s === 'NON_MOUVEMENTE' ? '#475569' : '#d97706';

  return (
    <div className="fade-in" style={{ padding: '24px', maxWidth: 1400, margin: '0 auto' }}>

      {/* ── PAGE HEADER ── */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 900, margin: 0, color: 'var(--text)' }}>
            Audit Balance SCF
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--text-muted)' }}>
            Contrôle de cohérence des comptes selon le Système Comptable Financier algérien (Loi 07-11)
          </p>
        </div>

        {/* Indicateurs globaux (sans score) */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div className="card" style={{ padding: '8px 16px', textAlign: 'center', background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Comptes analysés</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text)', lineHeight: 1.1 }}>{audit.total}</div>
          </div>
          <div className="card" style={{ padding: '8px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Conformes</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#34d399', lineHeight: 1.1 }}>{audit.conformes}</div>
          </div>
          <div className="card" style={{ padding: '8px 16px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Anomalies</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#f87171', lineHeight: 1.1 }}>{audit.anomalies}</div>
          </div>
          <div className="card" style={{ padding: '8px 16px', textAlign: 'center', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.25)' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Atypiques</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#fbbf24', lineHeight: 1.1 }}>{audit.atypiques}</div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {[
          { id: 'natures',  label: 'Natures de Comptes (SCF)',    icon: 'manage_accounts' },
          { id: 'flux',     label: 'Flux Croisés & Contrôles',    icon: 'compare_arrows'  },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: 800,
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.15s ease'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════
          ONGLET 1 : NATURES DE COMPTES
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'natures' && (
        <div>
          {/* Filter bar */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'all',       label: `Tous (${audit.total})` },
                { id: 'conformes', label: `✅ Conformes (${audit.conformes})` },
                { id: 'atypiques', label: `🟡 Atypiques (${audit.atypiques})` },
                { id: 'anomalies', label: `🔴 Anomalies (${audit.anomalies})` },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => { setNatureFilter(f.id); setCurrentPage(1); }}
                  style={{
                    padding: '5px 12px', borderRadius: 8, border: '1px solid',
                    fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer',
                    background: natureFilter === f.id ? (f.id === 'anomalies' ? '#fee2e2' : f.id === 'atypiques' ? '#fef3c7' : f.id === 'conformes' ? '#dcfce7' : 'var(--primary)') : 'var(--surface-alt)',
                    borderColor: natureFilter === f.id ? (f.id === 'anomalies' ? '#fca5a5' : f.id === 'atypiques' ? '#fde68a' : f.id === 'conformes' ? '#86efac' : 'var(--primary)') : 'var(--border)',
                    color: natureFilter === f.id ? (f.id === 'anomalies' ? '#b91c1c' : f.id === 'atypiques' ? '#92400e' : f.id === 'conformes' ? '#15803d' : '#ffffff') : 'var(--text-muted)'
                  }}
                >{f.label}</button>
              ))}

              {/* Toggle 0 DA */}
              <button
                onClick={() => { setHideZeroAccounts(!hideZeroAccounts); setCurrentPage(1); }}
                style={{
                  padding: '5px 12px', borderRadius: 8, border: '1px solid', fontSize: '0.74rem', fontWeight: 800,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4,
                  background: hideZeroAccounts ? '#eff6ff' : 'var(--surface-alt)',
                  borderColor: hideZeroAccounts ? '#bfdbfe' : 'var(--border)',
                  color: hideZeroAccounts ? '#1d4ed8' : 'var(--text-sub)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                  {hideZeroAccounts ? 'check_box' : 'check_box_outline_blank'}
                </span>
                Masquer 0 DA
              </button>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', minWidth: 220, marginLeft: 'auto' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-sub)' }}>search</span>
              <input
                type="text"
                placeholder="Chercher compte..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                style={{ width: '100%', padding: '6px 10px 6px 34px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-alt)', fontSize: '0.8rem', outline: 'none', color: 'var(--text)' }}
              />
            </div>
          </div>

          {/* Table Natures */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table compact-table grid-lines" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.70rem' }}>
              <thead style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                <tr>
                  <th style={{ width: '7%', padding: '6px 6px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>COMPTE</th>
                  <th style={{ width: '21%', padding: '6px 6px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>INTITULÉ DU COMPTE</th>
                  <th style={{ width: '15%', padding: '6px 6px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>NATURE SCF</th>
                  <th style={{ width: '11%', padding: '6px 2px', textAlign: 'center', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>STATUT</th>
                  <th className="right" style={{ width: '11%', padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.64rem', whiteSpace: 'nowrap', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>SOLDE DÉBIT</th>
                  <th className="right" style={{ width: '11%', padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.64rem', whiteSpace: 'nowrap', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>SOLDE CRÉDIT</th>
                  <th style={{ width: '24%', padding: '6px 8px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em' }}>DIAGNOSTIC SCF</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Aucun compte trouvé pour ce filtre.
                    </td>
                  </tr>
                ) : paginatedAccounts.map((c, idx) => (
                  <tr key={idx} style={{ verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
                    <td className="mono" style={{ fontWeight: 800, color: 'var(--primary)', padding: '5px 6px', fontSize: '0.70rem', borderRight: '1px solid var(--border)' }}>{c.compte}</td>
                    <td style={{ padding: '5px 6px', fontSize: '0.69rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'normal', lineHeight: 1.25, wordBreak: 'break-word', borderRight: '1px solid var(--border)' }}>
                      {cleanLibelle(c.libelle)}
                    </td>
                    <td style={{ fontSize: '0.67rem', color: 'var(--text-muted)', padding: '5px 6px', whiteSpace: 'normal', lineHeight: 1.25, borderRight: '1px solid var(--border)' }}>
                      {cleanLibelle(c.verification.nature) || '—'}
                    </td>
                    <td style={{ textAlign: 'center', padding: '5px 2px', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                      <span style={{
                        padding: '2px 5px',
                        borderRadius: 4,
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        letterSpacing: '0.02em',
                        background: statutBg(c.verification.statut),
                        color: statutColor(c.verification.statut),
                        border: `1px solid ${statutBorder(c.verification.statut)}`,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        maxWidth: '96%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxSizing: 'border-box'
                      }}>
                        <span>{c.verification.statut === 'CONFORME' ? '✓' : c.verification.statut === 'ANOMALIE' ? '✕' : '△'}</span>
                        <span>{c.verification.statut}</span>
                      </span>
                    </td>
                    <td className="right mono" style={{ padding: '5px 8px', color: c.deb > 0 ? '#60a5fa' : 'var(--text-muted)', fontWeight: c.deb > 0 ? 800 : 400, fontSize: '0.72rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>
                      {c.deb > 0 ? Math.round(c.deb).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="right mono" style={{ padding: '5px 8px', color: c.cred > 0 ? '#34d399' : 'var(--text-muted)', fontWeight: c.cred > 0 ? 800 : 400, fontSize: '0.72rem', whiteSpace: 'nowrap', borderRight: '1px solid var(--border)' }}>
                      {c.cred > 0 ? Math.round(c.cred).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td style={{
                      fontSize: '0.68rem',
                      color: statutColor(c.verification.statut),
                      padding: '5px 8px',
                      whiteSpace: 'normal',
                      lineHeight: 1.25,
                      wordBreak: 'break-word',
                      fontWeight: 600
                    }}>
                      {c.verification.diagnostic || c.verification.message || 'Conforme'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && pageSize !== 'all' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {startIndex + 1}–{endIndex} sur {totalItems} comptes
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }}>←</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                  return page <= totalPages ? (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.75rem', fontWeight: currentPage === page ? 900 : 600, background: currentPage === page ? 'var(--primary)' : 'var(--surface-alt)', color: currentPage === page ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
                      {page}
                    </button>
                  ) : null;
                })}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="btn btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }}>→</button>
              </div>
              <select value={pageSize} onChange={e => { setPageSize(e.target.value === 'all' ? 'all' : Number(e.target.value)); setCurrentPage(1); }}
                style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid var(--border)', fontSize: '0.75rem', background: 'var(--surface)', color: 'var(--text)' }}>
                {[25, 50, 100, 'all'].map(n => <option key={n} value={n}>{n === 'all' ? 'Tout afficher' : `${n} / page`}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          ONGLET 2 : FLUX CROISÉS
      ═══════════════════════════════════════════════════════ */}
      {activeTab === 'flux' && (
        <div>
          {/* Résumé flux — 4 cartes d'indicateurs sans score */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Règles vérifiées',  val: crossAudit.regles.length,     bg: 'rgba(59, 130, 246, 0.12)', bdr: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd' },
              { label: 'Conformes',          val: crossAudit.totalConformesFlux, bg: 'rgba(16, 185, 129, 0.12)', bdr: 'rgba(16, 185, 129, 0.25)', color: '#34d399' },
              { label: 'Atypiques',          val: crossAudit.totalAtypiquesFlux, bg: 'rgba(245, 158, 11, 0.12)', bdr: 'rgba(245, 158, 11, 0.25)', color: '#fbbf24' },
              { label: 'Anomalies Flux',     val: crossAudit.totalAnomaliesFlux, bg: 'rgba(239, 68, 68, 0.12)', bdr: 'rgba(239, 68, 68, 0.25)', color: '#f87171' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '8px 14px', background: s.bg, border: `1px solid ${s.bdr}`, borderRadius: 10 }}>
                <div style={{ fontSize: '0.62rem', fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: s.color, lineHeight: 1.1 }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Cycle filter */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            <button onClick={() => setCycleFilter('all')}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', background: cycleFilter === 'all' ? 'var(--primary)' : 'var(--surface-alt)', borderColor: cycleFilter === 'all' ? 'var(--primary)' : 'var(--border)', color: cycleFilter === 'all' ? '#fff' : 'var(--text-muted)' }}>
              Tous les cycles
            </button>
            {cycles.map(c => (
              <button key={c} onClick={() => setCycleFilter(c)}
                style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid', fontSize: '0.74rem', fontWeight: 800, cursor: 'pointer', background: cycleFilter === c ? '#1e293b' : 'var(--surface-alt)', borderColor: cycleFilter === c ? '#1e293b' : 'var(--border)', color: cycleFilter === c ? '#fff' : 'var(--text-muted)' }}>
                {c}
              </button>
            ))}
          </div>

          {/* Règles table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table compact-table grid-lines" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.70rem' }}>
              <thead style={{ background: 'var(--surface-alt)', borderBottom: '2px solid var(--border)' }}>
                <tr>
                  <th style={{ width: '11%', padding: '6px 6px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>CYCLE</th>
                  <th style={{ width: '22%', padding: '6px 6px', textAlign: 'left', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>RÈGLE DE CONTRÔLE</th>
                  <th style={{ width: '11%', padding: '6px 2px', textAlign: 'center', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>STATUT</th>
                  <th className="right" style={{ width: '16%', padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.64rem', whiteSpace: 'nowrap', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>SOURCE</th>
                  <th className="right" style={{ width: '16%', padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.64rem', whiteSpace: 'nowrap', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>CIBLE</th>
                  <th className="right" style={{ width: '18%', padding: '6px 8px', textAlign: 'right', fontWeight: 800, fontSize: '0.64rem', whiteSpace: 'nowrap', letterSpacing: '0.03em', borderRight: '1px solid var(--border)' }}>ÉCART</th>
                  <th style={{ width: '6%', padding: '6px 4px', textAlign: 'center', fontWeight: 800, fontSize: '0.64rem', letterSpacing: '0.03em' }}>DÉTAIL</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegles.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                      Aucune règle pour ce cycle.
                    </td>
                  </tr>
                ) : filteredRegles.map((r, idx) => (
                  <tr key={idx} style={{ verticalAlign: 'top', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 6px', borderRight: '1px solid var(--border)' }}>
                      <span style={{
                        fontSize: '0.60rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                        background: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)',
                        display: 'inline-block', lineHeight: 1.2, whiteSpace: 'normal', wordBreak: 'break-word'
                      }}>
                        {r.cycle}
                      </span>
                    </td>
                    <td style={{ padding: '6px 6px', fontWeight: 700, color: 'var(--text)', borderRight: '1px solid var(--border)', fontSize: '0.68rem', whiteSpace: 'normal', lineHeight: 1.25, wordBreak: 'break-word' }}>
                      {r.titre}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 2px', borderRight: '1px solid var(--border)', overflow: 'hidden' }}>
                      <span style={{
                        padding: '2px 4px',
                        borderRadius: 4,
                        fontSize: '0.58rem',
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 2,
                        maxWidth: '96%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        boxSizing: 'border-box',
                        background: statutBg(r.statut),
                        color: statutColor(r.statut),
                        border: `1px solid ${statutBorder(r.statut)}`
                      }}>
                        {statutLabel(r.statut)}
                      </span>
                    </td>
                    <td className="right mono" style={{ padding: '6px 8px', color: '#60a5fa', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.72rem', borderRight: '1px solid var(--border)' }}>
                      {Math.round(r.sourceVal || 0).toLocaleString('fr-FR')}
                    </td>
                    <td className="right mono" style={{ padding: '6px 8px', color: '#34d399', fontWeight: 800, whiteSpace: 'nowrap', fontSize: '0.72rem', borderRight: '1px solid var(--border)' }}>
                      {Math.round(r.cibleVal || 0).toLocaleString('fr-FR')}
                    </td>
                    <td className="right mono" style={{ padding: '6px 8px', color: r.ecart < 1 ? '#34d399' : '#f87171', fontWeight: 900, whiteSpace: 'nowrap', fontSize: '0.74rem', borderRight: '1px solid var(--border)' }}>
                      {Math.round(r.ecart || 0).toLocaleString('fr-FR')}
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>
                      <button
                        onClick={() => setSelectedRuleForDetail(r)}
                        style={{
                          padding: '2px 8px', borderRadius: 5, border: '1px solid #3b82f6',
                          background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa',
                          fontSize: '0.65rem', fontWeight: 900, cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.color = '#ffffff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; e.currentTarget.style.color = '#60a5fa'; }}
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL ── */}
      {selectedRuleForDetail && (
        <CrossAuditDetailModal
          rule={selectedRuleForDetail}
          onClose={() => setSelectedRuleForDetail(null)}
          fmt={fmt}
        />
      )}
    </div>
  );
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MODAL DE DÉTAIL & POINTAGE — DESIGN & COULEURS HAUTE LISIBILITÉ
 * ═══════════════════════════════════════════════════════════════════════════
 */
function CrossAuditDetailModal({ rule, onClose, fmt }) {
  const [layoutMode, setLayoutMode] = useState('sideBySide');
  const [filterText, setFilterText] = useState('');
  const [showZeroInModal, setShowZeroInModal] = useState(true);
  const [checkedSrc, setCheckedSrc] = useState(new Set());
  const [checkedTgt, setCheckedTgt] = useState(new Set());
  const [jointures, setJointures]   = useState([]);
  const [nextJointureId, setNextJointureId] = useState(1);

  if (!rule) return null;

  // Montant pertinent selon le focus de la règle
  const getFocusAmount = (a, focus) => {
    if (!a) return 0;
    const md = Math.abs(a.mouvDeb || 0);
    const mc = Math.abs(a.mouvCred || 0);
    const fd = Math.abs(a.finDeb || 0);
    const fc = Math.abs(a.finCred || 0);
    const sf = a.soldeFin || 0;

    if (focus === 'DEBIT') {
      if (md > 0) return md;
      if (fd > 0) return fd;
      if (sf > 0) return sf;
      return Math.max(md, mc, fd, Math.abs(sf));
    }
    if (focus === 'CREDIT') {
      if (mc > 0) return mc;
      if (fc > 0) return fc;
      if (sf < 0) return -sf;
      return Math.max(md, mc, fc, Math.abs(sf));
    }
    if (focus === 'FIN') return Math.abs(sf);
    if (focus === 'VAR') return Math.abs(sf - (a.soldeInit || 0));
    return Math.max(md, mc, fd, fc, Math.abs(sf));
  };

  // Ensemble des comptes déjà liés dans une jointure enregistrée
  const joinedSrcComptes = new Set(jointures.flatMap(j => j.sources.map(s => String(s.compte))));
  const joinedTgtComptes = new Set(jointures.flatMap(j => j.cibles.map(c => String(c.compte))));

  // Filtrage : comptes avec mouvement + non encore liés dans une jointure
  const filterAccounts = (accounts, focus, isSource) =>
    (accounts || []).filter(a => {
      const cStr = String(a.compte);
      // Ne plus afficher dans le bloc du haut si déjà sélectionné/lié dans une jointure
      if (isSource && joinedSrcComptes.has(cStr)) return false;
      if (!isSource && joinedTgtComptes.has(cStr)) return false;

      if (!showZeroInModal && getFocusAmount(a, focus) < 0.001) return false;
      if (filterText) {
        const q = filterText.toLowerCase();
        return cStr.toLowerCase().includes(q) ||
               (a.libelle && a.libelle.toLowerCase().includes(q));
      }
      return true;
    });

  const srcAccounts = filterAccounts(rule.sourceAccounts, rule.sourceFocus, true);
  const tgtAccounts = filterAccounts(rule.cibleAccounts,  rule.cibleFocus,  false);

  const sumSrc = srcAccounts.reduce((s, a) => s + getFocusAmount(a, rule.sourceFocus), 0);
  const sumTgt = tgtAccounts.reduce((s, a) => s + getFocusAmount(a, rule.cibleFocus),  0);

  // Totaux de la sélection courante
  const selSrcAccounts = srcAccounts.filter(a => checkedSrc.has(String(a.compte)));
  const selTgtAccounts = tgtAccounts.filter(a => checkedTgt.has(String(a.compte)));
  const selSrcTotal    = selSrcAccounts.reduce((s, a) => s + getFocusAmount(a, rule.sourceFocus), 0);
  const selTgtTotal    = selTgtAccounts.reduce((s, a) => s + getFocusAmount(a, rule.cibleFocus),  0);
  const selEcart       = Math.abs(selSrcTotal - selTgtTotal);
  const canCreateJointure = checkedSrc.size > 0 && checkedTgt.size > 0;

  const toggleSrc = (compte) => {
    setCheckedSrc(prev => {
      const next = new Set(prev);
      if (next.has(compte)) next.delete(compte);
      else next.add(compte);
      return next;
    });
  };

  const toggleTgt = (compte) => {
    setCheckedTgt(prev => {
      const next = new Set(prev);
      if (next.has(compte)) next.delete(compte);
      else next.add(compte);
      return next;
    });
  };

  const clearSelection = () => {
    setCheckedSrc(new Set());
    setCheckedTgt(new Set());
  };

  // Créer et enregistrer la jointure incrémentée
  const createJointure = () => {
    if (!canCreateJointure) return;

    const newJointure = {
      id: nextJointureId,
      sources: selSrcAccounts.map(a => ({ compte: a.compte, libelle: a.libelle, montant: getFocusAmount(a, rule.sourceFocus) })),
      cibles: selTgtAccounts.map(a => ({ compte: a.compte, libelle: a.libelle, montant: getFocusAmount(a, rule.cibleFocus) })),
      totalSource: selSrcTotal,
      totalCible: selTgtTotal,
      ecart: selEcart,
      isEquilibre: selEcart < 1
    };

    setJointures(prev => [...prev, newJointure]);
    setNextJointureId(prev => prev + 1);
    clearSelection();
  };

  // Supprimer une jointure (restaure automatiquement les comptes dans les blocs du haut)
  const deleteJointure = (id) => {
    setJointures(prev => prev.filter(j => j.id !== id));
  };

  // Rapprochement automatique des montants strictement identiques 1 pour 1
  const autoPairExactMatches = () => {
    const matchedJointures = [];
    const usedSrc = new Set(joinedSrcComptes);
    const usedTgt = new Set(joinedTgtComptes);
    let currentId = nextJointureId;

    srcAccounts.forEach(src => {
      if (usedSrc.has(String(src.compte))) return;
      const srcAmt = getFocusAmount(src, rule.sourceFocus);
      if (srcAmt < 0.5) return;

      const tgtMatch = tgtAccounts.find(tgt => 
        !usedTgt.has(String(tgt.compte)) && 
        Math.abs(getFocusAmount(tgt, rule.cibleFocus) - srcAmt) < 1
      );

      if (tgtMatch) {
        usedSrc.add(String(src.compte));
        usedTgt.add(String(tgtMatch.compte));
        matchedJointures.push({
          id: currentId++,
          sources: [{ compte: src.compte, libelle: src.libelle, montant: srcAmt }],
          cibles: [{ compte: tgtMatch.compte, libelle: tgtMatch.libelle, montant: getFocusAmount(tgtMatch, rule.cibleFocus) }],
          totalSource: srcAmt,
          totalCible: getFocusAmount(tgtMatch, rule.cibleFocus),
          ecart: 0,
          isEquilibre: true
        });
      }
    });

    if (matchedJointures.length > 0) {
      setJointures(prev => [...prev, ...matchedJointures]);
      setNextJointureId(currentId);
      clearSelection();
    }
  };

  const isAno    = rule.statut === 'ANOMALIE';
  const isOk     = rule.statut === 'CONFORME';
  const hasCible = tgtAccounts.length > 0 || (rule.cibleAccounts && rule.cibleAccounts.length > 0);

  const fmtN = (n) => Math.round(n).toLocaleString('fr-FR');

  const srcColLabel = rule.sourceFocus === 'DEBIT'  ? 'MOUV. DÉBIT'  :
                      rule.sourceFocus === 'CREDIT' ? 'MOUV. CRÉDIT' : 'MONTANT';
  const tgtColLabel = rule.cibleFocus  === 'DEBIT'  ? 'MOUV. DÉBIT'  :
                      rule.cibleFocus  === 'CREDIT' ? 'MOUV. CRÉDIT' : 'MONTANT';

  // Totaux cumulés des jointures
  const totalJointuresSrc   = jointures.reduce((s, j) => s + j.totalSource, 0);
  const totalJointuresTgt   = jointures.reduce((s, j) => s + j.totalCible, 0);
  const totalJointuresEcart = jointures.reduce((s, j) => s + j.ecart, 0);
  const resteSrcNonPointe   = Math.max(0, sumSrc - totalJointuresSrc);
  const resteTgtNonPointe   = Math.max(0, sumTgt - totalJointuresTgt);

  // ── Sous-composant table ─────────────────────────────────────────────────
  const AccountTable = ({ accounts, focus, sumTotal, isSource, checked, onToggle, label, totalVal, colLabel }) => {
    const allChecked = accounts.length > 0 && accounts.every(a => checked.has(String(a.compte)));
    const someChecked = !allChecked && accounts.some(a => checked.has(String(a.compte)));

    const toggleAll = () => {
      if (allChecked) {
        if (isSource) setCheckedSrc(new Set());
        else setCheckedTgt(new Set());
      } else {
        const next = new Set(accounts.map(a => String(a.compte)));
        if (isSource) setCheckedSrc(next);
        else setCheckedTgt(next);
      }
    };

    const headerGradient = isSource
      ? 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)'
      : 'linear-gradient(135deg, #064e3b 0%, #059669 100%)';
    const tagColor = isSource ? '#bfdbfe' : '#a7f3d0';
    const codeColor = isSource ? '#60a5fa' : '#34d399';
    const accentBorder = isSource ? 'rgba(59, 130, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)';
    const thBg = isSource ? '#0f2744' : '#0a2e22';

    return (
      <div style={{
        border: `1px solid ${accentBorder}`,
        borderRadius: 10,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        flex: '1 1 0%',
        minWidth: 0,
        minHeight: 0,
        height: '100%'
      }}>
        {/* Card header — compact */}
        <div style={{
          padding: '6px 14px',
          background: headerGradient,
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${accentBorder}`,
          flexShrink: 0
        }}>
          <div>
            <div style={{ fontSize: '0.6rem', fontWeight: 900, color: tagColor, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 1 }}>
              {isSource ? '↗ FLUX SOURCE' : '↙ CONTREPARTIE'}
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#ffffff' }}>{label}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.58rem', color: tagColor, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL CONTRÔLÉ</div>
            <div className="mono" style={{ fontSize: '1.02rem', fontWeight: 900, color: '#ffffff' }}>{fmt(totalVal)}</div>
          </div>
        </div>

        {/* Table scrollable — fills full height */}
        <div style={{
          flex: '1 1 0%',
          overflowY: 'auto',
          overflowX: 'hidden',
          minHeight: 0
        }}>
          <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
            <thead>
              <tr style={{ background: thBg, color: '#94a3b8', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ width: '38px', padding: '6px 4px', borderBottom: `2px solid ${accentBorder}`, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={el => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    style={{ cursor: 'pointer', accentColor: isSource ? '#3b82f6' : '#10b981', width: 14, height: 14 }}
                    title="Tout cocher / décocher"
                  />
                </th>
                <th style={{ width: '17%', padding: '6px 8px', textAlign: 'left', fontWeight: 800, fontSize: '0.67rem', color: tagColor, borderBottom: `2px solid ${accentBorder}`, letterSpacing: '0.04em' }}>COMPTE</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 800, fontSize: '0.67rem', color: '#cbd5e1', borderBottom: `2px solid ${accentBorder}`, letterSpacing: '0.04em' }}>INTITULÉ DU COMPTE</th>
                <th style={{ width: '27%', padding: '6px 10px', textAlign: 'right', fontWeight: 900, fontSize: '0.67rem', color: tagColor, borderBottom: `2px solid ${accentBorder}`, whiteSpace: 'nowrap', letterSpacing: '0.04em' }}>{colLabel}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '30px 16px', color: '#94a3b8', fontSize: '0.78rem' }}>
                    {jointures.length > 0
                      ? '✓ Tous les comptes de ce côté sont rapprochés dans le tableau des jointures ci-dessous'
                      : '⚪ Aucun compte avec mouvement > 0 DA'}
                  </td>
                </tr>
              ) : accounts.map((a, idx) => {
                const amount     = getFocusAmount(a, focus);
                const isChecked  = checked.has(String(a.compte));

                let rowBg = idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)';
                let borderLeft = '3px solid transparent';

                if (isChecked) {
                  rowBg = isSource ? 'rgba(37, 99, 235, 0.22)' : 'rgba(16, 185, 129, 0.22)';
                  borderLeft = isSource ? '3px solid #3b82f6' : '3px solid #10b981';
                }

                return (
                  <tr key={idx}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: rowBg,
                      borderLeft: borderLeft,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease'
                    }}
                    onClick={() => onToggle(String(a.compte))}
                    onMouseEnter={e => {
                      if (!isChecked) {
                        e.currentTarget.style.background = isSource ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isChecked) {
                        e.currentTarget.style.background = rowBg;
                      }
                    }}
                  >
                    <td style={{ padding: '5px 4px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle(String(a.compte))}
                        style={{ cursor: 'pointer', accentColor: isSource ? '#3b82f6' : '#10b981', width: 14, height: 14 }}
                      />
                    </td>
                    <td className="mono" style={{ padding: '5px 8px', fontWeight: 800, color: codeColor, fontSize: '0.74rem' }}>
                      {a.compte}
                    </td>
                    <td style={{
                      padding: '5px 8px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--text)',
                      fontWeight: 600,
                      maxWidth: 0,
                      fontSize: '0.73rem'
                    }} title={a.libelle}>
                      {a.libelle}
                    </td>
                    <td className="mono" style={{
                      padding: '5px 10px',
                      textAlign: 'right',
                      fontWeight: 800,
                      color: 'var(--text)',
                      whiteSpace: 'nowrap',
                      fontSize: '0.8rem'
                    }}>
                      {fmtN(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {accounts.length > 0 && (
              <tfoot>
                <tr style={{ background: thBg, borderTop: `2px solid ${accentBorder}` }}>
                  <td colSpan="3" style={{ padding: '6px 8px', fontWeight: 900, fontSize: '0.73rem', color: '#ffffff' }}>
                    TOTAL — {accounts.length} compte{accounts.length > 1 ? 's' : ''}
                    {checked.size > 0 && (
                      <span style={{ marginLeft: 8, fontSize: '0.66rem', fontWeight: 800, padding: '1px 6px', borderRadius: 4, background: isSource ? '#2563eb' : '#059669', color: '#ffffff' }}>
                        {checked.size} sélectionné{checked.size > 1 ? 's' : ''}
                      </span>
                    )}
                  </td>
                  <td className="mono" style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 900, color: '#ffffff', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                    {fmtN(sumTotal)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    );
  };

  // ── Rendu modal ──────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.88)',
      backdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 12
    }}>
      <div style={{
        width: '100%', maxWidth: 1400, maxHeight: '98vh', height: '94vh',
        background: 'var(--surface)',
        borderRadius: 14,
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.65)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)'
      }}>

        {/* ══ HEADER — compact ══ */}
        <div style={{
          padding: '10px 20px',
          background: 'linear-gradient(135deg, #090d16 0%, #1e293b 100%)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 12, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.64rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {rule.cycle}
              </span>
              <span style={{
                fontSize: '0.64rem', fontWeight: 800, padding: '2px 6px', borderRadius: 4,
                background: isOk ? 'rgba(16, 185, 129, 0.25)' : isAno ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                color: isOk ? '#6ee7b7' : isAno ? '#fca5a5' : '#fde68a',
                border: `1px solid ${isOk ? '#059669' : isAno ? '#dc2626' : '#d97706'}`
              }}>
                {isOk ? '✓ CONFORME' : isAno ? '✕ ANOMALIE' : '△ ATYPIQUE'}
              </span>
            </div>
            <h3 style={{ margin: 0, fontSize: '0.96rem', fontWeight: 900, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rule.titre}
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Source</div>
                <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 900, color: '#60a5fa' }}>{fmt(rule.sourceVal)}</div>
              </div>
              {hasCible && (<>
                <span style={{ color: '#64748b', fontSize: '1.0rem', fontWeight: 900 }}>⇔</span>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.58rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>Cible</div>
                  <div className="mono" style={{ fontSize: '0.9rem', fontWeight: 900, color: '#34d399' }}>{fmt(rule.cibleVal)}</div>
                </div>
              </>)}
              <div style={{
                padding: '4px 10px', borderRadius: 6,
                background: rule.ecart < 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: rule.ecart < 1 ? '#34d399' : '#f87171',
                border: `1px solid ${rule.ecart < 1 ? '#059669' : '#ef4444'}`,
                display: 'flex', alignItems: 'center', gap: 5
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{rule.ecart < 1 ? 'check_circle' : 'error'}</span>
                <span style={{ fontSize: '0.74rem', fontWeight: 900 }}>Écart : {fmtN(rule.ecart)} DA</span>
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                border: 'none', background: 'rgba(255,255,255,0.1)', cursor: 'pointer',
                color: '#fff', padding: 6, borderRadius: 6, display: 'flex', transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.4)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>
        </div>

        {/* ══ TOOLBAR — compact ══ */}
        <div style={{
          padding: '6px 20px',
          background: 'var(--surface-alt)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          gap: 10, flexWrap: 'wrap', flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-sub)' }}>search</span>
              <input
                type="text"
                placeholder="Filtrer compte ou libellé..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{
                  padding: '4px 10px 4px 28px', borderRadius: 6, border: '1px solid var(--border)',
                  background: 'var(--surface)', fontSize: '0.73rem', outline: 'none', color: 'var(--text)', width: 200
                }}
              />
            </div>

            {hasCible && (
              <button
                onClick={autoPairExactMatches}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid #3b82f6', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa',
                  fontSize: '0.72rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
                title="Détecter et lier automatiquement les comptes de montants identiques"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>auto_fix_high</span>
                Jointure auto (montants égaux)
              </button>
            )}

            <button
              onClick={() => setShowZeroInModal(!showZeroInModal)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${showZeroInModal ? 'var(--primary)' : 'var(--border)'}`,
                background: showZeroInModal ? 'var(--primary)' : 'var(--surface)',
                color: showZeroInModal ? '#ffffff' : 'var(--text-muted)',
                fontSize: '0.71rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
              }}
              title="Afficher ou masquer les comptes non mouvementés (0 DA)"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{showZeroInModal ? 'visibility' : 'visibility_off'}</span>
              {showZeroInModal ? 'Tous les comptes (0 DA inclus)' : 'Comptes mvtés (> 0 DA)'}
            </button>

            {/* ── Indicateur debug comptes bruts ── */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <span style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 700 }}>Collectés :</span>
              <span style={{
                padding: '2px 7px', borderRadius: 4,
                background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa',
                fontSize: '0.68rem', fontWeight: 900, border: '1px solid rgba(59, 130, 246, 0.3)'
              }}>
                ↗ {rule.sourceAccounts?.length ?? 0} cpt(s) source
              </span>
              {hasCible && (
                <span style={{
                  padding: '2px 7px', borderRadius: 4,
                  background: 'rgba(16, 185, 129, 0.15)', color: '#34d399',
                  fontSize: '0.68rem', fontWeight: 900, border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  ↙ {rule.cibleAccounts?.length ?? 0} cpt(s) cible
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {canCreateJointure && (
              <button
                onClick={createJointure}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: 'none', background: '#2563eb', color: '#ffffff',
                  fontSize: '0.74rem', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: '0 2px 8px rgba(37,99,235,0.4)'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_link</span>
                Créer Jointure #{nextJointureId} [{checkedSrc.size} ⇔ {checkedTgt.size}] ({fmtN(selSrcTotal)} ⇔ {fmtN(selTgtTotal)} DA {selEcart < 1 ? '✓ Équilibré' : `(Écart: ${fmtN(selEcart)})`})
              </button>
            )}

            {(checkedSrc.size > 0 || checkedTgt.size > 0) && (
              <button
                onClick={clearSelection}
                style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid #f87171', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171',
                  fontSize: '0.71rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>cancel</span>
                Effacer ({checkedSrc.size + checkedTgt.size})
              </button>
            )}

            {hasCible && (
              <div style={{ display: 'flex', gap: 2, background: 'var(--surface)', padding: 2, borderRadius: 6, border: '1px solid var(--border)' }}>
                {[['sideBySide', 'view_column', 'Côte-à-côte'], ['stacked', 'table_rows', 'Superposé']].map(([mode, icon, lbl]) => (
                  <button key={mode} onClick={() => setLayoutMode(mode)} style={{
                    padding: '3px 8px', borderRadius: 4, border: 'none', fontSize: '0.7rem', fontWeight: 800,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    background: layoutMode === mode ? 'var(--primary)' : 'transparent',
                    color: layoutMode === mode ? '#ffffff' : 'var(--text-muted)'
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{icon}</span>{lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ══ TABLES SOURCE & CIBLE — AGRANDIES & MAXIMISÉES ══ */}
        <div style={{
          flex: '1 1 0%',
          minHeight: 280,
          overflow: 'hidden',
          padding: '8px 16px',
          display: hasCible && layoutMode === 'sideBySide' ? 'grid' : 'flex',
          gridTemplateColumns: hasCible && layoutMode === 'sideBySide' ? '1fr 1fr' : '1fr',
          flexDirection: 'column',
          gap: 12
        }}>
          <AccountTable
            accounts={srcAccounts} focus={rule.sourceFocus} sumTotal={sumSrc}
            colLabel={srcColLabel} label={rule.sourceLabel} totalVal={rule.sourceVal}
            isSource={true} checked={checkedSrc} onToggle={toggleSrc}
          />
          {hasCible && (
            <AccountTable
              accounts={tgtAccounts} focus={rule.cibleFocus} sumTotal={sumTgt}
              colLabel={tgtColLabel} label={rule.cibleLabel} totalVal={rule.cibleVal}
              isSource={false} checked={checkedTgt} onToggle={toggleTgt}
            />
          )}
        </div>

        {/* ══ TABLEAU DES JOINTURES INCRÉMENTÉES — COMPACT EN BAS ══ */}
        <div style={{
          borderTop: '2px solid var(--border)',
          background: '#090d16',
          padding: '8px 16px',
          flexShrink: 0,
          maxHeight: 175,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 17, color: '#38bdf8' }}>join_inner</span>
              <span style={{ fontSize: '0.74rem', fontWeight: 900, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tableau des Jointures ({jointures.length})
              </span>
            </div>

            {jointures.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(59, 130, 246, 0.2)', border: '1px solid #1e40af', color: '#93c5fd' }}>
                  Pointé Source : <strong className="mono" style={{ color: '#60a5fa' }}>{fmtN(totalJointuresSrc)} DA</strong>
                </span>
                <span style={{ fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4, background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #065f46', color: '#6ee7b7' }}>
                  Pointé Cible : <strong className="mono" style={{ color: '#34d399' }}>{fmtN(totalJointuresTgt)} DA</strong>
                </span>
                <span style={{
                  fontSize: '0.68rem', padding: '2px 6px', borderRadius: 4,
                  background: resteSrcNonPointe > 1 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                  border: `1px solid ${resteSrcNonPointe > 1 ? '#dc2626' : '#059669'}`,
                  color: resteSrcNonPointe > 1 ? '#fca5a5' : '#34d399'
                }}>
                  Reste Source : <strong className="mono">{fmtN(resteSrcNonPointe)} DA</strong>
                </span>
                <button
                  onClick={() => { setJointures([]); setNextJointureId(1); }}
                  style={{
                    background: 'transparent', border: '1px solid #475569', color: '#94a3b8',
                    borderRadius: 4, padding: '2px 6px', fontSize: '0.66rem', cursor: 'pointer', fontWeight: 800
                  }}
                >
                  Réinitialiser
                </button>
              </div>
            )}
          </div>

          {jointures.length === 0 ? (
            <div style={{
              padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 6,
              border: '1px dashed #334155', textAlign: 'center', color: '#94a3b8', fontSize: '0.72rem'
            }}>
              💡 Cochez 1 ou plusieurs comptes <strong>Source</strong> et <strong>Cible</strong>, puis cliquez sur <strong>« Créer Jointure #1 »</strong>.
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.72rem', tableLayout: 'fixed' }}>
                <thead>
                  <tr style={{ background: '#1e293b', color: '#94a3b8', textAlign: 'left' }}>
                    <th style={{ width: '60px', padding: '5px 6px', fontWeight: 800, fontSize: '0.66rem' }}>JOINTURE</th>
                    <th style={{ width: '27%', padding: '5px 6px', fontWeight: 800, fontSize: '0.66rem', color: '#93c5fd' }}>SOURCE COCHÉE</th>
                    <th style={{ width: '13%', padding: '5px 6px', textAlign: 'right', fontWeight: 800, fontSize: '0.66rem', color: '#60a5fa', whiteSpace: 'nowrap' }}>TOTAL SOURCE</th>
                    <th style={{ width: '27%', padding: '5px 6px', fontWeight: 800, fontSize: '0.66rem', color: '#6ee7b7' }}>CONTREPARTIE COCHÉE</th>
                    <th style={{ width: '13%', padding: '5px 6px', textAlign: 'right', fontWeight: 800, fontSize: '0.66rem', color: '#34d399', whiteSpace: 'nowrap' }}>TOTAL CIBLE</th>
                    <th style={{ width: '11%', padding: '5px 6px', textAlign: 'right', fontWeight: 800, fontSize: '0.66rem', color: '#fca5a5', whiteSpace: 'nowrap' }}>ÉCART</th>
                    <th style={{ width: '80px', padding: '5px 6px', textAlign: 'center', fontWeight: 800, fontSize: '0.66rem' }}>STATUT</th>
                    <th style={{ width: '36px', padding: '5px 4px', textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {jointures.map((j) => (
                    <tr key={j.id} style={{ borderBottom: '1px solid #1e293b', background: 'rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 900, padding: '2px 6px', borderRadius: 4,
                          background: '#1e3a8a', color: '#93c5fd', border: '1px solid #3b82f6', display: 'inline-block'
                        }}>
                          #{j.id}
                        </span>
                      </td>
                      {/* Source accounts — multi-lignes */}
                      <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {j.sources.map((s, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                              <strong className="mono" style={{ color: '#60a5fa', fontSize: '0.74rem', flexShrink: 0 }}>{s.compte}</strong>
                              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }} title={s.libelle}>
                                {s.libelle ? `(${s.libelle})` : ''}
                              </span>
                              {j.sources.length > 1 && (
                                <span className="mono" style={{ color: '#94a3b8', fontSize: '0.66rem', marginLeft: 'auto', flexShrink: 0 }}>
                                  {fmtN(s.montant)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 900, color: '#60a5fa', fontSize: '0.78rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {fmtN(j.totalSource)}
                      </td>
                      {/* Target accounts — multi-lignes */}
                      <td style={{ padding: '6px 6px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {j.cibles.map((c, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                              <strong className="mono" style={{ color: '#34d399', fontSize: '0.74rem', flexShrink: 0 }}>{c.compte}</strong>
                              <span style={{ color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.7rem' }} title={c.libelle}>
                                {c.libelle ? `(${c.libelle})` : ''}
                              </span>
                              {j.cibles.length > 1 && (
                                <span className="mono" style={{ color: '#94a3b8', fontSize: '0.66rem', marginLeft: 'auto', flexShrink: 0 }}>
                                  {fmtN(c.montant)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="mono" style={{ padding: '6px 6px', textAlign: 'right', fontWeight: 900, color: '#34d399', fontSize: '0.78rem', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {fmtN(j.totalCible)}
                      </td>
                      <td className="mono" style={{
                        padding: '6px 6px', textAlign: 'right', fontWeight: 900,
                        color: j.isEquilibre ? '#34d399' : '#f87171', fontSize: '0.78rem', verticalAlign: 'top', whiteSpace: 'nowrap'
                      }}>
                        {fmtN(j.ecart)}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'center', verticalAlign: 'top' }}>
                        <span style={{
                          fontSize: '0.62rem', fontWeight: 800, padding: '2px 5px', borderRadius: 4,
                          whiteSpace: 'nowrap', display: 'inline-block',
                          background: j.isEquilibre ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: j.isEquilibre ? '#34d399' : '#f87171',
                          border: `1px solid ${j.isEquilibre ? '#059669' : '#dc2626'}`
                        }}>
                          {j.isEquilibre ? '✓ OK' : '🔴 Diff'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                        <button
                          onClick={() => deleteJointure(j.id)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171', cursor: 'pointer', padding: '3px 5px', borderRadius: 4,
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                          title="Supprimer cette jointure"
                          onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; e.currentTarget.style.color = '#ffffff'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; e.currentTarget.style.color = '#f87171'; }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#0f172a', borderTop: '2px solid #334155', fontWeight: 900 }}>
                    <td colSpan="2" style={{ padding: '6px 6px', color: '#ffffff' }}>TOTAL POINTÉ ({jointures.length})</td>
                    <td className="mono" style={{ padding: '6px 6px', textAlign: 'right', color: '#60a5fa', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtN(totalJointuresSrc)}</td>
                    <td></td>
                    <td className="mono" style={{ padding: '6px 6px', textAlign: 'right', color: '#34d399', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtN(totalJointuresTgt)}</td>
                    <td className="mono" style={{ padding: '6px 6px', textAlign: 'right', color: totalJointuresEcart < 1 ? '#34d399' : '#f87171', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{fmtN(totalJointuresEcart)}</td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* ══ FOOTER — compact ══ */}
        <div style={{
          padding: '8px 20px',
          background: 'var(--surface-alt)',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 8, flexShrink: 0
        }}>
          {rule.explication && (
            <p style={{ margin: 0, fontSize: '0.73rem', color: 'var(--text-muted)', maxWidth: '75%', lineHeight: 1.35 }}>
              <span style={{ fontWeight: 800, color: 'var(--text)' }}>Diagnostic : </span>{rule.explication}
            </p>
          )}
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '6px 20px', fontSize: '0.78rem', fontWeight: 800, borderRadius: 6, marginLeft: 'auto' }}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}


