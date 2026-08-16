/* ═══════════════════════════════════════════════════════════
   BAIQ — Moteur d'Analyse IA Local (Hors-ligne)
   Analyse intelligente basée sur les normes SCF Algérie et Sectorielles
   ═══════════════════════════════════════════════════════════ */

import { getSecteur, scorerIndicateur } from './secteurs';
import { calculateAltmanZScore } from './solvabiliteEngine';

const safe = (a, b) => (b && b !== 0 && isFinite(a / b) ? a / b : 0);
const pct  = (v, d = 1) => `${(v * 100).toFixed(d)} %`;
const days = (v) => `${Math.round(v || 0)} jours`;

/* ─── Moteur d'analyse ─────────────────────────────────────── */
export function runAIAnalysis(data) {
  if (!data) return null;

  const { bilan: b = {}, sig: s = {}, ratios: r = {}, rows = [], profil = {}, dataN1 = null } = data;
  const secteur = getSecteur(profil.secteurId);
  const bm = secteur.benchmarks;
  const solv = calculateAltmanZScore(b, s, rows);

  // ── Métriques dérivées ──
  const ca       = s.chiffreAffaires || 0;
  const va       = s.valeurAjoutee   || 0;
  const ebe      = s.ebe             || 0;
  const reop     = s.resultatExploitation || 0;
  const rnet     = s.resultatNet     || 0;
  const cpers    = s.chargesPersonnel || 0;
  const dotam    = s.dotationsExploitation || s.c68_expl || 0;
  const cchfin   = s.chargesFinancieres || 0;
  const impots   = s.impotsBenefices || 0;

  const margeEBE        = safe(ebe, ca);
  const margeOper       = safe(reop, ca);
  const margeNette      = safe(rnet, ca);
  const tauxVA          = safe(va, ca);
  const productivite    = safe(va, cpers);
  const poidsPersonnel  = safe(cpers, va);
  const couvertureFin   = cchfin > 0 ? safe(ebe, cchfin) : 99;
  const cafBrute        = ebe - cchfin - impots + dotam;

  const liq    = r.liquiditeGenerale    || 0;
  const autFin = r.autonomieFinanciere  || 0;
  const dso    = r.delaiRecouvrement    || 0;
  const dpo    = r.delaiFournisseurs    || 0;
  const rotS   = r.rotationStocks       || 0;
  const bfrJCA = r.bfrJoursCA           || 0;
  const frng   = b.frng || 0;
  const bfr    = b.bfr  || 0;
  const tn     = b.tn   || 0;

  // ── Ratios spécifiques avec profil ──
  const effectif = Number(profil.effectif) || 0;
  const caParSalarie = effectif > 0 ? safe(ca, effectif) : null;
  const vaParSalarie = effectif > 0 ? safe(va, effectif) : null;

  // ── Comparatif N-1 ──
  let evolutions = null;
  if (dataN1) {
    const caN1   = dataN1.sig?.chiffreAffaires || 0;
    const rnetN1 = dataN1.sig?.resultatNet || 0;
    const ebeN1  = dataN1.sig?.ebe || 0;
    const frngN1 = dataN1.bilan?.frng || 0;
    const bfrN1  = dataN1.bilan?.bfr || 0;

    evolutions = {
      caGrowth: caN1 > 0 ? (ca - caN1) / caN1 : null,
      rnetGrowth: rnetN1 !== 0 ? (rnet - rnetN1) / Math.abs(rnetN1) : null,
      ebeGrowth: ebeN1 !== 0 ? (ebe - ebeN1) / Math.abs(ebeN1) : null,
      frngDelta: frng - frngN1,
      bfrDelta: bfr - bfrN1,
    };
  }

  // ── Scoring sectoriel par catégorie (0-100) ──
  const scoreRentabilite = Math.max(0, Math.min(100,
    scorerIndicateur(margeNette, bm.margeNette) * 0.4 +
    scorerIndicateur(margeEBE, bm.margeEBE) * 0.3 +
    scorerIndicateur(margeOper, bm.margeEBE) * 0.3
  ));

  const scoreLiquidite = Math.max(0, Math.min(100,
    scorerIndicateur(liq, bm.liquiditeGenerale) * 0.5 +
    (tn >= 0 ? 80 : 20) * 0.3 +
    (frng >= 0 ? 80 : 20) * 0.2
  ));

  const scoreStructure = Math.max(0, Math.min(100,
    scorerIndicateur(autFin, bm.autonomieFinanciere) * 0.6 +
    scorerIndicateur(couvertureFin, bm.couvertureFin) * 0.4
  ));

  const scoreActivite = Math.max(0, Math.min(100,
    scorerIndicateur(dso, bm.dso, true) * 0.3 +
    scorerIndicateur(dpo, { critique: bm.dpo.max + 30, faible: bm.dpo.max, bon: bm.dpo.bon, excellent: bm.dpo.min }, false) * 0.25 +
    (secteur.id === 'services' || rotS === 0 ? 80 : scorerIndicateur(rotS, bm.rotationStocks, true)) * 0.25 +
    scorerIndicateur(bfrJCA, bm.bfrJoursCA, true) * 0.2
  ));

  const scoreProductivite = Math.max(0, Math.min(100,
    scorerIndicateur(tauxVA, bm.tauxVA) * 0.4 +
    scorerIndicateur(productivite, bm.productivite) * 0.35 +
    (poidsPersonnel <= 0.50 ? 100 : poidsPersonnel <= 0.65 ? 70 : poidsPersonnel <= 0.80 ? 40 : 15) * 0.25
  ));

  const scores = {
    rentabilite: scoreRentabilite,
    liquidite: scoreLiquidite,
    structure: scoreStructure,
    activite: scoreActivite,
    productivite: scoreProductivite,
  };

  const scoreGlobal = Math.round(
    scores.rentabilite  * 0.30 +
    scores.liquidite    * 0.25 +
    scores.structure    * 0.20 +
    scores.activite     * 0.15 +
    scores.productivite * 0.10
  );

  const niveau =
    scoreGlobal >= 75 ? { label: 'Excellente', color: '#059669', emoji: '🟢' } :
    scoreGlobal >= 55 ? { label: 'Bonne',      color: '#2563eb', emoji: '🔵' } :
    scoreGlobal >= 40 ? { label: 'Mitigée',    color: '#d97706', emoji: '🟡' } :
    scoreGlobal >= 25 ? { label: 'Préoccupante',color: '#f97316',emoji: '🟠' } :
                        { label: 'Critique',   color: '#dc2626', emoji: '🔴' };

  // ── Forces ──
  const forces = [];
  if (rnet > 0 && margeNette >= bm.margeNette.bon)
    forces.push({ titre: `Rentabilité nette solide (${pct(margeNette)})`, detail: `Supérieure au benchmark sectoriel (${bm.margeNette.norme}).`, cat: 'Rentabilité', score: 90 });
  else if (rnet > 0)
    forces.push({ titre: `Résultat net positif (${pct(margeNette)})`, detail: `Bénéficiaire (norme secteur: ${bm.margeNette.norme}).`, cat: 'Rentabilité', score: 60 });

  if (ebe > 0 && margeEBE >= bm.margeEBE.bon)
    forces.push({ titre: `EBE performant (${pct(margeEBE)} du CA)`, detail: `Supérieur au benchmark (${bm.margeEBE.norme}).`, cat: 'EBE', score: 85 });

  if (frng > 0)
    forces.push({ titre: 'Équilibre long terme assuré (FRNG positif)', detail: `Les investissements sont financés par des ressources stables.`, cat: 'Équilibre financier', score: 80 });

  if (liq >= bm.liquiditeGenerale.bon)
    forces.push({ titre: `Liquidité générale solide (${liq.toFixed(2)}x)`, detail: `Au-dessus de la norme sectorielle (${bm.liquiditeGenerale.norme}).`, cat: 'Liquidité', score: 88 });

  if (autFin >= bm.autonomieFinanciere.bon)
    forces.push({ titre: `Autonomie financière confortable (${pct(autFin)})`, detail: `Supérieure à la norme du secteur (${bm.autonomieFinanciere.norme}).`, cat: 'Structure', score: 90 });

  if (dso > 0 && dso <= bm.dso.bon)
    forces.push({ titre: `Recouvrement clients rapide (${days(dso)})`, detail: `Conforme à la norme (${bm.dso.norme}).`, cat: 'Créances', score: 90 });

  if (rotS > 0 && rotS <= bm.rotationStocks.bon)
    forces.push({ titre: `Rotation des stocks optimisée (${days(rotS)})`, detail: `Bien gérée pour le secteur (${bm.rotationStocks.norme}).`, cat: 'Stocks', score: 80 });

  if (tauxVA >= bm.tauxVA.bon)
    forces.push({ titre: `Valeur ajoutée élevée (${pct(tauxVA)} du CA)`, detail: `Supérieure à la moyenne sectorielle (${bm.tauxVA.norme}).`, cat: 'Création de valeur', score: 85 });

  if (tn > 0)
    forces.push({ titre: 'Trésorerie nette positive', detail: `Aucun recours aux crédits de trésorerie.`, cat: 'Trésorerie', score: 78 });

  if (evolutions?.caGrowth > 0.05)
    forces.push({ titre: `Croissance du CA dynamique (+${pct(evolutions.caGrowth)})`, detail: `Forte progression par rapport à N-1.`, cat: 'Croissance', score: 92 });

  // ── Faiblesses ──
  const faiblesses = [];
  if (rnet <= 0)
    faiblesses.push({ titre: 'Résultat net déficitaire', detail: `L'exercice se solde par une perte.`, cat: 'Rentabilité', severite: 'critique' });
  else if (margeNette < bm.margeNette.faible)
    faiblesses.push({ titre: `Marge nette inférieure à la norme sectorielle (${pct(margeNette)})`, detail: `Norme secteur : ${bm.margeNette.norme}.`, cat: 'Rentabilité', severite: 'eleve' });

  if (ebe <= 0)
    faiblesses.push({ titre: "EBE négatif — activité non rentable", detail: `L'activité opérationnelle détruit de la valeur.`, cat: 'EBE', severite: 'critique' });
  else if (margeEBE < bm.margeEBE.faible)
    faiblesses.push({ titre: `Marge EBE faible pour le secteur (${pct(margeEBE)})`, detail: `Norme secteur : ${bm.margeEBE.norme}.`, cat: 'EBE', severite: 'eleve' });

  if (frng < 0)
    faiblesses.push({ titre: 'FRNG négatif — déséquilibre structurel', detail: `Emplois stables financés par des dettes court terme.`, cat: 'Équilibre financier', severite: 'critique' });

  if (liq < bm.liquiditeGenerale.critique)
    faiblesses.push({ titre: `Risque de liquidité court terme (${liq.toFixed(2)}x)`, detail: `Inférieur au seuil critique sectoriel (${bm.liquiditeGenerale.norme}).`, cat: 'Liquidité', severite: 'critique' });

  if (autFin < bm.autonomieFinanciere.critique)
    faiblesses.push({ titre: `Autonomie financière faible (${pct(autFin)})`, detail: `Dépendance excessive envers les créanciers (norme: ${bm.autonomieFinanciere.norme}).`, cat: 'Structure', severite: 'critique' });

  if (dso > bm.dso.limite)
    faiblesses.push({ titre: `DSO supérieur aux standards du secteur (${days(dso)})`, detail: `Norme secteur : ${bm.dso.norme}.`, cat: 'Créances clients', severite: 'eleve' });

  if (rotS > bm.rotationStocks.limite && secteur.id !== 'services')
    faiblesses.push({ titre: `Rotation des stocks lente pour le secteur (${days(rotS)})`, detail: `Norme secteur : ${bm.rotationStocks.norme}.`, cat: 'Stocks', severite: 'eleve' });

  if (bfrJCA > bm.bfrJoursCA.limite)
    faiblesses.push({ titre: `BFR excessif en jours de CA (${days(bfrJCA)})`, detail: `Norme secteur : ${bm.bfrJoursCA.norme}.`, cat: 'BFR', severite: 'eleve' });

  if (evolutions?.caGrowth < -0.05)
    faiblesses.push({ titre: `Recul du Chiffre d'Affaires (${pct(evolutions.caGrowth)})`, detail: `Baisse d'activité par rapport à l'exercice précédent.`, cat: 'Activité', severite: 'eleve' });

  // ── Recommandations Stratégiques, Opérationnelles & Fiscales ──
  const recommandations = [];
  const fmt = (v) => (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DA';

  // 1. Recouvrement Clients (DSO)
  if (dso > bm.dso.bon) {
    const gainDSO = Math.max(0, (dso - bm.dso.bon) * (ca / 360));
    recommandations.push({
      priorite: 1,
      categorie: 'Trésorerie & BFR',
      action: `Réduire le délai de paiement clients vers l'objectif de ${bm.dso.bon} jours`,
      detail: `Le DSO actuel est de ${days(dso)} contre une norme de ${bm.dso.norme}. Ramener ce délai à ${bm.dso.bon}j libérerait environ ${fmt(gainDSO)} de trésorerie immédiate.`,
      etapes: [
        'Automatiser les relances avant et à échéance de facturation (Comptes 411)',
        'Instaurer un escompte commercial pour paiement anticipé (ex: 1% sous 10j)',
        'Exiger des acomptes à la commande (30% à la validation du bon de commande)',
        'Appliquer le paiement électronique ou par virement bancaire systématique'
      ],
      gainEstime: fmt(gainDSO),
      impact: 'Trésorerie active',
      urgence: dso > bm.dso.limite ? 'critique' : 'haute'
    });
  }

  // 2. Gestion des Stocks & Délais d'écoulement
  if (rotS > bm.rotationStocks.bon && secteur.id !== 'services') {
    const gainStock = Math.max(0, (rotS - bm.rotationStocks.bon) * ((s.achats || s.c60 || 0) / 360));
    recommandations.push({
      priorite: 2,
      categorie: 'Exploitation & Stocks',
      action: `Optimiser la rotation des stocks pour atteindre ${bm.rotationStocks.bon} jours`,
      detail: `Votre stock tourne en ${days(rotS)} (norme sectorielle : ${bm.rotationStocks.norme}). Une réduction des stocks dormants permettrait de débloquer environ ${fmt(gainStock)} de liquidités.`,
      etapes: [
        'Mettre en place une analyse ABC / Pareto sur les références de stocks (Comptes 30/31)',
        'Liquider ou déstocker les articles à faible rotation / obsolètes',
        'Passer au réapprovisionnement en flux tendus (Juste-à-Temps) avec les fournisseurs clés',
        'Réévaluer les seuils de stock de sécurité pour éviter le sur-stockage'
      ],
      gainEstime: fmt(gainStock),
      impact: 'BFR & Coûts de stockage',
      urgence: rotS > bm.rotationStocks.limite ? 'haute' : 'moyenne'
    });
  }

  // 3. Délais Fournisseurs (DPO)
  if (dpo < bm.dpo.min && dpo > 0) {
    const gainDPO = Math.max(0, (bm.dpo.bon - dpo) * ((s.consommationExercice || s.achats || 0) / 360));
    recommandations.push({
      priorite: 3,
      categorie: 'Achats & Négociation',
      action: `Allonger les délais de règlement fournisseurs à ${bm.dpo.bon} jours`,
      detail: `Vous réglez vos fournisseurs en ${days(dpo)}, ce qui est inférieur au standard (${bm.dpo.norme}). Augmenter le délai de paiement renforcerait le financement passif du BFR de ${fmt(gainDPO)}.`,
      etapes: [
        'Renégocier les conditions générales de vente avec les 20% de fournisseurs majeurs',
        'Harmoniser les échéances de paiement à 45-60 jours fin de mois',
        'Privilégier les effets de commerce (traites/billets à ordre) pour les achats stratégiques',
        'Consolider les volumes auprès de fournisseurs privilégiés pour obtenir de meilleurs termes'
      ],
      gainEstime: fmt(gainDPO),
      impact: 'Financement du BFR',
      urgence: 'moyenne'
    });
  }

  // 4. Équilibre du Bilan & FRNG
  if (frng < 0) {
    recommandations.push({
      priorite: 1,
      categorie: 'Structure & Solvabilité',
      action: 'Rétablir l\'équilibre structurel du Bilan (FRNG négatif)',
      detail: `Le Fonds de Roulement est négatif (${fmt(frng)}), ce qui signifie que des immobilisations à long terme sont financées par des dettes court terme, créant un risque de liquidité élevé.`,
      etapes: [
        'Consolider les fonds propres par incorporation des réserves et bénéfices (Comptes 11/12)',
        'Restructurer la dette CT en dette à moyen/long terme (Crédit d\'investissement - Compte 16)',
        'Envisager une augmentation de capital en numéraire ou par apport d\'associés',
        'Céder les actifs immobilisés non productifs ou hors exploitation'
      ],
      gainEstime: 'Sécurisation financière',
      impact: 'Solvabilité & Rating',
      urgence: 'critique'
    });
  } else if (autFin < bm.autonomieFinanciere.faible) {
    recommandations.push({
      priorite: 2,
      categorie: 'Structure Financière',
      action: `Renforcer l'autonomie financière vers ${pct(bm.autonomieFinanciere.bon)}`,
      detail: `L'autonomie financière est de ${pct(autFin)} (norme sectorielle : ${bm.autonomieFinanciere.norme}). L'entreprise est fortement dépendante des tiers et créanciers.`,
      etapes: [
        'Limiter la distribution de dividendes pour affecter le résultat net en réserves statutaires',
        'Convertir des comptes courants d\'associés (Compte 455) en capital social',
        'Négocier des financements participatifs ou institutionnels (dispositifs AAPI / ASF)'
      ],
      gainEstime: 'Baisse du risque bancaire',
      impact: 'Fonds propres',
      urgence: 'haute'
    });
  }

  // 5. Rentabilité & Marges Opérationnelles (EBE / VA)
  if (margeEBE < bm.margeEBE.bon && ebe > 0) {
    recommandations.push({
      priorite: 2,
      categorie: 'Rentabilité & Exploitation',
      action: `Améliorer la marge d'EBE pour atteindre la norme sectorielle de ${bm.margeEBE.norme}`,
      detail: `La marge d'EBE actuelle est de ${pct(margeEBE)} contre un objectif sectoriel de ${bm.margeEBE.norme}. L'optimisation des charges opératoires est requise.`,
      etapes: [
        'Renégocier les tarifs et contrats de services extérieurs (Comptes 61/62 : transport, loyers, maintenance)',
        'Ajuster les prix de vente sur les prestations/produits à forte valeur ajoutée',
        'Contrôler la productivité horaire et le ratio Masse Salariale / Valeur Ajoutée (actuellement à ' + pct(poidsPersonnel) + ')',
        'Éliminer les gaspillages et rebuts dans les consommations de matières (Compte 60)'
      ],
      gainEstime: `+${pct(bm.margeEBE.bon - margeEBE)} de marge`,
      impact: 'Excédent brut',
      urgence: 'haute'
    });
  } else if (ebe <= 0) {
    recommandations.push({
      priorite: 1,
      categorie: 'Rentabilité d\'Urgence',
      action: 'Plan de redressement de la rentabilité brute (EBE déficitaire)',
      detail: `L'activité opérationnelle détruit de la valeur (${fmt(ebe)}). Un plan d'austérité et de restructuration des coûts variables et fixes est impératif.`,
      etapes: [
        'Audit d\'urgence des postes de charges 60, 61, 62 et 63',
        'Recentrage sur les lignes de produits/services rentables et arrêt des activités à perte',
        'Geler les recrutements et réduire les charges de sous-traitance non indispensables'
      ],
      gainEstime: 'Retour à l\'équilibre',
      impact: 'Survie d\'entreprise',
      urgence: 'critique'
    });
  }

  // 6. Optimisation Fiscale & Réglementaire (SCF Algérie)
  recommandations.push({
    priorite: 3,
    categorie: 'Fiscalité & SCF Algérie',
    action: `Optimisation du cadre fiscal sectoriel (${secteur.label})`,
    detail: `Taux d'IBS de référence : ${secteur.tauxIBS}. Profitez des régimes incitatifs et déductions légales applicables à votre branche d'activité.`,
    etapes: [
      'Vérifier l\'éligibilité aux exonérations d\'IBS (AAPI pour investissements neufs, ASF pour startups, Art. 138 pour l\'agriculture)',
      'Déduire rigoureusement les amortissements accélérés/dégressifs autorisés par le CIDTA (Compte 681)',
      'Contrôler la récupération optimale de la TVA déductible (Comptes 4456) à 19% et 9%',
      'Veiller au respect du seuil de paiement par chèque/virement pour la déductibilité fiscale des charges'
    ],
    gainEstime: 'Optimisation impôts (IBS/TVA)',
    impact: 'Résultat net',
    urgence: 'moyenne'
  });

  // Tri des recommandations par priorité (1=Critique, 2=Élevé, 3=Moyen)
  recommandations.sort((a, b) => a.priorite - b.priorite);

  // ── Résumé exécutif ──
  const resume = buildResume({ scoreGlobal, niveau, ca, ebe, rnet, frng, tn, liq, autFin, dso, rotS, bfrJCA, margeNette, margeEBE, secteur, profil, evolutions, nbForces: forces.length, nbFaiblesses: faiblesses.length });

  return {
    scoreGlobal,
    niveau,
    scores,
    secteur,
    profil,
    evolutions,
    solvabilite: solv,
    forces: forces.sort((a, b) => b.score - a.score),
    faiblesses: faiblesses.sort((a, b) => {
      const order = { critique: 0, eleve: 1, moyen: 2, faible: 3 };
      return (order[a.severite] || 2) - (order[b.severite] || 2);
    }),
    recommandations,
    resume,
    metriques: { ca, va, ebe, reop, rnet, cpers, dotam, cchfin, cafBrute, margeEBE, margeOper, margeNette, tauxVA, productivite, couvertureFin, liq, autFin, dso, dpo, rotS, bfrJCA, frng, bfr, tn, caParSalarie, vaParSalarie },
  };
}

function buildResume({ scoreGlobal, niveau, ca, ebe, rnet, dso, rotS, margeNette, margeEBE, secteur, profil, evolutions, nbForces, nbFaiblesses }) {
  const pct_ = (v, d = 1) => `${(v * 100).toFixed(d)} %`;
  const fmt_ = (v) => (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });

  const companyName = profil.nomEntreprise ? `**${profil.nomEntreprise}**` : "l'entreprise";
  const intro = `Diagnostic financier de ${companyName} dans le secteur **${secteur.label}** : situation évaluée ${niveau.emoji} **${niveau.label}** (${scoreGlobal}/100).`;

  const caStr = ca > 0 ? ` Chiffre d'affaires : **${fmt_(ca)} DA**${evolutions?.caGrowth ? ` (${evolutions.caGrowth > 0 ? '+' : ''}${pct_(evolutions.caGrowth)} vs N-1)` : ''}.` : '';
  const ebeStr = ` EBE : **${fmt_(ebe)} DA** (${pct_(margeEBE)} du CA vs norme secteur: ${secteur.benchmarks.margeEBE.norme}).`;
  const rnetStr = ` Résultat net : **${fmt_(rnet)} DA** (${pct_(margeNette)}).`;

  const activiteStr = ` DSO : **${Math.round(dso)}j** (norme: ${secteur.benchmarks.dso.norme}) — Rotation stock : **${Math.round(rotS)}j** (norme: ${secteur.benchmarks.rotationStocks.norme}).`;

  const conclusion = ` Synthèse : **${nbForces} force(s)** et **${nbFaiblesses} faiblesse(s)** identifiée(s) selon le référentiel sectoriel SCF.`;

  return intro + caStr + ebeStr + rnetStr + activiteStr + conclusion;
}

/* ─── Construction du contexte pour Gemini ─── */
export function buildGeminiContext(data, analysisResult) {
  if (!data || !analysisResult) return '';
  const { sig: s = {} } = data;
  const m = analysisResult.metriques;
  const p = analysisResult.profil || {};
  const sec = analysisResult.secteur || {};
  const solv = analysisResult.solvabilite || {};
  const fmt = (v) => (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DA';
  const pct_ = (v) => `${(v * 100).toFixed(1)}%`;

  return `Tu es un expert-comptable et analyste financier spécialisé dans le Système Comptable Financier algérien (SCF, Loi 07-11). Analyse les données financières suivantes en tenant compte du secteur d'activité spécifié.

## PROFIL ET SECTEUR D'ACTIVITÉ
- Entreprise : ${p.nomEntreprise || 'Non spécifié'}
- Forme Juridique : ${p.formeJuridique || 'Non spécifiée'}
- Secteur : ${sec.label || 'Général'}
- Description secteur : ${sec.description || ''}
- Effectif Salarié : ${p.effectif || 'N/D'} ETP
- Wilaya : ${p.wilaya || 'N/D'}

## PERFORMANCES FINANCIÈRES & SOLVABILITÉ
- Score Altman Z'' : ${solv.zScore ? solv.zScore.toFixed(2) : 'N/D'} (Rating: ${solv.rating || 'N/D'} — ${solv.zoneLabel || ''})
- Risque de défaillance : ${solv.risqueDefaillance || 'N/D'}
- CA : ${fmt(s.chiffreAffaires)}
- Valeur Ajoutée : ${fmt(s.valeurAjoutee)} (${pct_(m.tauxVA)} du CA - Norme secteur : ${sec.benchmarks?.tauxVA?.norme})
- EBE : ${fmt(s.ebe)} (${pct_(m.margeEBE)} du CA - Norme secteur : ${sec.benchmarks?.margeEBE?.norme})
- Résultat Net : ${fmt(s.resultatNet)} (${pct_(m.margeNette)} - Norme secteur : ${sec.benchmarks?.margeNette?.norme})
- Liquidité Générale : ${m.liq.toFixed(2)}x (Norme secteur : ${sec.benchmarks?.liquiditeGenerale?.norme})
- Autonomie Financière : ${pct_(m.autFin)} (Norme secteur : ${sec.benchmarks?.autonomieFinanciere?.norme})
- DSO Créances : ${Math.round(m.dso)} jours (Norme secteur : ${sec.benchmarks?.dso?.norme})
- DPO Fournisseurs : ${Math.round(m.dpo)} jours (Norme secteur : ${sec.benchmarks?.dpo?.norme})
- Rotation Stocks : ${Math.round(m.rotS)} jours (Norme secteur : ${sec.benchmarks?.rotationStocks?.norme})
- BFR en jours CA : ${Math.round(m.bfrJCA)} jours (Norme secteur : ${sec.benchmarks?.bfrJoursCA?.norme})

### Score Global Sectoriel : ${analysisResult.scoreGlobal}/100 — Situation ${analysisResult.niveau.label}

### Forces identifiées :
${analysisResult.forces.map(f => `- ${f.titre} [${f.cat}]`).join('\n')}

### Faiblesses identifiées :
${analysisResult.faiblesses.map(f => `- ${f.titre} [${f.cat}] — Sévérité: ${f.severite}`).join('\n')}

---
Référentiel : SCF Algérie (Loi 07-11) + Benchmarks sectoriels Algérie. Devise : DZD.
`;
}
