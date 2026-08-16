import { exportFinancialWorkbook } from '../utils/excelExporter';
import { calculateAltmanZScore } from '../utils/solvabiliteEngine';

/* ═══════════════════════════════════════════════════════════
   FINANALYZE — Rapport Financier Complet avec Solvabilité & Altman Z''
   ═══════════════════════════════════════════════════════════ */

const KpiRow = ({ label, value, sub, ok }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {sub && <span style={{ fontSize: '0.72rem', color: 'var(--text-sub)' }}>{sub}</span>}
      <span className="mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: ok === true ? '#059669' : ok === false ? '#dc2626' : 'var(--text)' }}>{value}</span>
    </div>
  </div>
);

export function ReportsView({ data, fmt }) {

  /* ── Garde — données manquantes ── */
  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40 }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Rapport Financier Complet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Analyse détaillée avec diagnostic, forces &amp; faiblesses (SCF Algérie).</p>
      </div>
      <div className="card" style={{ maxWidth: 480, margin: '20px auto', textAlign: 'center', padding: '48px 32px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: 'var(--text-sub)', display: 'block', marginBottom: 16 }}>description</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>Aucune donnée disponible</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Importez une balance comptable pour générer le rapport complet.</p>
      </div>
    </div>
  );

  const { bilan, sig, ratios, rows, profil } = data;
  const r = ratios || {};
  const s = sig || {};
  const b = bilan || {};

  /* ── Helpers ── */
  const fmtPct = (v) => `${(v >= 0 ? '+' : '')}${(v * 100).toFixed(1)} %`;
  const fmtRatio = (v, dec = 2) => (isFinite(v) ? v.toFixed(dec) : '—');
  const fmtDays = (v) => `${Math.round(v || 0)} j`;
  const safeDiv = (a, b) => (b && b !== 0 ? a / b : 0);

  /* ── Calculs dérivés ── */
  const margeEBE     = safeDiv(s.ebe, s.chiffreAffaires);
  const margeExploit = safeDiv(s.resultatExploitation, s.chiffreAffaires);
  const margeNette   = r.rentabiliteNette || safeDiv(s.resultatNet, s.chiffreAffaires);
  const tauxVA       = safeDiv(s.valeurAjoutee, s.chiffreAffaires);
  const tauxPersonnel= safeDiv(s.chargesPersonnel, s.valeurAjoutee);
  const couvertureCharge = safeDiv(s.ebe, s.chargesFinancieres);
  const bfrJCA       = r.bfrJoursCA || 0;
  const dso          = r.delaiRecouvrement || 0;
  const dpo          = r.delaiFournisseurs || 0;
  const rotStock     = r.rotationStocks || 0;
  const liqGen       = r.liquiditeGenerale || 0;
  const autFinanc    = r.autonomieFinanciere || 0;

  // Calcul du Score Altman Z'' et Rating de Solvabilité
  const solv = calculateAltmanZScore(bilan || {}, sig || {}, rows || []);

  /* ── Moteur de diagnostic Forces / Faiblesses ── */
  const analyse = [];

  // Trésorerie nette
  if ((b.tn || 0) > 0) {
    analyse.push({ type: 'force', cat: 'Trésorerie', icon: 'account_balance_wallet',
      titre: 'Trésorerie nette positive',
      detail: `La trésorerie nette est de ${fmt(b.tn)}, indiquant une position de liquidité saine. L'entreprise dispose de réserves disponibles pour faire face à ses engagements immédiats.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Trésorerie', icon: 'money_off',
      titre: 'Trésorerie nette négative',
      detail: `Trésorerie nette de ${fmt(b.tn)}. L'entreprise est en tension de liquidité. Des lignes de crédit court terme semblent utilisées pour financer l'exploitation.` });
  }

  // FRNG
  if ((b.frng || 0) > 0) {
    analyse.push({ type: 'force', cat: 'Équilibre financier', icon: 'balance',
      titre: 'FRNG positif — Équilibre long terme assuré',
      detail: `Le Fonds de Roulement Net Global s'élève à ${fmt(b.frng)}. Les ressources stables financent intégralement les emplois stables et génèrent un excédent disponible pour l'exploitation.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Équilibre financier', icon: 'warning',
      titre: 'FRNG négatif — Déséquilibre structurel',
      detail: `Le FRNG est déficitaire : ${fmt(b.frng)}. Des emplois stables sont financés par des ressources à court terme, ce qui fragilise l'équilibre financier de l'entité.` });
  }

  // BFR
  if ((b.bfr || 0) >= 0) {
    analyse.push({ type: 'neutre', cat: 'BFR', icon: 'loop',
      titre: 'BFR positif — Besoin de financement',
      detail: `Le Besoin en Fonds de Roulement est de ${fmt(b.bfr)} (${fmtDays(bfrJCA)} de CA). Ce besoin est structurel à l'activité : il doit être couvert par le FRNG.` });
  } else {
    analyse.push({ type: 'force', cat: 'BFR', icon: 'trending_down',
      titre: 'BFR négatif — Ressource d\'exploitation',
      detail: `Un BFR négatif de ${fmt(b.bfr)} signifie que les fournisseurs financent l'activité : l'entreprise encaisse avant de payer. Situation favorable typique du commerce ou grande distribution.` });
  }

  // Rentabilité
  if (margeNette > 0.05) {
    analyse.push({ type: 'force', cat: 'Rentabilité', icon: 'trending_up',
      titre: 'Rentabilité nette solide',
      detail: `La marge nette est de ${fmtPct(margeNette)} du CA (${fmt(s.resultatNet)}). Cette rentabilité témoigne d'une bonne maîtrise des coûts et d'une activité commerciale profitable.` });
  } else if (margeNette > 0) {
    analyse.push({ type: 'neutre', cat: 'Rentabilité', icon: 'show_chart',
      titre: 'Rentabilité nette faible mais positive',
      detail: `La marge nette est de ${fmtPct(margeNette)} du CA. L'entreprise est bénéficiaire mais la marge reste fragile. Un effort sur les charges ou une hausse du CA est conseillé.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Rentabilité', icon: 'trending_down',
      titre: 'Résultat net déficitaire',
      detail: `L'exercice se solde par une perte de ${fmt(s.resultatNet)}. L'entreprise détruit de la valeur. Une restructuration des charges ou de l'activité est nécessaire.` });
  }

  // EBE
  if (margeEBE > 0.10) {
    analyse.push({ type: 'force', cat: 'EBE', icon: 'query_stats',
      titre: 'Excédent Brut d\'Exploitation satisfaisant',
      detail: `La marge EBE est de ${fmtPct(margeEBE)} du CA (${fmt(s.ebe)}). L'EBE permet de couvrir les amortissements, les charges financières et de dégager un résultat positif.` });
  } else if (margeEBE > 0) {
    analyse.push({ type: 'neutre', cat: 'EBE', icon: 'query_stats',
      titre: 'EBE positif mais insuffisant',
      detail: `Marge EBE de ${fmtPct(margeEBE)} du CA. La capacité d'autofinancement est limitée. Il convient d'analyser la structure des charges opérationnelles.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'EBE', icon: 'warning',
      titre: 'EBE négatif — Activité non rentable avant financement',
      detail: `EBE négatif de ${fmt(s.ebe)}. L'activité courante ne génère pas assez pour couvrir ses propres charges d'exploitation. Situation critique nécessitant un plan de redressement.` });
  }

  // Liquidité générale
  if (liqGen >= 1.5) {
    analyse.push({ type: 'force', cat: 'Liquidité', icon: 'water_drop',
      titre: 'Liquidité générale excellente',
      detail: `Ratio de ${fmtRatio(liqGen)}. L'actif circulant couvre très largement le passif à court terme. Solvabilité à court terme assurée avec une marge confortable.` });
  } else if (liqGen >= 1) {
    analyse.push({ type: 'neutre', cat: 'Liquidité', icon: 'water_drop',
      titre: 'Liquidité générale satisfaisante',
      detail: `Ratio de ${fmtRatio(liqGen)}. L'actif circulant couvre le passif à court terme, mais la marge est limitée. Surveiller l'évolution du BFR.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Liquidité', icon: 'warning',
      titre: 'Risque de liquidité à court terme',
      detail: `Ratio de ${fmtRatio(liqGen)} (< 1). L'actif circulant est insuffisant pour couvrir le passif à court terme. Risque d'insolvabilité si un créancier exige un remboursement immédiat.` });
  }

  // Autonomie financière
  if (autFinanc >= 0.5) {
    analyse.push({ type: 'force', cat: 'Structure financière', icon: 'shield',
      titre: 'Forte autonomie financière',
      detail: `Autonomie financière de ${fmtPct(autFinanc)} du total bilan. L'entreprise se finance majoritairement par ses fonds propres, ce qui lui donne une indépendance vis-à-vis des créanciers.` });
  } else if (autFinanc >= 0.3) {
    analyse.push({ type: 'neutre', cat: 'Structure financière', icon: 'shield',
      titre: 'Autonomie financière acceptable',
      detail: `Autonomie de ${fmtPct(autFinanc)}. La structure de financement est équilibrée mais l'endettement représente une part significative du bilan.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Structure financière', icon: 'shield',
      titre: 'Dépendance excessive aux dettes',
      detail: `Autonomie financière de seulement ${fmtPct(autFinanc)}. L'entreprise est fortement dépendante des créanciers. En cas de resserrement du crédit, la situation peut devenir critique.` });
  }

  // DSO — Créances clients
  if (dso > 0 && dso <= 45) {
    analyse.push({ type: 'force', cat: 'Créances clients', icon: 'payments',
      titre: 'Recouvrement clients rapide',
      detail: `DSO de ${fmtDays(dso)} : les clients paient rapidement. Le risque de créances irrécouvrables est limité et le cycle de trésorerie est favorable.` });
  } else if (dso > 45 && dso <= 90) {
    analyse.push({ type: 'neutre', cat: 'Créances clients', icon: 'payments',
      titre: 'DSO à surveiller',
      detail: `Délai de recouvrement de ${fmtDays(dso)}. Le délai client est dans la moyenne, mais une relance proactive permettrait d'améliorer la trésorerie.` });
  } else if (dso > 90) {
    analyse.push({ type: 'faiblesse', cat: 'Créances clients', icon: 'warning',
      titre: 'Délai de recouvrement clients élevé',
      detail: `DSO de ${fmtDays(dso)} : les créances clients restent longtemps en portefeuille. Risque accru d'impayés et de dégradation de la trésorerie. Renforcer la politique de relance.` });
  }

  // DPO — Fournisseurs
  if (dpo >= 30 && dpo <= 90) {
    analyse.push({ type: 'force', cat: 'Dettes fournisseurs', icon: 'receipt_long',
      titre: 'Délai fournisseurs équilibré',
      detail: `DPO de ${fmtDays(dpo)} : les délais de paiement fournisseurs sont dans la norme SCF (30-90j). L'entreprise bénéficie d'un crédit fournisseur sain.` });
  } else if (dpo < 30 && dpo > 0) {
    analyse.push({ type: 'neutre', cat: 'Dettes fournisseurs', icon: 'receipt_long',
      titre: 'Paiement fournisseurs trop rapide',
      detail: `DPO de seulement ${fmtDays(dpo)} : l'entreprise paie ses fournisseurs très tôt. Négocier des délais plus longs permettrait de réduire le BFR.` });
  } else if (dpo > 90) {
    analyse.push({ type: 'faiblesse', cat: 'Dettes fournisseurs', icon: 'warning',
      titre: 'Délai fournisseurs excessif',
      detail: `DPO de ${fmtDays(dpo)} : les fournisseurs sont payés très tardivement. Risque de tensions commerciales, pénalités de retard ou rupture d'approvisionnement.` });
  }

  // Rotation des stocks
  if (rotStock > 0 && rotStock <= 60) {
    analyse.push({ type: 'force', cat: 'Stocks', icon: 'warehouse',
      titre: 'Bonne rotation des stocks',
      detail: `Délai d'écoulement de ${fmtDays(rotStock)} : les stocks se renouvellent rapidement. Risque d'obsolescence faible et immobilisations financières limitées.` });
  } else if (rotStock > 60 && rotStock <= 120) {
    analyse.push({ type: 'neutre', cat: 'Stocks', icon: 'warehouse',
      titre: 'Rotation des stocks à optimiser',
      detail: `Délai de ${fmtDays(rotStock)} : le stock s'écoule lentement. Des sur-stockages peuvent exister. Une politique de réapprovisionnement plus précise est recommandée.` });
  } else if (rotStock > 120) {
    analyse.push({ type: 'faiblesse', cat: 'Stocks', icon: 'warning',
      titre: 'Rotation des stocks très lente',
      detail: `Délai de ${fmtDays(rotStock)} : les stocks sont immobilisés trop longtemps. Risque d'obsolescence, coût de stockage élevé et impact négatif sur le BFR.` });
  }

  // Valeur ajoutée
  if (tauxVA >= 0.25) {
    analyse.push({ type: 'force', cat: 'Création de valeur', icon: 'add_circle',
      titre: 'Taux de valeur ajoutée élevé',
      detail: `Taux de VA de ${fmtPct(tauxVA)} du CA (${fmt(s.valeurAjoutee)}). L'entreprise crée une part importante de richesse nette par rapport à ses approvisionnements externes.` });
  } else {
    analyse.push({ type: 'neutre', cat: 'Création de valeur', icon: 'add_circle',
      titre: 'Taux de valeur ajoutée modéré',
      detail: `Taux de VA de ${fmtPct(tauxVA)} du CA. La valeur ajoutée dépend fortement des achats externes. Veiller à la maîtrise des coûts d'approvisionnement.` });
  }

  // Charges de personnel
  if (tauxPersonnel <= 0.60) {
    analyse.push({ type: 'force', cat: 'Productivité RH', icon: 'badge',
      titre: 'Charges de personnel maîtrisées',
      detail: `Les charges de personnel représentent ${fmtPct(tauxPersonnel)} de la VA. La productivité du travail est bonne et laisse une marge suffisante pour l'EBE.` });
  } else if (tauxPersonnel <= 0.75) {
    analyse.push({ type: 'neutre', cat: 'Productivité RH', icon: 'badge',
      titre: 'Poids des charges de personnel important',
      detail: `Les salaires absorbent ${fmtPct(tauxPersonnel)} de la VA. Ce ratio est correct mais laisse peu de marge de manœuvre en cas de baisse d'activité.` });
  } else {
    analyse.push({ type: 'faiblesse', cat: 'Productivité RH', icon: 'warning',
      titre: 'Charges de personnel trop lourdes',
      detail: `Les charges de personnel absorbent ${fmtPct(tauxPersonnel)} de la VA (> 75%). L'EBE est comprimé, ce qui limite fortement la capacité d'autofinancement de l'entreprise.` });
  }

  // Couverture charges financières
  if (s.chargesFinancieres > 0) {
    if (couvertureCharge >= 3) {
      analyse.push({ type: 'force', cat: 'Risque financier', icon: 'savings',
        titre: 'Couverture des charges financières confortable',
        detail: `L'EBE couvre ${couvertureCharge.toFixed(1)}x les charges financières. L'entreprise peut facilement honorer ses intérêts d'emprunt.` });
    } else {
      analyse.push({ type: 'faiblesse', cat: 'Risque financier', icon: 'warning',
        titre: 'Poids excessif des charges financières',
        detail: `L'EBE ne couvre que ${couvertureCharge.toFixed(1)}x les charges financières (< 3x). Le risque de défaut en cas de baisse d'activité est accru.` });
    }
  }

  const nbForces     = analyse.filter(a => a.type === 'force').length;
  const nbFaiblesses = analyse.filter(a => a.type === 'faiblesse').length;
  const nbNeutre     = analyse.filter(a => a.type === 'neutre').length;

  const score = Math.max(0, Math.min(100, Math.round(50 + (nbForces * 8) - (nbFaiblesses * 10))));
  const scoreColor = score >= 70 ? '#059669' : score >= 45 ? '#d97706' : '#dc2626';
  const scoreLabel = score >= 70 ? 'Situation financière solide' : score >= 45 ? 'Situation financière sous surveillance' : 'Situation financière fragile — Action requise';

  /* ── Export Multi-Feuilles Excel via excelExporter ── */
  const handleExportExcel = () => {
    exportFinancialWorkbook(data, `Rapport_Financier_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  /* ── Couleurs par type ── */
  const typeStyle = {
    force:    { bg: '#f0fdf4', border: '#86efac', color: '#166534', icon: 'check_circle', label: 'FORCE' },
    faiblesse:{ bg: '#fff1f2', border: '#fca5a5', color: '#be123c', icon: 'cancel',       label: 'FAIBLESSE' },
    neutre:   { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: 'info',         label: 'NEUTRE' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 48 }} id="rapport-financier">

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Rapport Financier Complet</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Diagnostic complet avec analyse des forces, faiblesses, solvabilité &amp; recommandations — référentiel SCF Algérie</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportExcel}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: '#059669', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 8px rgba(5,150,105,0.2)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>table_view</span>
            Export Classeur Excel Multi-Feuilles (.xlsx)
          </button>
          <button
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, borderRadius: 10, padding: '9px 16px', fontWeight: 800 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
            Imprimer / Exporter PDF
          </button>
        </div>
      </div>

      {/* ── Score global & Solvabilité Altman ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
        {/* Score de santé */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', background: `${scoreColor}10`, borderBottom: `3px solid ${scoreColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', color: scoreColor, marginBottom: 4 }}>Score de Santé Financière</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: scoreColor, lineHeight: 1 }} className="mono">{score} / 100</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{scoreLabel}</div>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {[
                { label: 'Forces',    count: nbForces,    color: '#059669', bg: '#f0fdf4' },
                { label: 'Neutres',   count: nbNeutre,    color: '#d97706', bg: '#fffbeb' },
                { label: 'Faiblesses',count: nbFaiblesses,color: '#dc2626', bg: '#fff1f2' },
              ].map(({ label, count, color, bg }) => (
                <div key={label} style={{ background: bg, border: `1px solid ${color}30`, borderRadius: 10, padding: '8px 14px', textAlign: 'center', minWidth: 70 }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color }} className="mono">{count}</div>
                  <div style={{ fontSize: '0.65rem', fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ padding: '10px 20px', background: 'var(--surface-alt)' }}>
            <div style={{ height: 8, borderRadius: 4, background: '#fee2e2', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${score}%`, background: scoreColor, borderRadius: 4, transition: 'width 1s ease' }} />
            </div>
          </div>
        </div>

        {/* Score Altman Z'' & Rating Bancaire */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', background: solv.zoneBg, borderBottom: `3px solid ${solv.zoneColor}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.06em', color: solv.zoneColor, marginBottom: 4 }}>Rating Crédit &amp; Altman Z''</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: solv.zoneColor, lineHeight: 1 }} className="mono">Rating : {solv.rating}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginTop: 4 }}>Score Z'' : {solv.zScore.toFixed(2)} ({solv.zoneLabel.split('—')[0]})</div>
            </div>
            <div style={{ background: '#fff', padding: '10px 14px', borderRadius: 10, border: `1px solid ${solv.zoneBorder}`, textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 700 }}>Risque de Défaillance</div>
              <div style={{ fontSize: '0.95rem', fontWeight: 900, color: solv.zoneColor }}>{solv.risqueDefaillance}</div>
              <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: 2 }}>Statut Crédit : <strong>{solv.bancaire.statutCredit}</strong></div>
            </div>
          </div>
          <div style={{ padding: '10px 20px', background: 'var(--surface-alt)', display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', color: '#64748b' }}>
            <span>Désendettement : <strong>{solv.bancaire.ratioDetteSurEBE < 90 ? `${solv.bancaire.ratioDetteSurEBE.toFixed(1)} ans d'EBE` : 'N/A'}</strong></span>
            <span>Capacité emprunt : <strong style={{ color: '#2563eb' }}>{fmt(solv.bancaire.capaciteEndettementMax)}</strong></span>
          </div>
        </div>
      </div>

      {/* ── Section 1 : Équilibre Fonctionnel ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>account_tree</span>
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem' }}>1. Équilibre Fonctionnel (SCF)</h3>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Emplois Stables',      val: b.emploisStables,    sub: 'Actif Non Courant', color: '#2563eb' },
            { label: 'Ressources Stables',   val: b.ressourcesStables, sub: 'Capitaux Permanents', color: '#059669' },
            { label: 'FRNG',                 val: b.frng,              sub: 'Ressources − Emplois', color: (b.frng||0)>=0 ? '#059669':'#dc2626', bold: true },
            { label: 'Actif Circulant',      val: b.actifCirculant,    sub: 'Stocks + Créances', color: '#2563eb' },
            { label: 'Passif Circulant',     val: b.passifCirculant,   sub: 'Dettes CT', color: '#d97706' },
            { label: 'BFR',                  val: b.bfr,               sub: 'Actif Circ. − Passif Circ.', color: (b.bfr||0)>=0 ? '#d97706':'#059669', bold: true },
            { label: 'Trésorerie Active',    val: b.tresorerieActive,  sub: 'Liquidités', color: '#2563eb' },
            { label: 'Trésorerie Passive',   val: b.tresoreriePassive, sub: 'Concours bancaires', color: '#dc2626' },
            { label: 'Trésorerie Nette',     val: b.tn,                sub: 'FRNG − BFR', color: (b.tn||0)>=0 ? '#059669':'#dc2626', bold: true },
          ].map(({ label, val, sub, color, bold }) => (
            <div key={label} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${color}` }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>{label}</div>
              <div className="mono" style={{ fontSize: bold ? '1.05rem' : '0.95rem', fontWeight: bold ? 900 : 700, color }}>{fmt(val)}</div>
              <div style={{ fontSize: '0.67rem', color: 'var(--text-sub)', marginTop: 2 }}>{sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 2 : Soldes Intermédiaires de Gestion ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 20 }}>analytics</span>
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem' }}>2. Soldes Intermédiaires de Gestion (TCR / SCF)</h3>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { label: "Chiffre d'Affaires (CA)", value: fmt(s.chiffreAffaires), indent: 0, bold: true, color: '#2563eb' },
            { label: 'Production de l\'exercice', value: fmt(s.productionExercice), indent: 1, sub: '70+72+73+74' },
            { label: '− Consommations de l\'exercice', value: fmt(s.consommationExercice), indent: 1, sub: '60+61+62', negative: true },
            { label: '= Valeur Ajoutée (VA)', value: fmt(s.valeurAjoutee), indent: 0, bold: true, highlight: true, pct: fmtPct(tauxVA) + ' du CA' },
            { label: '− Charges de personnel (63)', value: fmt(s.chargesPersonnel), indent: 1, negative: true, sub: `${(tauxPersonnel*100).toFixed(1)}% VA` },
            { label: '− Impôts & taxes (64)', value: fmt(s.impotsTaxes), indent: 1, negative: true },
            { label: '= EBE', value: fmt(s.ebe), indent: 0, bold: true, highlight: true, pct: fmtPct(margeEBE) + ' du CA' },
            { label: 'Autres produits opérationnels (75)', value: fmt(s.autresProduitsOp), indent: 1 },
            { label: '− Autres charges opérationnelles (65)', value: fmt(s.autresChargesOp), indent: 1, negative: true },
            { label: '− Dotations amort. & provisions (68)', value: fmt(s.dotationsExploitation), indent: 1, negative: true },
            { label: '+ Reprises sur provisions (78)', value: fmt(s.reprisesExploitation), indent: 1 },
            { label: '= Résultat d\'exploitation', value: fmt(s.resultatExploitation), indent: 0, bold: true, highlight: true, pct: fmtPct(margeExploit) + ' du CA' },
            { label: 'Produits financiers (76)', value: fmt(s.produitsFinanciers), indent: 1 },
            { label: '− Charges financières (66)', value: fmt(s.chargesFinancieres), indent: 1, negative: true },
            { label: '= Résultat Financier', value: fmt(s.resultatFinancier), indent: 0, bold: true },
            { label: '= RCAI', value: fmt(s.rcai), indent: 0, bold: true },
            { label: '− Impôts sur bénéfices (695/692)', value: fmt(s.impotsBenefices), indent: 1, negative: true },
            { label: '= Résultat Net de l\'exercice', value: fmt(s.resultatNet), indent: 0, bold: true, highlight: true, pct: fmtPct(margeNette) + ' du CA', bigColor: (s.resultatNet||0) >= 0 ? '#059669' : '#dc2626' },
          ].map(({ label, value, indent, bold, highlight, pct, negative, sub, color, bigColor }, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: highlight ? '10px 12px' : '7px 12px',
              paddingLeft: (indent * 20) + 12,
              background: highlight ? 'var(--surface-alt)' : 'transparent',
              borderRadius: highlight ? 8 : 0,
              fontWeight: bold ? 700 : 400,
              borderBottom: '1px solid #f8fafc'
            }}>
              <span style={{ fontSize: '0.82rem', color: color || 'var(--text)' }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {sub && <span style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>{sub}</span>}
                {pct && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary-dk)', background: 'var(--primary-lt)', padding: '2px 8px', borderRadius: 6 }}>{pct}</span>}
                <span className="mono" style={{ fontSize: bold ? '0.92rem' : '0.82rem', fontWeight: bold ? 800 : 500, color: bigColor || (negative ? '#dc2626' : 'var(--text)') }}>
                  {value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Section 3 : Ratios Financiers ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: 20 }}>query_stats</span>
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem' }}>3. Ratios Financiers &amp; Délais d'Exploitation</h3>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Délais &amp; Cycles d'Exploitation</div>
            <KpiRow label="DSO — Délai Recouvrement Clients" value={fmtDays(dso)} sub={r.tauxRotationCreances ? `${r.tauxRotationCreances.toFixed(1)}x/an` : ''} ok={dso <= 60} />
            <KpiRow label="DPO — Délai Paiement Fournisseurs" value={fmtDays(dpo)} sub={fmt(r.dettesFournisseurs)} ok={dpo >= 30 && dpo <= 90} />
            <KpiRow label="Rotation des Stocks" value={fmtDays(rotStock)} sub={r.tauxRotationStocks ? `${r.tauxRotationStocks.toFixed(1)}x/an` : ''} ok={rotStock <= 90} />
            <KpiRow label="BFR en jours de CA" value={fmtDays(bfrJCA)} sub="j CA" ok={bfrJCA <= 60} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Structure &amp; Rentabilité</div>
            <KpiRow label="Liquidité Générale" value={fmtRatio(liqGen)} sub="Norme ≥ 1.2x" ok={liqGen >= 1.2} />
            <KpiRow label="Autonomie Financière" value={fmtPct(autFinanc)} sub="Norme ≥ 30%" ok={autFinanc >= 0.3} />
            <KpiRow label="Marge EBE" value={fmtPct(margeEBE)} sub="Norme ≥ 10%" ok={margeEBE >= 0.1} />
            <KpiRow label="Marge Nette" value={fmtPct(margeNette)} sub="Norme > 0%" ok={margeNette > 0} />
          </div>
        </div>
      </div>

      {/* ── Section 4 : FORCES ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 18 }}>thumb_up</span>
          </div>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#166534' }}>Forces &amp; Atouts Financiers</h3>
            <span style={{ fontSize: '0.72rem', color: '#059669' }}>{nbForces} point{nbForces > 1 ? 's' : ''} fort{nbForces > 1 ? 's' : ''} identifié{nbForces > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {analyse.filter(a => a.type === 'force').map((item, i) => {
            const ts = typeStyle[item.type];
            return (
              <div key={i} style={{ background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', borderLeft: `4px solid ${ts.color}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ts.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span className="material-symbols-outlined" style={{ color: ts.color, fontSize: 18 }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: ts.color }}>{item.titre}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${ts.color}20`, color: ts.color, padding: '2px 8px', borderRadius: 20 }}>{item.cat}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.55 }}>{item.detail}</p>
                </div>
              </div>
            );
          })}
          {nbForces === 0 && <div style={{ padding: 16, background: '#f8fafc', borderRadius: 10, color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Aucune force identifiée — analyse approfondie recommandée.</div>}
        </div>
      </div>

      {/* ── Section 5 : NEUTRES ── */}
      {nbNeutre > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#d97706', fontSize: 18 }}>info</span>
            </div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#92400e' }}>Points à Surveiller</h3>
              <span style={{ fontSize: '0.72rem', color: '#d97706' }}>{nbNeutre} point{nbNeutre > 1 ? 's' : ''} à surveiller</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analyse.filter(a => a.type === 'neutre').map((item, i) => {
              const ts = typeStyle[item.type];
              return (
                <div key={i} style={{ background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', borderLeft: `4px solid ${ts.color}` }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ts.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <span className="material-symbols-outlined" style={{ color: ts.color, fontSize: 18 }}>{item.icon}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: ts.color }}>{item.titre}</span>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${ts.color}20`, color: ts.color, padding: '2px 8px', borderRadius: 20 }}>{item.cat}</span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.55 }}>{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 6 : FAIBLESSES ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff1f2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 18 }}>thumb_down</span>
          </div>
          <div>
            <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#be123c' }}>Faiblesses &amp; Points de Vigilance</h3>
            <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{nbFaiblesses} risque{nbFaiblesses > 1 ? 's' : ''} identifié{nbFaiblesses > 1 ? 's' : ''}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {analyse.filter(a => a.type === 'faiblesse').map((item, i) => {
            const ts = typeStyle[item.type];
            return (
              <div key={i} style={{ background: ts.bg, border: `1px solid ${ts.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', borderLeft: `4px solid ${ts.color}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${ts.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <span className="material-symbols-outlined" style={{ color: ts.color, fontSize: 18 }}>{item.icon}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: ts.color }}>{item.titre}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${ts.color}20`, color: ts.color, padding: '2px 8px', borderRadius: 20 }}>{item.cat}</span>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#be123c', lineHeight: 1.55 }}>{item.detail}</p>
                </div>
              </div>
            );
          })}
          {nbFaiblesses === 0 && <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 10, color: '#059669', fontSize: '0.85rem', textAlign: 'center', border: '1px solid #86efac' }}>✅ Aucune faiblesse majeure détectée — situation financière saine.</div>}
        </div>
      </div>

      {/* ── Section 7 : Recommandations ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: 20 }}>lightbulb</span>
          <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e40af' }}>7. Recommandations &amp; Plan d'Action</h3>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            ...(dso > 60 ? [{ icon: 'payments', color: '#dc2626', action: 'Réduire le DSO (créances clients)', detail: `DSO actuel de ${fmtDays(dso)}. Mettre en place un système de relance automatique, proposer des escomptes pour paiement anticipé, réviser les conditions de crédit accordées aux clients.` }] : []),
            ...(dpo < 30 && dpo > 0 ? [{ icon: 'receipt_long', color: '#d97706', action: 'Négocier des délais fournisseurs plus longs', detail: `DPO de ${fmtDays(dpo)} seulement. Renégocier les conditions de paiement (30-60j) pour améliorer le BFR et la trésorerie disponible.` }] : []),
            ...(rotStock > 90 ? [{ icon: 'warehouse', color: '#d97706', action: 'Optimiser la gestion des stocks', detail: `Rotation de ${fmtDays(rotStock)}. Adopter une méthode JIT (Just-in-Time) ou ABC pour réduire les niveaux de stock et libérer de la trésorerie.` }] : []),
            ...((b.tn || 0) < 0 ? [{ icon: 'account_balance_wallet', color: '#dc2626', action: 'Améliorer la trésorerie nette', detail: 'Trésorerie négative. Envisager une augmentation de capital, un crédit à moyen terme pour financer le BFR, ou la cession d\'actifs non stratégiques.' }] : []),
            ...(margeNette < 0 ? [{ icon: 'trending_down', color: '#dc2626', action: 'Plan de redressement de la rentabilité', detail: 'Résultat net négatif. Analyser poste par poste les charges pour identifier les surcoûts. Revoir la politique tarifaire et la mix produit/service.' }] : []),
            ...(autFinanc < 0.3 ? [{ icon: 'shield', color: '#d97706', action: 'Renforcer les fonds propres', detail: `Autonomie de ${fmtPct(autFinanc)}. Envisager une augmentation de capital, la mise en réserve des bénéfices futurs ou le remboursement progressif des dettes financières.` }] : []),
            ...(bfrJCA > 60 ? [{ icon: 'loop', color: '#d97706', action: 'Réduire le Besoin en Fonds de Roulement', detail: `BFR de ${fmtDays(bfrJCA)} de CA. Agir simultanément sur les 3 leviers : accélérer les encaissements clients, rallonger les délais fournisseurs, réduire les stocks.` }] : []),
            { icon: 'bar_chart', color: '#2563eb', action: 'Mettre en place un tableau de bord mensuel', detail: 'Suivre mensuellement les 8 indicateurs clés : CA, EBE, trésorerie, DSO, DPO, stock, BFR et résultat net. Toute dérive > 10% doit déclencher une action corrective.' },
          ].map(({ icon, color, action, detail }, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '12px 16px', background: `${color}08`, borderRadius: 10, border: `1px solid ${color}25` }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ color, fontSize: 17 }}>{icon}</span>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-sub)', marginRight: 6 }}>{i + 1}.</span>{action}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pied de rapport ── */}
      <div style={{ padding: '14px 20px', background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>📋 Rapport généré par <strong>FINANALYZE</strong> — Référentiel SCF Algérie (Système Comptable Financier)</span>
        <span className="mono" style={{ color: 'var(--text-sub)' }}>{new Date().toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
      </div>

    </div>
  );
}
