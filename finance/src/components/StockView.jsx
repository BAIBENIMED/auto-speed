import { calculateStockEvolution } from '../utils/financeCalculations';

export function StockView({ rows, ratios, formatCurrency }) {
  const fmt = (v) => formatCurrency ? formatCurrency(v) : (v || 0).toLocaleString('fr-FR');
  const fmtPct = (p) => {
    if (p === undefined || p === null || isNaN(p)) return '0.0%';
    const prefix = p > 0 ? '+' : '';
    return `${prefix}${p.toFixed(1)}%`;
  };
  const data = calculateStockEvolution(rows);

  // Indicateurs de rotation du stock
  const stockMoyen = ratios?.stockMoyen || ((data.totalInitial + data.totalFinal) / 2) || data.totalFinal;
  const rotationJours = ratios?.rotationStocks || 0;
  const tauxRotation = ratios?.tauxRotationStocks || 0;
  const achatsConsommes = ratios?.achats || 0;

  if (!data || data.categories.length === 0) {
    return (
      <div className="card fade-in" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 42, color: '#cbd5e1', display: 'block', marginBottom: 12 }}>inventory_2</span>
        <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>Aucune donnée de stock (Classe 3)</h4>
        <p style={{ fontSize: '0.8rem' }}>La balance ne contient aucun compte de stock actif.</p>
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      {/* Dynamic Rotation Indicators Header Card */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: '#38bdf8' }}>autorenew</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>Indicateurs de Vitesse & Rotation du Stock</h3>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Délai moyen d'écoulement du stock avant vente (SCF)</span>
            </div>
          </div>
          <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700 }}>
            Norme conseillée ≤ 90 jours
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Délai d'écoulement</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: rotationJours <= 90 ? '#34d399' : '#f87171' }}>
                {Math.round(rotationJours)}
              </span>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>jours</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>Stock Moyen / Achats × 360</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Taux de rotation</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <span className="mono" style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8' }}>
                {tauxRotation.toFixed(1)}x
              </span>
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1', fontWeight: 700 }}>/ an</span>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>Renouvellements du stock par an</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Stock Moyen Immobilisé</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: 4 }} className="mono">
              {fmt(stockMoyen)}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>(Initial {fmt(data.totalInitial)} → Final {fmt(data.totalFinal)})</span>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Achats Consommés (Cl. 60)</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', marginTop: 4 }} className="mono">
              {fmt(achatsConsommes)}
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', display: 'block', marginTop: 2 }}>Base de calcul des consommations</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Card Header */}
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: 'var(--primary)' }}>warehouse</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800 }}>Évolution des Stocks par Catégorie (SCF)</h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Analyse de la variation des stocks (Stockage vs Déstockage)</span>
            </div>
          </div>

          {/* Global Summary Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>Mouvement Global :</span>
            <span className={`badge ${data.globalMouvement === 'STOCKAGE' ? 'badge-green' : data.globalMouvement === 'DÉSTOCKAGE' ? 'badge-red' : 'badge-blue'}`} style={{ fontSize: '0.72rem', padding: '5px 12px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 13, marginRight: 4 }}>
                {data.globalMouvement === 'STOCKAGE' ? 'trending_up' : data.globalMouvement === 'DÉSTOCKAGE' ? 'trending_down' : 'remove'}
              </span>
              {data.globalMouvement} ({fmt(data.totalVariation)} | {fmtPct(data.totalPctVariation)})
            </span>
          </div>
        </div>

        {/* Categories Cards Grid */}
        <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, background: 'var(--surface-alt)' }}>
        {data.categories.map(cat => {
          const isStockage = cat.mouvement === 'STOCKAGE';
          const isDestockage = cat.mouvement === 'DÉSTOCKAGE';

          return (
            <div key={cat.code} style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 16,
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justify: 'space-between'
            }}>
              {/* Category Header */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--primary)', marginTop: 2, flexShrink: 0 }}>{cat.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.3 }}>{cat.label}</span>
                  </div>
                  <span className={`badge ${cat.badgeCls}`} style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 11, marginRight: 2 }}>
                      {isStockage ? 'arrow_upward' : isDestockage ? 'arrow_downward' : 'drag_handle'}
                    </span>
                    {cat.mouvement}
                  </span>
                </div>

                {/* Structured Rows for Numbers (Anti-overflow for large amounts) */}
                <div style={{ padding: '12px 14px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>DÉBUT (N-1) :</span>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(cat.stockInitial)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>FIN (N) :</span>
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(cat.stockFinal)}</span>
                  </div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>VARIATION :</span>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '0.88rem', color: isStockage ? 'var(--green)' : isDestockage ? 'var(--red)' : 'var(--text)' }}>
                      {cat.variation > 0 ? `+${fmt(cat.variation)}` : fmt(cat.variation)}
                      <span style={{ fontSize: '0.75rem', marginLeft: 5, opacity: 0.9 }}>
                        ({fmtPct(cat.pctVariation)})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Impact SCF */}
              <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)', background: 'var(--surface-alt)', border: '1px solid var(--border)', padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 15, color: isStockage ? 'var(--green)' : isDestockage ? 'var(--red)' : 'var(--text-sub)', flexShrink: 0 }}>info</span>
                <span style={{ lineHeight: 1.25 }}>{cat.impactSCF}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Table */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <table className="data-table compact-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '60px' }}>CODE</th>
              <th>RUBRIQUE DU STOCK</th>
              <th className="right">STOCK INIT.</th>
              <th className="right">STOCK FIN.</th>
              <th className="right">VAR. (VALEUR)</th>
              <th className="right">VAR. (%)</th>
              <th style={{ textAlign: 'center' }}>MOUVEMENT</th>
              <th>IMPACT COMPTABLE (SCF)</th>
            </tr>
          </thead>
          <tbody>
            {data.categories.map((cat, i) => (
              <tr key={i}>
                <td><span className="mono" style={{ fontWeight: 700, color: 'var(--primary-dk)' }}>{cat.code}</span></td>
                <td style={{ fontWeight: 600 }}>{cat.label}</td>
                <td className="right">{fmt(cat.stockInitial)}</td>
                <td className="right" style={{ fontWeight: 700 }}>{fmt(cat.stockFinal)}</td>
                <td className="right" style={{ fontWeight: 800, color: cat.variation > 0 ? 'var(--green)' : cat.variation < 0 ? 'var(--red)' : 'inherit' }}>
                  {cat.variation > 0 ? `+${fmt(cat.variation)}` : fmt(cat.variation)}
                </td>
                <td className="right" style={{ fontWeight: 800, color: cat.variation > 0 ? 'var(--green)' : cat.variation < 0 ? 'var(--red)' : 'inherit' }}>
                  {fmtPct(cat.pctVariation)}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <span className={`badge ${cat.badgeCls}`}>
                    {cat.mouvement}
                  </span>
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cat.impactSCF}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2" style={{ fontWeight: 800 }}>TOTAL DES STOCKS (CLASSE 3)</td>
              <td className="right">{fmt(data.totalInitial)}</td>
              <td className="right" style={{ fontWeight: 800 }}>{fmt(data.totalFinal)}</td>
              <td className="right" style={{ fontWeight: 800, color: data.totalVariation > 0 ? 'var(--green)' : data.totalVariation < 0 ? 'var(--red)' : 'inherit' }}>
                {data.totalVariation > 0 ? `+${fmt(data.totalVariation)}` : fmt(data.totalVariation)}
              </td>
              <td className="right" style={{ fontWeight: 800, color: data.totalVariation > 0 ? 'var(--green)' : data.totalVariation < 0 ? 'var(--red)' : 'inherit' }}>
                {fmtPct(data.totalPctVariation)}
              </td>
              <td style={{ textAlign: 'center' }}>
                <span className={`badge ${data.globalMouvement === 'STOCKAGE' ? 'badge-green' : data.globalMouvement === 'DÉSTOCKAGE' ? 'badge-red' : 'badge-blue'}`}>
                  {data.globalMouvement}
                </span>
              </td>
              <td style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary-dk)' }}>
                {data.globalMouvement === 'STOCKAGE' ? 'Augmentation globale des réserves' : 'Consommation globale des stocks'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </div>
);
}
