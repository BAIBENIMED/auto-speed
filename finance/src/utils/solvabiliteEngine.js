/* ═══════════════════════════════════════════════════════════
   BAIQ — Moteur de Solvabilité, Rating & Score de Risque
   Modèle Altman Z''-Score (Marchés émergents / Entreprises non cotées)
   + Analyse de la Capacité d'Endettement & Rating Bancaire (A+ à D)
   ═══════════════════════════════════════════════════════════ */

/**
 * Calcul du Score Altman Z'' adapté aux entreprises privées et marchés émergents (EM-Score)
 * 
 * Formule standard Altman Z'' (1993 / 2002) :
 * Z'' = 6.56*X1 + 3.26*X2 + 6.72*X3 + 1.05*X4
 * 
 * X1 = Fonds de Roulement (FRNG) / Total Bilan
 * X2 = Réserves & Bénéfices non distribués (Capitaux Propres hors Capital) / Total Bilan
 * X3 = Résultat d'Exploitation (EBIT) / Total Bilan
 * X4 = Valeur Comptable des Capitaux Propres / Total Dettes (Passif Circulant + Dettes LT)
 */
export function calculateAltmanZScore(bilan = {}, sig = {}, rows = []) {
  const totalBilan = (bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0) || 1;
  const frng = bilan.frng || 0;
  const ebit = sig.resultatExploitation || (sig.ebe || 0) - (sig.dotationsExploitation || sig.c68_expl || 0);
  const ebe  = sig.ebe || 0;
  const resultatNet = sig.resultatNet || 0;

  // Calcul des composantes des Capitaux Propres & Dettes
  let capital = 0;
  let reservesAndRetained = 0;
  let capitauxPropres = 0;
  let dettesFinancieresLT = 0;
  let dettesCourtTerme = (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0);

  if (rows && Array.isArray(rows)) {
    rows.forEach(r => {
      if (r.ignore || !r.compte) return;
      const c = r.compte.toString().trim();
      const solde = r.solde || 0; // créditeur = négatif en base

      // Compte 10x : Capital
      if (c.startsWith('10')) {
        capital += -solde;
      }
      // Comptes 11, 12, 13, 14, 15 : Réserves, Report à nouveau, Résultat de l'exercice
      else if (c.startsWith('11') || c.startsWith('12') || c.startsWith('13') || c.startsWith('14') || c.startsWith('15')) {
        reservesAndRetained += -solde;
      }
      // Compte 16 : Emprunts et dettes financières à long terme
      else if (c.startsWith('16')) {
        dettesFinancieresLT += -solde;
      }
    });
  }

  // Fallback si la balance détaillée n'est pas décomposée
  if (capital === 0 && reservesAndRetained === 0) {
    capitauxPropres = Math.max(0, (bilan.ressourcesStables || 0) * 0.7);
    reservesAndRetained = Math.max(0, capitauxPropres * 0.4);
    capital = capitauxPropres - reservesAndRetained;
  } else {
    capitauxPropres = capital + reservesAndRetained;
  }

  const totalDettes = Math.max(1, dettesCourtTerme + dettesFinancieresLT);

  // Ratios Altman
  const x1 = frng / totalBilan;
  const x2 = reservesAndRetained / totalBilan;
  const x3 = ebit / totalBilan;
  const x4 = capitauxPropres / totalDettes;

  const zScore = (6.56 * x1) + (3.26 * x2) + (6.72 * x3) + (1.05 * x4);

  // Interprétation Altman Z''
  let zone = 'safe'; // 'safe', 'grey', 'distress'
  let zoneLabel = 'Zone Saine (Solvabilité Élevée)';
  let zoneColor = '#059669';
  let zoneBg = '#f0fdf4';
  let zoneBorder = '#86efac';
  let risqueDefaillance = 'Très faible (< 5%)';
  let rating = 'A+';

  if (zScore >= 2.90) {
    rating = 'A+';
    zone = 'safe';
    zoneLabel = 'Zone Saine — Excellente Solvabilité';
    zoneColor = '#059669';
    zoneBg = '#f0fdf4';
    zoneBorder = '#86efac';
    risqueDefaillance = 'Négligeable (< 2%)';
  } else if (zScore >= 2.60) {
    rating = 'A';
    zone = 'safe';
    zoneLabel = 'Zone Saine — Bonne Assise Financière';
    zoneColor = '#2563eb';
    zoneBg = '#eff6ff';
    zoneBorder = '#bfdbfe';
    risqueDefaillance = 'Faible (< 5%)';
  } else if (zScore >= 1.80) {
    rating = 'B+';
    zone = 'grey';
    zoneLabel = 'Zone de Vigilance — Structure Modérée';
    zoneColor = '#d97706';
    zoneBg = '#fffbeb';
    zoneBorder = '#fde68a';
    risqueDefaillance = 'Modéré (10% - 20%)';
  } else if (zScore >= 1.10) {
    rating = 'B';
    zone = 'grey';
    zoneLabel = 'Zone Grise — Vulnérabilité Financière';
    zoneColor = '#ea580c';
    zoneBg = '#fff7ed';
    zoneBorder = '#fed7aa';
    risqueDefaillance = 'Sensible (20% - 35%)';
  } else if (zScore >= 0) {
    rating = 'C';
    zone = 'distress';
    zoneLabel = 'Zone de Détresse — Risque de Défaillance Élevé';
    zoneColor = '#dc2626';
    zoneBg = '#fef2f2';
    zoneBorder = '#fca5a5';
    risqueDefaillance = 'Élevé (> 50%)';
  } else {
    rating = 'D';
    zone = 'distress';
    zoneLabel = 'Zone Critique — Insolvabilité Avérée';
    zoneColor = '#991b1b';
    zoneBg = '#450a0a';
    zoneBorder = '#7f1d1d';
    risqueDefaillance = 'Critique (> 80%)';
  }

  // Capacité de Remboursement Bancaire (Dettes Nettes / EBE)
  const dettesNettes = Math.max(0, (dettesFinancieresLT + dettesCourtTerme) - (bilan.tresorerieActive || 0));
  const ratioDetteSurEBE = ebe > 0 ? dettesNettes / ebe : (dettesNettes === 0 ? 0 : 99);
  
  // Capacité d'endettement théorique supplémentaire (Règle bancaire : Dettes LT ≤ 3.5 × EBE)
  const capaciteEndettementMax = Math.max(0, (ebe * 3.5) - dettesFinancieresLT);

  // Couverture des charges financières
  const chargesFin = sig.chargesFinancieres || 0;
  const couvertureChargesFin = chargesFin > 0 ? Math.max(0, ebe / chargesFin) : 99;

  // Score global de solvabilité sur 100
  const scoreSolvabilite = Math.max(0, Math.min(100, Math.round(
    (zScore >= 2.6 ? 85 + Math.min(15, (zScore - 2.6) * 10) :
     zScore >= 1.1 ? 50 + ((zScore - 1.1) / 1.5) * 35 :
     Math.max(0, (zScore / 1.1) * 50))
  )));

  return {
    zScore,
    scoreSolvabilite,
    rating,
    zone,
    zoneLabel,
    zoneColor,
    zoneBg,
    zoneBorder,
    risqueDefaillance,
    ratios: {
      x1: { val: x1, label: 'FRNG / Total Bilan', desc: 'Liquidité nette structurelle', poids: '6.56' },
      x2: { val: x2, label: 'Réserves & RN / Total Bilan', desc: 'Capacité d\'autofinancement cumulée', poids: '3.26' },
      x3: { val: x3, label: 'R. Exploitation (EBIT) / Bilan', desc: 'Rendement opérationnel des actifs', poids: '6.72' },
      x4: { val: x4, label: 'Capitaux Propres / Dettes', desc: 'Couverture par les fonds propres', poids: '1.05' },
    },
    bancaire: {
      dettesNettes,
      ratioDetteSurEBE,
      dettesFinancieresLT,
      capitauxPropres,
      capaciteEndettementMax,
      couvertureChargesFin,
      statutCredit: ratioDetteSurEBE <= 3.5 && zScore >= 1.8 ? 'FAVORABLE' : ratioDetteSurEBE <= 5 ? 'VIGILANCE' : 'DÉFAVORABLE'
    }
  };
}
