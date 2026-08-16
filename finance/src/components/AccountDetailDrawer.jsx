import { useState } from 'react';
import { createPortal } from 'react-dom';

export function AccountDetailDrawer({ isOpen, onClose, title, accountPrefixes = [], excludePrefixes = [], rows = [], formatCurrency }) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const fmt = formatCurrency || ((v) => (v || 0).toLocaleString('fr-FR') + ' DA');

  // Filtrer les comptes correspondant aux préfixes demandés
  const matchingRows = (rows || []).filter(r => {
    if (!r.compte || r.ignore) return false;
    const c = r.compte.toString().trim();
    const isExcluded = excludePrefixes.some(ex => c.startsWith(ex));
    if (isExcluded) return false;
    
    const isIncluded = accountPrefixes.length === 0 || accountPrefixes.some(p => c.startsWith(p));
    if (!isIncluded) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const compte = c.toLowerCase();
      const libelle = String(r.libelle || '').toLowerCase();
      return compte.includes(q) || libelle.includes(q);
    }
    return true;
  });

  // Calcul des totaux du poste
  const totals = matchingRows.reduce((acc, r) => {
    const deb = r.soldeFinDebit || (r.solde > 0 ? r.solde : 0);
    const cred = r.soldeFinCredit || (r.solde < 0 ? -r.solde : 0);
    return {
      debit: acc.debit + deb,
      credit: acc.credit + cred,
      soldeNet: acc.soldeNet + (deb - cred)
    };
  }, { debit: 0, credit: 0, soldeNet: 0 });

  const totalAbsSolde = matchingRows.reduce((sum, r) => sum + Math.abs(r.soldeFinDebit || r.soldeFinCredit || r.solde || 0), 0) || 1;

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 99999,
      display: 'flex',
      justifyContent: 'flex-end',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      {/* Background click to close */}
      <div style={{ position: 'absolute', inset: 0 }} onClick={onClose} />

      {/* Drawer Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 680,
        height: '100%',
        background: 'var(--surface)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1,
        borderLeft: '1px solid var(--border)',
        animation: 'slideLeft 0.25s ease-out'
      }}>

        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-alt)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em', marginBottom: 2 }}>
              Détail &amp; Drill-down du Poste (SCF)
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
              {title}
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34, height: 34, borderRadius: 10, border: '1px solid var(--border)',
              background: 'var(--surface)', cursor: 'pointer', display: 'flex', alignItems: 'center',
              justify: 'center', color: 'var(--text-muted)', transition: 'background 0.15s'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {/* Search & Summary Bar */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge badge-blue" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                {matchingRows.length} compte{matchingRows.length > 1 ? 's' : ''} sous-jacent{matchingRows.length > 1 ? 's' : ''}
              </span>
              {accountPrefixes.length > 0 && (
                <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-sub)', background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                  Prefix: {accountPrefixes.join(', ')}
                </span>
              )}
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, display: 'block' }}>Solde Net Total</span>
              <span className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: totals.soldeNet >= 0 ? 'var(--primary-dk)' : 'var(--red)' }}>
                {fmt(totals.soldeNet)}
              </span>
            </div>
          </div>

          {/* Search Box */}
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-sub)' }}>search</span>
            <input
              type="text"
              placeholder="Filtrer les comptes généraux de ce poste..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface-alt)',
                fontSize: '0.8rem', outline: 'none', color: 'var(--text)'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
              </button>
            )}
          </div>
        </div>

        {/* Matching Accounts Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
          {matchingRows.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--text-sub)', display: 'block', marginBottom: 12 }}>info</span>
              <p style={{ margin: 0, fontWeight: 600 }}>Aucun compte trouvé pour ce poste.</p>
            </div>
          ) : (
            <table className="data-table" style={{ width: '100%', fontSize: '0.78rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--surface-alt)' }}>
                <tr>
                  <th style={{ width: '90px' }}>COMPTE</th>
                  <th>INTITULÉ DU COMPTE</th>
                  <th className="right">SOLDE DÉB.</th>
                  <th className="right">SOLDE CRÉ.</th>
                  <th className="right" style={{ width: '70px' }}>PART (%)</th>
                </tr>
              </thead>
              <tbody>
                {matchingRows.map((r, i) => {
                  const deb = r.soldeFinDebit || (r.solde > 0 ? r.solde : 0);
                  const cred = r.soldeFinCredit || (r.solde < 0 ? -r.solde : 0);
                  const absVal = Math.abs(deb || cred || r.solde || 0);
                  const pct = Math.min(Math.round((absVal / totalAbsSolde) * 100), 100);

                  return (
                    <tr key={i}>
                      <td>
                        <span className="mono" style={{ fontWeight: 700, color: 'var(--primary-dk)' }}>
                          {r.compte}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text)' }}>
                        {r.libelle}
                      </td>
                      <td className="right mono">
                        {deb > 0.01 ? fmt(deb) : <span style={{ color: 'var(--text-sub)' }}>—</span>}
                      </td>
                      <td className="right mono">
                        {cred > 0.01 ? fmt(cred) : <span style={{ color: 'var(--text-sub)' }}>—</span>}
                      </td>
                      <td className="right mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {pct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Drawer Footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface-alt)',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>Source: Balance Comptable SCF</span>
          <button className="btn btn-ghost" style={{ fontSize: '0.75rem', padding: '4px 12px' }} onClick={onClose}>
            Fermer le détail
          </button>
        </div>

      </div>

      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
