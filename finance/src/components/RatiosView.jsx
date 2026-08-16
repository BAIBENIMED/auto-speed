import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { getSecteur } from '../utils/secteurs';
import { calculateAltmanZScore } from '../utils/solvabiliteEngine';
import { exportFinancialWorkbook } from '../utils/excelExporter';

// ── Gauge Card (demi-cercle) ──
const GaugeCard = ({ title, description, value, min, max, isPercentage, targetNorm }) => {
  const safeValue = isFinite(value) ? value : 0;
  const normalized = Math.min(Math.max(((safeValue - min) / ((max - min) || 1)) * 100, 0), 100);
  const color = normalized >= 60 ? '#059669' : normalized >= 35 ? '#d97706' : '#dc2626';
  const rating = normalized >= 60 ? 'Bon' : normalized >= 35 ? 'Moyen' : 'Faible';
  const chartData = [
    { name: 'v', value: normalized },
    { name: 'r', value: 100 - normalized }
  ];
  const displayValue = isPercentage
    ? `${(safeValue * 100).toFixed(1)}%`
    : safeValue.toFixed(2);

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />

      <div style={{ marginBottom: 12, textAlign: 'center' }}>
        <p style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 4 }}>{title}</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)', lineHeight: 1.4, minHeight: '32px' }}>{description}</p>
        {targetNorm && (
          <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 10, border: '1px solid #bfdbfe' }}>
            Norme secteur : {targetNorm}
          </span>
        )}
      </div>

      <div style={{ position: 'relative', width: '180px', height: '95px', marginTop: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={55}
              outerRadius={78}
              paddingAngle={0}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="#f1f5f9" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center' }}>
          <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{displayValue}</span>
        </div>
      </div>

      <span className="badge" style={{ marginTop: 16, background: `${color}15`, color, borderColor: `${color}40`, fontSize: '0.65rem' }}>
        {rating}
      </span>
    </div>
  );
};

// ── Days Card (rotation avec barre de progression) ──
const DaysCard = ({ title, description, value, extraRate, extraLabel, thresholdGood, thresholdMed, unit = 'jours', invert = false, amount, normLabel, sectorLabel, fmt }) => {
  const safeVal = isFinite(value) && value > 0 ? value : 0;
  const isGood = invert ? safeVal <= thresholdGood : safeVal >= thresholdGood;
  const isMed  = invert ? safeVal <= thresholdMed  : safeVal >= thresholdMed;
  const color  = isGood ? '#059669' : isMed ? '#d97706' : '#dc2626';
  const rating = isGood ? 'Optimal' : isMed ? 'Acceptable' : invert ? 'Élevé' : 'Faible';
  const progress = Math.min((safeVal / ((thresholdMed * 1.8) || 1)) * 100, 100);
  const display  = safeVal > 0 ? Math.round(safeVal) : null;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden', minHeight: 220 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: color }} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8 }}>
          <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.05em', lineHeight: 1.3 }}>{title}</span>
          <span className="badge" style={{ background: `${color}15`, color, borderColor: `${color}40`, fontSize: '0.62rem', flexShrink: 0 }}>
            {rating}
          </span>
        </div>
        <p style={{ fontSize: '0.74rem', color: 'var(--text-sub)', lineHeight: 1.4, marginBottom: 8, minHeight: '30px' }}>{description}</p>

        {normLabel && (
          <div style={{ marginBottom: 10 }}>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, background: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: 10, border: '1px solid #ddd6fe' }}>
              🎯 Benchmark secteur ({sectorLabel || ''}) : {normLabel}
            </span>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-alt)', padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)', margin: '6px 0 10px' }}>
          <div>
            {display !== null ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span className="mono" style={{ fontSize: '1.9rem', fontWeight: 800, color, lineHeight: 1 }}>{display}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>{unit}</span>
              </div>
            ) : (
              <span className="mono" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#cbd5e1' }}>—</span>
            )}
            <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)', display: 'block', marginTop: 4 }}>Délai moyen d'écoulement</span>
          </div>

          {extraRate !== undefined && extraRate !== null && (
            <div style={{ textAlign: 'right', paddingLeft: 12, borderLeft: '1px solid var(--border)' }}>
              <span className="mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>{Number(extraRate).toFixed(1)}x</span>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-sub)', display: 'block' }}>{extraLabel || 'Rotations / an'}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        {amount !== undefined && amount !== null && fmt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', marginBottom: 8, paddingTop: 6, borderTop: '1px dashed var(--border)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Encours du poste :</span>
            <span className="mono" style={{ fontWeight: 800, color: 'var(--text)' }}>{fmt(amount)}</span>
          </div>
        )}

        <div>
          <div style={{ height: 6, width: '100%', background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 6, transition: 'width 0.6s ease', width: `${progress}%`, background: color }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.67rem', color: 'var(--text-sub)', fontWeight: 600 }}>
            <span>0 j</span>
            <span>Objectif ≤ {thresholdGood} j</span>
            <span>Seuil max {thresholdMed} j</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export function RatiosView({ data, bilan, sig, rows, formatCurrency, profil }) {
  if (!data) return (
    <div className="card" style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center', padding: '48px 32px' }}>
      <span className="material-symbols-outlined" style={{ fontSize: 52, color: 'var(--text-sub)', display: 'block', marginBottom: 16 }}>query_stats</span>
      <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>Ratios non disponibles</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Veuillez importer une balance comptable.</p>
    </div>
  );

  const fmt = formatCurrency || ((v) => (v || 0).toLocaleString('fr-FR') + ' DA');
  const secteur = getSecteur(profil?.secteurId || data?.profil?.secteurId);
  const bm = secteur.benchmarks;

  // Calcul du Score Altman Z'' et Rating de Solvabilité
  const solv = calculateAltmanZScore(bilan || {}, sig || {}, rows || []);

  const handleExportExcel = () => {
    exportFinancialWorkbook({ bilan, sig, ratios: data, rows, profil });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 40 }}>

      {/* ── En-tête avec macaron Secteur & Bouton Export Excel ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Ratios Financiers, Solvabilité &amp; Benchmarks</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Analyse comparative recalibrée sur les normes du secteur d'activité (SCF Algérie).</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 14, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: secteur.couleur, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#fff', fontSize: 16 }}>{secteur.icon}</span>
            </div>
            <div>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase' }}>Secteur Actif</div>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f172a' }}>{secteur.label}</div>
            </div>
          </div>

          <button
            onClick={handleExportExcel}
            style={{
              padding: '9px 16px', background: '#059669', color: '#fff', border: 'none', borderRadius: 12,
              fontWeight: 800, fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 8px rgba(5,150,105,0.2)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_view</span>
            Exporter Excel (.xlsx)
          </button>
        </div>
      </div>

      {/* ── 🛡️ NOUVELLE SECTION : SOLVABILITÉ, RATING BANCAIRE & ALTMAN Z''-SCORE ── */}
      <section style={{ background: '#ffffff', borderRadius: 16, border: '1px solid #e2e8f0', padding: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1e293b, #0f172a)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#38bdf8', fontSize: 20 }}>security</span>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>Score de Solvabilité &amp; Rating Bancaire (Altman Z'')</h3>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Modèle Altman Z'' adapté aux entreprises non cotées et pays émergents (EM-Score)</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: solv.zoneBg, color: solv.zoneColor, border: `1px solid ${solv.zoneBorder}`,
              padding: '6px 14px', borderRadius: 20, fontSize: '0.8rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 6
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
              Rating : {solv.rating} ({solv.zoneLabel.split('—')[0]})
            </span>
          </div>
        </div>

        {/* Grille principale Solvabilité */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
          
          {/* Carte 1 : Score Z'' */}
          <div style={{ background: solv.zoneBg, border: `1px solid ${solv.zoneBorder}`, borderRadius: 12, padding: 16, textAlign: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: solv.zoneColor, letterSpacing: '0.05em' }}>Score Altman Z''</span>
            <div className="mono" style={{ fontSize: '2.4rem', fontWeight: 900, color: solv.zoneColor, margin: '4px 0' }}>
              {solv.zScore.toFixed(2)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#475569', fontWeight: 700 }}>
              {solv.zScore >= 2.6 ? '🟢 Zone Saine (≥ 2.60)' : solv.zScore >= 1.1 ? '🟡 Zone Grise (1.10 - 2.60)' : '🔴 Zone Détresse (< 1.10)'}
            </span>
          </div>

          {/* Carte 2 : Probabilité de défaillance */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Risque de Défaillance</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 900, color: solv.zoneColor, margin: '6px 0 2px' }}>
              {solv.risqueDefaillance}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Probabilité d'insolvabilité à 2 ans</span>
            <div style={{ marginTop: 8, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${solv.scoreSolvabilite}%`, background: solv.zoneColor, borderRadius: 4 }} />
            </div>
          </div>

          {/* Carte 3 : Désendettement Bancaire (Dettes/EBE) */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Dettes Nettes / EBE</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 2px' }}>
              <span className="mono" style={{ fontSize: '1.4rem', fontWeight: 900, color: solv.bancaire.ratioDetteSurEBE <= 3.5 ? '#059669' : '#dc2626' }}>
                {solv.bancaire.ratioDetteSurEBE < 90 ? `${solv.bancaire.ratioDetteSurEBE.toFixed(1)} ans` : 'N/A'}
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Norme bancaire algérienne : ≤ 3.5 années d'EBE</span>
          </div>

          {/* Carte 4 : Capacité d'endettement théorique */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Capacité d'Emprunt Max</span>
            <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: '#2563eb', margin: '6px 0 2px' }}>
              {fmt(solv.bancaire.capaciteEndettementMax)}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Potentiel de financement bancaire LT additionnel</span>
          </div>

        </div>

        {/* Détail des 4 Composantes de la Formule Altman */}
        <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#2563eb' }}>functions</span>
            Formule Altman Z'' = 6.56×X₁ + 3.26×X₂ + 6.72×X₃ + 1.05×X₄
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            {Object.entries(solv.ratios).map(([key, item], idx) => (
              <div key={key} style={{ background: '#fff', padding: 10, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 800, color: '#64748b' }}>
                  <span>X{idx + 1} (Poids : ×{item.poids})</span>
                  <span className="mono" style={{ color: '#0f172a' }}>{item.val.toFixed(3)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{item.label}</div>
                <div style={{ fontSize: '0.67rem', color: '#94a3b8' }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Section 1 : Rotation & Délais ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--green)', fontSize: 20 }}>update</span>
          <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Ratios de Rotation &amp; Délais d'Exploitation</h3>
        </div>
        <div className="kpi-grid">
          <DaysCard
            title="Rotation des Stocks"
            description="Nombre de jours de stockage moyen avant vente."
            value={data.rotationStocks}
            extraRate={data.tauxRotationStocks}
            extraLabel="Vitesse (Achats/Stock)"
            amount={data.stocks}
            thresholdGood={bm.rotationStocks.bon}
            thresholdMed={bm.rotationStocks.limite}
            normLabel={bm.rotationStocks.norme}
            sectorLabel={secteur.label}
            fmt={fmt}
            invert={true}
          />
          <DaysCard
            title="Délai Recouvrement Créances (DSO)"
            description="Temps moyen d'encaissement des créances clients."
            value={data.delaiRecouvrement}
            extraRate={data.tauxRotationCreances}
            extraLabel="Vitesse (CA/Créances)"
            amount={data.creancesClients}
            thresholdGood={bm.dso.bon}
            thresholdMed={bm.dso.limite}
            normLabel={bm.dso.norme}
            sectorLabel={secteur.label}
            fmt={fmt}
            invert={true}
          />
          <DaysCard
            title="Délai Règlement Fournisseurs (DPO)"
            description="Temps moyen accordé par les fournisseurs."
            value={data.delaiFournisseurs}
            amount={data.dettesFournisseurs}
            thresholdGood={bm.dpo.bon}
            thresholdMed={bm.dpo.max}
            normLabel={bm.dpo.norme}
            sectorLabel={secteur.label}
            fmt={fmt}
            invert={false}
          />
          <DaysCard
            title="BFR en Jours de CA"
            description="Poids du besoin de roulement en jours d'activité."
            value={data.bfrJoursCA}
            unit="j CA"
            amount={(data.bfrJoursCA || 0) * ((data.chiffreAffaires || 0) / 360)}
            thresholdGood={bm.bfrJoursCA.bon}
            thresholdMed={bm.bfrJoursCA.limite}
            normLabel={bm.bfrJoursCA.norme}
            sectorLabel={secteur.label}
            fmt={fmt}
            invert={true}
          />
        </div>
      </section>

      {/* ── Section 2 : Jauges de Structure & Rentabilité ── */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>speed</span>
          <h3 style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Structure Financière &amp; Rentabilité</h3>
        </div>
        <div className="grid-3">
          <GaugeCard
            title="Liquidité Générale"
            description="Capacité à honorer les dettes CT."
            value={data.liquiditeGenerale}
            min={0}
            max={3}
            isPercentage={false}
            targetNorm={bm.liquiditeGenerale.norme}
          />
          <GaugeCard
            title="Autonomie Financière"
            description="Part des ressources stables."
            value={data.autonomieFinanciere}
            min={0}
            max={1}
            isPercentage={true}
            targetNorm={bm.autonomieFinanciere.norme}
          />
          <GaugeCard
            title="Rentabilité Nette"
            description="Résultat Net sur CA."
            value={data.rentabiliteNette}
            min={-0.1}
            max={0.3}
            isPercentage={true}
            targetNorm={bm.margeNette.norme}
          />
        </div>
      </section>

      {/* ── Tableau de synthèse avec Norme Sectorielle ── */}
      <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-alt)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)' }}>summarize</span>
            <h3 style={{ fontWeight: 800, fontSize: '0.95rem' }}>Synthèse des Ratios vs Benchmarks {secteur.label}</h3>
          </div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '4px 12px', borderRadius: 20, border: '1px solid #ddd6fe' }}>Référentiel Sectoriel SCF</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Indicateur / Ratio</th>
                <th style={{ textAlign: 'right' }}>Valeur Mesurée</th>
                <th style={{ textAlign: 'right' }}>Vitesse / Encours</th>
                <th style={{ textAlign: 'left', paddingLeft: 24 }}>Norme Sectorielle ({secteur.label})</th>
                <th style={{ textAlign: 'center' }}>Diagnostic</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  label: "Rotation des Stocks (Délai d'écoulement)",
                  value: `${Math.round(data.rotationStocks || 0)} jours`,
                  extra: `${(data.tauxRotationStocks || 0).toFixed(1)} x/an`,
                  norme: bm.rotationStocks.norme,
                  ok: (data.rotationStocks || 0) <= bm.rotationStocks.bon
                },
                {
                  label: 'Délai Recouvrement Créances Clients (DSO)',
                  value: `${Math.round(data.delaiRecouvrement || 0)} jours`,
                  extra: `${(data.tauxRotationCreances || 0).toFixed(1)} x/an`,
                  norme: bm.dso.norme,
                  ok: (data.delaiRecouvrement || 0) <= bm.dso.bon
                },
                {
                  label: 'Délai Règlement Dettes Fournisseurs (DPO)',
                  value: `${Math.round(data.delaiFournisseurs || 0)} jours`,
                  extra: fmt(data.dettesFournisseurs),
                  norme: bm.dpo.norme,
                  ok: (data.delaiFournisseurs || 0) >= bm.dpo.min && (data.delaiFournisseurs || 0) <= bm.dpo.max
                },
                {
                  label: 'Besoin en Fonds de Roulement (BFR)',
                  value: `${Math.round(data.bfrJoursCA || 0)} j CA`,
                  extra: fmt((data.bfrJoursCA || 0) * ((data.chiffreAffaires || 0) / 360)),
                  norme: bm.bfrJoursCA.norme,
                  ok: (data.bfrJoursCA || 0) <= bm.bfrJoursCA.bon
                },
                {
                  label: 'Liquidité Générale',
                  value: (data.liquiditeGenerale || 0).toFixed(2),
                  extra: 'Actif / Passif CT',
                  norme: bm.liquiditeGenerale.norme,
                  ok: (data.liquiditeGenerale || 0) >= bm.liquiditeGenerale.bon
                },
                {
                  label: 'Autonomie Financière',
                  value: `${((data.autonomieFinanciere || 0) * 100).toFixed(1)}%`,
                  extra: 'Ressources Stables',
                  norme: bm.autonomieFinanciere.norme,
                  ok: (data.autonomieFinanciere || 0) >= bm.autonomieFinanciere.bon
                },
                {
                  label: 'Rentabilité Nette',
                  value: `${((data.rentabiliteNette || 0) * 100).toFixed(1)}%`,
                  extra: 'Résultat / CA',
                  norme: bm.margeNette.norme,
                  ok: (data.rentabiliteNette || 0) >= bm.margeNette.bon
                },
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{row.label}</td>
                  <td className="right mono" style={{ fontWeight: 700 }}>{row.value}</td>
                  <td className="right mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.extra}</td>
                  <td className="mono" style={{ paddingLeft: 24, fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed' }}>{row.norme}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge" style={{
                      background: row.ok ? '#d1fae5' : '#fee2e2',
                      color: row.ok ? '#059669' : '#dc2626',
                      borderColor: row.ok ? '#6ee7b7' : '#fca5a5',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{row.ok ? 'check_circle' : 'warning'}</span>
                      {row.ok ? 'CONFORME' : 'ATTENTION'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
