import { useState } from 'react';
import { AccountDetailDrawer } from './AccountDetailDrawer';

export function BilanView({ data, dataN1, rows, formatCurrency }) {
  const [drawerState, setDrawerState] = useState({ isOpen: false, title: '', accountPrefixes: [], excludePrefixes: [] });
  const [isComparative, setIsComparative] = useState(false);

  const fmt = (v) => formatCurrency ? formatCurrency(v) : (v || 0).toLocaleString('fr-FR');
  const fmtPct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

  if (!data) return (
    <div className="card fade-in" style={{ maxWidth: 420, margin: '60px auto' }}>
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }}>account_tree</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>Bilan non disponible</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Veuillez importer une balance comptable.</p>
      </div>
    </div>
  );

  const totalActifN  = (data.emploisStables || 0) + (data.actifCirculant || 0) + (data.tresorerieActive || 0);
  const totalActifN1 = dataN1?.bilan ? ((dataN1.bilan.emploisStables || 0) + (dataN1.bilan.actifCirculant || 0) + (dataN1.bilan.tresorerieActive || 0)) : 0;

  const openDrillDown = (title, prefixes, exclude = []) => {
    setDrawerState({ isOpen: true, title, accountPrefixes: prefixes, excludePrefixes: exclude });
  };

  const hasN1 = !!dataN1?.bilan;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div className="section-title">Bilan Fonctionnel</div>
          <div className="section-sub" style={{ marginBottom: 0 }}>Analyse de la structure financière et de l'équilibre des ressources. Cliquez sur un poste pour le détail.</div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {hasN1 && (
            <div style={{ display: 'flex', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10, padding: 3 }}>
              <button
                onClick={() => setIsComparative(false)}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: !isComparative ? 'var(--primary)' : 'transparent', color: !isComparative ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                Exercice N
              </button>
              <button
                onClick={() => setIsComparative(true)}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: isComparative ? 'var(--primary)' : 'transparent', color: isComparative ? '#fff' : 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                📊 Comparatif N vs N-1
              </button>
            </div>
          )}
          <button className="btn btn-ghost" onClick={() => window.print()}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            EXPORTER PDF
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid-3">
        {[
          { label: 'FRNG', sub: 'Fonds de Roulement Net Global', value: data.frng, valN1: dataN1?.bilan?.frng, good: data.frng >= 0, icon: 'account_balance_wallet', tag: data.frng >= 0 ? 'Excédent' : 'Déficit', color: data.frng >= 0 ? '#059669' : '#dc2626' },
          { label: 'BFR', sub: 'Besoin en Fonds de Roulement', value: data.bfr, valN1: dataN1?.bilan?.bfr, good: true, icon: 'sync_alt', tag: 'Besoin', color: '#d97706' },
          { label: 'Trésorerie Nette', sub: 'Disponibilités réelles', value: data.tn, valN1: dataN1?.bilan?.tn, good: data.tn >= 0, icon: 'payments', tag: data.tn >= 0 ? 'Solide' : 'Tension', color: data.tn >= 0 ? '#2563eb' : '#dc2626' },
        ].map((k, i) => (
          <div key={i} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span className="kpi-label">{k.label}</span>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: k.color, display: 'flex', alignItems: 'center', gap: 2 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{k.good ? 'trending_up' : 'warning'}</span>
                {k.tag}
              </span>
            </div>
            <div className="kpi-value" style={{ color: k.color }}>{fmt(k.value)}</div>
            {hasN1 && k.valN1 !== undefined && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                N-1: <strong>{fmt(k.valN1)}</strong> ({fmtPct(k.valN1 ? ((k.value - k.valN1) / Math.abs(k.valN1)) * 100 : 0)})
              </div>
            )}
            <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#94a3b8' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <h3>Décomposition du Bilan Fonctionnel</h3>
          <span className="badge badge-blue">
            {isComparative ? '📊 Comparatif Exercice N vs N-1' : 'Exercice N'}
          </span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>POSTE DU BILAN</th>
                <th className="right">EXERCICE N</th>
                {isComparative && <th className="right">EXERCICE N-1</th>}
                {isComparative && <th className="right">ÉVOLUTION</th>}
                {isComparative && <th className="right">VAR. (%)</th>}
                <th style={{ width: '80px', textAlign: 'center' }}>DÉTAIL</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: '#eff6ff' }}>
                <td colSpan={isComparative ? 6 : 3} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1e3a8a' }}>I. ACTIF (EMPLOIS)</td>
              </tr>
              {[
                { label: 'Emplois Stables (Immobilisations brut)', val: data.emploisStables, valN1: dataN1?.bilan?.emploisStables, prefixes: ['2'], exclude: ['28', '29'] },
                { label: 'Actif Circulant (Stocks + Créances)', val: data.actifCirculant, valN1: dataN1?.bilan?.actifCirculant, prefixes: ['3', '4'], exclude: ['40', '419', '39', '49'] },
                { label: 'Trésorerie Active (Caisse & Banques)', val: data.tresorerieActive, valN1: dataN1?.bilan?.tresorerieActive, prefixes: ['5'], exclude: ['519', '59'], color: '#059669' },
              ].map((r, i) => {
                const diff = (r.val || 0) - (r.valN1 || 0);
                const pct  = r.valN1 ? (diff / Math.abs(r.valN1)) * 100 : 0;
                return (
                  <tr key={i} onClick={() => openDrillDown(r.label, r.prefixes, r.exclude)} style={{ cursor: 'pointer' }}>
                    <td style={{ paddingLeft: 32, fontWeight: 600 }}>{r.label}</td>
                    <td className="right" style={{ color: r.color || 'var(--text)', fontWeight: 700 }}>{fmt(r.val)}</td>
                    {isComparative && <td className="right mono">{fmt(r.valN1)}</td>}
                    {isComparative && <td className="right mono" style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{diff > 0 ? '+' : ''}{fmt(diff)}</td>}
                    {isComparative && <td className="right mono" style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(pct)}</td>}
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.62rem', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>visibility</span> Voir
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background: '#f0fdf4' }}>
                <td colSpan={isComparative ? 6 : 3} style={{ padding: '8px 16px', fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#14532d' }}>II. PASSIF (RESSOURCES)</td>
              </tr>
              {[
                { label: 'Ressources Stables (Capitaux Propres + Amort. + Dettes LT)', val: data.ressourcesStables, valN1: dataN1?.bilan?.ressourcesStables, prefixes: ['1', '28', '29'] },
                { label: 'Passif Circulant (Dettes Fournisseurs & Fiscales)', val: data.passifCirculant, valN1: dataN1?.bilan?.passifCirculant, prefixes: ['40', '419', '42', '43', '44'] },
                { label: 'Trésorerie Passive (Concours bancaires)', val: data.tresoreriePassive, valN1: dataN1?.bilan?.tresoreriePassive, prefixes: ['519'], color: '#dc2626' },
              ].map((r, i) => {
                const diff = (r.val || 0) - (r.valN1 || 0);
                const pct  = r.valN1 ? (diff / Math.abs(r.valN1)) * 100 : 0;
                return (
                  <tr key={i} onClick={() => openDrillDown(r.label, r.prefixes, r.exclude)} style={{ cursor: 'pointer' }}>
                    <td style={{ paddingLeft: 32, fontWeight: 600 }}>{r.label}</td>
                    <td className="right" style={{ color: r.color || 'var(--text)', fontWeight: 700 }}>{fmt(r.val)}</td>
                    {isComparative && <td className="right mono">{fmt(r.valN1)}</td>}
                    {isComparative && <td className="right mono" style={{ color: diff <= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{diff > 0 ? '+' : ''}{fmt(diff)}</td>}
                    {isComparative && <td className="right mono" style={{ color: diff <= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtPct(pct)}</td>}
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-blue" style={{ fontSize: '0.62rem', cursor: 'pointer' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 11 }}>visibility</span> Voir
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e40af' }}>TOTAL BILAN (ACTIF / PASSIF)</td>
                <td className="right" style={{ color: '#1e40af', fontSize: '1rem' }}>{fmt(totalActifN)}</td>
                {isComparative && <td className="right mono">{fmt(totalActifN1)}</td>}
                {isComparative && <td className="right mono">{fmt(totalActifN - totalActifN1)}</td>}
                {isComparative && <td className="right mono">{fmtPct(totalActifN1 ? ((totalActifN - totalActifN1) / totalActifN1) * 100 : 0)}</td>}
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Equilibrium */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: 20 }}>balance</span>
            Équilibre Financier
          </h3>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { title: 'FRNG = Ressources Stables − Emplois Stables', val: fmt(data.frng), color: '#2563eb', note: data.frng >= 0 ? "Les ressources stables couvrent l'intégralité des emplois stables, générant un surplus de sécurité." : "Les emplois stables dépassent les ressources stables, créant un déficit de structure." },
            { title: 'BFR = Actif Circulant − Passif Circulant', val: fmt(data.bfr), color: 'var(--text)', note: "Décalage de trésorerie entre le paiement des fournisseurs et l'encaissement des ventes." },
            { title: 'TN = FRNG − BFR', val: fmt(data.tn), color: '#2563eb', note: data.tn >= 0 ? "L'excédent du FRNG est suffisant pour financer le BFR, laissant une trésorerie disponible." : "Le BFR absorbe tout le FRNG et nécessite des concours bancaires de court terme.", blue: true },
          ].map((item, i) => (
            <div key={i} style={{ padding: '14px 18px', borderRadius: 10, border: `1px solid ${item.blue ? '#bfdbfe' : 'var(--border)'}`, background: item.blue ? '#eff6ff' : 'var(--surface-alt)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: item.blue ? '#1e40af' : 'var(--text-muted)' }}>{item.title}</span>
                <span className="mono" style={{ fontWeight: 800, fontSize: '0.875rem', color: item.color }}>{item.val}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: item.blue ? '#1e40af' : 'var(--text-muted)' }}>{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Account Detail Drawer */}
      <AccountDetailDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
        title={drawerState.title}
        accountPrefixes={drawerState.accountPrefixes}
        excludePrefixes={drawerState.excludePrefixes}
        rows={rows}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}

