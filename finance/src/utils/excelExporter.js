/* ═══════════════════════════════════════════════════════════
   FINANALYZE — Générateur d'Export Excel Multi-Feuilles (.xlsx)
   Classeur financier complet structuré selon les normes SCF Algérie
   ═══════════════════════════════════════════════════════════ */

import * as XLSX from 'xlsx';
import { getSecteur } from './secteurs';
import { calculateAltmanZScore } from './solvabiliteEngine';

export function exportFinancialWorkbook(data, filename = 'Analyse_Financiere_SCF.xlsx') {
  if (!data) return false;

  const { bilan = {}, sig = {}, ratios = {}, rows = [], profil = {}, dataN1 = null } = data;
  const secteur = getSecteur(profil.secteurId);
  const bm = secteur.benchmarks;
  const solv = calculateAltmanZScore(bilan, sig, rows);

  const wb = XLSX.utils.book_new();

  /* ──────────────────────────────────────────────────────────
     FEUILLE 1 : SYNTHÈSE & PROFIL D'ENTREPRISE
     ────────────────────────────────────────────────────────── */
  const ws1Data = [
    ['FINANALYZE — RAPPORT DE SYNTHÈSE FINANCIÈRE SCF (ALGÉRIE)'],
    ['Généré le', new Date().toLocaleDateString('fr-FR') + ' à ' + new Date().toLocaleTimeString('fr-FR')],
    [],
    ['1. PROFIL DE L\'ENTREPRISE'],
    ['Raison Sociale / Dossier', profil.nomEntreprise || 'Dossier Anonyme'],
    ['Secteur d\'Activité SCF', secteur.label],
    ['Taux IBS Applicable', secteur.tauxIBS],
    ['Taux TVA Standard', secteur.tvaStandard],
    ['Effectif Salarié (ETP)', profil.effectif ? `${profil.effectif} ETP` : 'Non renseigné'],
    [],
    ['2. ÉVALUATION DE SOLVABILITÉ & RISQUE (ALTMAN Z\'\')'],
    ['Score Altman Z\'\' (Marchés émergents)', solv.zScore.toFixed(2)],
    ['Rating de Crédit', solv.rating],
    ['Zone de Risque', solv.zoneLabel],
    ['Probabilité de Défaillance', solv.risqueDefaillance],
    ['Score de Solvabilité Globale', `${solv.scoreSolvabilite} / 100`],
    ['Statut Accord Crédit Bancaire', solv.bancaire.statutCredit],
    [],
    ['3. GRANDS AGRÉGATS FINANCIERS (DZD)'],
    ['Indicateur', 'Exercice N (DZD)', 'Exercice N-1 (DZD)', 'Variation (DZD)', 'Variation (%)'],
    ['Chiffre d\'Affaires (CA)', sig.chiffreAffaires || 0, dataN1?.sig?.chiffreAffaires || '', (sig.chiffreAffaires || 0) - (dataN1?.sig?.chiffreAffaires || 0), dataN1?.sig?.chiffreAffaires ? `${(((sig.chiffreAffaires || 0) - dataN1.sig.chiffreAffaires) / dataN1.sig.chiffreAffaires * 100).toFixed(1)}%` : ''],
    ['Valeur Ajoutée (VA)', sig.valeurAjoutee || 0, dataN1?.sig?.valeurAjoutee || '', (sig.valeurAjoutee || 0) - (dataN1?.sig?.valeurAjoutee || 0), ''],
    ['Excédent Brut d\'Exploitation (EBE)', sig.ebe || 0, dataN1?.sig?.ebe || '', (sig.ebe || 0) - (dataN1?.sig?.ebe || 0), ''],
    ['Résultat Net de l\'Exercice', sig.resultatNet || 0, dataN1?.sig?.resultatNet || '', (sig.resultatNet || 0) - (dataN1?.sig?.resultatNet || 0), ''],
    ['Fonds de Roulement Net Global (FRNG)', bilan.frng || 0, dataN1?.bilan?.frng || '', (bilan.frng || 0) - (dataN1?.bilan?.frng || 0), ''],
    ['Besoin en Fonds de Roulement (BFR)', bilan.bfr || 0, dataN1?.bilan?.bfr || '', (bilan.bfr || 0) - (dataN1?.bilan?.bfr || 0), ''],
    ['Trésorerie Nette (TN)', bilan.tn || 0, dataN1?.bilan?.tn || '', (bilan.tn || 0) - (dataN1?.bilan?.tn || 0), ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
  ws1['!cols'] = [{ wch: 35 }, { wch: 25 }, { wch: 22 }, { wch: 20 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Synthèse & Solvabilité');

  /* ──────────────────────────────────────────────────────────
     FEUILLE 2 : BILAN FONCTIONNEL
     ────────────────────────────────────────────────────────── */
  const ws2Data = [
    ['BILAN FONCTIONNEL CONDENSÉ (SCF ALGÉRIE)'],
    ['Devise : Dinars Algériens (DZD)'],
    [],
    ['I. ACTIF (EMPLOIS)', 'Exercice N (DZD)', 'Exercice N-1 (DZD)', 'Part Actif N (%)'],
    ['Emplois Stables (Immobilisations Brutes)', bilan.emploisStables || 0, dataN1?.bilan?.emploisStables || '', `${(((bilan.emploisStables || 0) / ((bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0) || 1)) * 100).toFixed(1)}%`],
    ['Actif Circulant (Stocks + Créances clients)', bilan.actifCirculant || 0, dataN1?.bilan?.actifCirculant || '', `${(((bilan.actifCirculant || 0) / ((bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0) || 1)) * 100).toFixed(1)}%`],
    ['Trésorerie Active (Disponibilités & Banque)', bilan.tresorerieActive || 0, dataN1?.bilan?.tresorerieActive || '', `${(((bilan.tresorerieActive || 0) / ((bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0) || 1)) * 100).toFixed(1)}%`],
    ['TOTAL ACTIF (EMPLOIS)', (bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0), (dataN1?.bilan?.emploisStables || 0) + (dataN1?.bilan?.actifCirculant || 0) + (dataN1?.bilan?.tresorerieActive || 0) || '', '100.0%'],
    [],
    ['II. PASSIF (RESSOURCES)', 'Exercice N (DZD)', 'Exercice N-1 (DZD)', 'Part Passif N (%)'],
    ['Ressources Stables (Capitaux Propres + Dettes LT)', bilan.ressourcesStables || 0, dataN1?.bilan?.ressourcesStables || '', `${(((bilan.ressourcesStables || 0) / ((bilan.ressourcesStables || 0) + (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0) || 1)) * 100).toFixed(1)}%`],
    ['Passif Circulant (Fournisseurs + Dettes CT)', bilan.passifCirculant || 0, dataN1?.bilan?.passifCirculant || '', `${(((bilan.passifCirculant || 0) / ((bilan.ressourcesStables || 0) + (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0) || 1)) * 100).toFixed(1)}%`],
    ['Trésorerie Passive (Découverts & Concours bancaires)', bilan.tresoreriePassive || 0, dataN1?.bilan?.tresoreriePassive || '', `${(((bilan.tresoreriePassive || 0) / ((bilan.ressourcesStables || 0) + (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0) || 1)) * 100).toFixed(1)}%`],
    ['TOTAL PASSIF (RESSOURCES)', (bilan.ressourcesStables || 0) + (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0), (dataN1?.bilan?.ressourcesStables || 0) + (dataN1?.bilan?.passifCirculant || 0) + (dataN1?.bilan?.tresoreriePassive || 0) || '', '100.0%'],
    [],
    ['III. ÉQUILIBRE FINANCIER STRUCTUREL', 'Montant N (DZD)', 'Formule de calcul', 'Interprétation'],
    ['Fonds de Roulement Net Global (FRNG)', bilan.frng || 0, 'Ressources Stables − Emplois Stables', (bilan.frng || 0) >= 0 ? 'Excédent de financement stable (Sécurisé)' : 'Déficit structurel (Risque)'],
    ['Besoin en Fonds de Roulement (BFR)', bilan.bfr || 0, 'Actif Circulant − Passif Circulant', (bilan.bfr || 0) >= 0 ? 'Besoin de trésorerie d\'exploitation' : 'Ressource d\'exploitation'],
    ['Trésorerie Nette (TN)', bilan.tn || 0, 'FRNG − BFR = Trésorerie Active − Passive', (bilan.tn || 0) >= 0 ? 'Liquidités nettes disponibles' : 'Tension de trésorerie'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
  ws2['!cols'] = [{ wch: 45 }, { wch: 22 }, { wch: 22 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Bilan Fonctionnel');

  /* ──────────────────────────────────────────────────────────
     FEUILLE 3 : COMPTE DE RÉSULTAT (TCR / SIG)
     ────────────────────────────────────────────────────────── */
  const ws3Data = [
    ['TABLEAU DES COMPTES DE RÉSULTATS — TCR PAR NATURE (SCF)'],
    ['Nomenclature officielle Système Comptable Financier Algérie'],
    [],
    ['Code', 'Rubrique du Compte de Résultat', 'Montant N (DZD)', '% du CA', 'Observations'],
    ['70', 'Ventes et produits annexes (Chiffre d\'affaires)', sig.c70 || sig.chiffreAffaires || 0, '100.0%', 'Base d\'activité'],
    ['72', 'Variation des stocks de produits finis et en-cours', sig.c72 || 0, `${(((sig.c72 || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Production stockée/déstockée'],
    ['73', 'Production immobilisée', sig.c73 || 0, `${(((sig.c73 || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Travaux faits par l\'entreprise pour elle-même'],
    ['74', 'Subventions d\'exploitation', sig.c74 || 0, `${(((sig.c74 || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Aides d\'exploitation'],
    ['I', 'PRODUCTION DE L\'EXERCICE (70 + 72 + 73 + 74)', sig.productionExercice || 0, `${(((sig.productionExercice || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Activité globale'],
    ['60', 'Achats consommés de matières et marchandises', -(sig.c60 || sig.achats || 0), `${(((sig.c60 || sig.achats || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Consommations directes'],
    ['61/62', 'Services extérieurs et autres consommations', -((sig.c61 || 0) + (sig.c62 || 0)), `${((((sig.c61 || 0) + (sig.c62 || 0)) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Prestations & sous-traitance'],
    ['II', 'CONSOMMATION DE L\'EXERCICE (60 + 61 + 62)', -(sig.consommationExercice || 0), `${(((sig.consommationExercice || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Charges consommées'],
    ['III', 'VALEUR AJOUTÉE (I − II)', sig.valeurAjoutee || 0, `${(((sig.valeurAjoutee || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Richesse nette créée'],
    ['63', 'Charges de personnel (Salaires + Cotisations CNAS)', -(sig.c63 || sig.chargesPersonnel || 0), `${(((sig.c63 || sig.chargesPersonnel || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Masse salariale'],
    ['64', 'Impôts, taxes et versements assimilés', -(sig.c64 || sig.impotsTaxes || 0), `${(((sig.c64 || sig.impotsTaxes || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Taxes d\'exploitation'],
    ['IV', 'EXCÉDENT BRUT D\'EXPLOITATION (EBE)', sig.ebe || 0, `${(((sig.ebe || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Ressource brute d\'exploitation'],
    ['75', 'Autres produits opérationnels', sig.c75 || 0, '', 'Revenus divers'],
    ['65', 'Autres charges opérationnelles', -(sig.c65 || 0), '', 'Charges diverses'],
    ['68', 'Dotations aux amortissements et provisions', -(sig.c68_expl || sig.dotationsExploitation || 0), '', 'Dépréciation du capital'],
    ['78', 'Reprises sur provisions et pertes de valeur', sig.c78_expl || sig.reprisesExploitation || 0, '', 'Annulations de provisions'],
    ['V', 'RÉSULTAT OPÉRATIONNEL', sig.resultatExploitation || 0, `${(((sig.resultatExploitation || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Performance pure'],
    ['76/786', 'Produits financiers', sig.produitsFinanciers || 0, '', 'Placements & gains'],
    ['66/686', 'Charges financières', -(sig.chargesFinancieres || 0), '', 'Intérêts d\'emprunts'],
    ['VI', 'RÉSULTAT FINANCIER', sig.resultatFinancier || 0, '', 'Coût de l\'endettement'],
    ['VII', 'RÉSULTAT ORDINAIRE AVANT IMPÔTS (RCAI)', sig.rcai || 0, `${(((sig.rcai || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Résultat courant'],
    ['69', 'Impôts exigibles et différés (IBS)', -(sig.c69 || sig.impotsBenefices || 0), '', `Taux légal: ${secteur.tauxIBS}`],
    ['VIII', 'RÉSULTAT NET DES ACTIVITÉS ORDINAIRES', sig.resultatNetOrdinaire || 0, '', 'Bénéfice ordinaire'],
    ['77/67', 'Éléments extraordinaires', sig.resultatExtraordinaire || 0, '', 'Événements exceptionnels'],
    ['IX', 'RÉSULTAT NET DE L\'EXERCICE', sig.resultatNet || 0, `${(((sig.resultatNet || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, 'Bénéfice/Perte distribuable'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(ws3Data);
  ws3['!cols'] = [{ wch: 10 }, { wch: 48 }, { wch: 22 }, { wch: 15 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'TCR & SIG');

  /* ──────────────────────────────────────────────────────────
     FEUILLE 4 : RATIOS & BENCHMARKS SECTORIELS
     ────────────────────────────────────────────────────────── */
  const ws4Data = [
    ['RATIOS FINANCIERS & BENCHMARKS SECTORIELS (ALGÉRIE)'],
    ['Secteur de référence :', secteur.label],
    [],
    ['Indicateur / Ratio', 'Valeur Mesurée', 'Norme Sectorielle Algérie', 'Statut', 'Formule de Calcul'],
    ['Marge EBE (% du CA)', `${(((sig.ebe || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, bm.margeEBE.norme, (sig.ebe || 0) / (sig.chiffreAffaires || 1) >= bm.margeEBE.bon ? 'OPTIMAL' : 'À AMÉLIORER', 'EBE / CA'],
    ['Marge Nette (% du CA)', `${(((sig.resultatNet || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, bm.margeNette.norme, (sig.resultatNet || 0) > 0 ? 'CONFORME' : 'DÉFICIT', 'Résultat Net / CA'],
    ['Taux de Valeur Ajoutée', `${(((sig.valeurAjoutee || 0) / (sig.chiffreAffaires || 1)) * 100).toFixed(1)}%`, bm.tauxVA.norme, (sig.valeurAjoutee || 0) / (sig.chiffreAffaires || 1) >= bm.tauxVA.bon ? 'OPTIMAL' : 'MOYEN', 'Valeur Ajoutée / CA'],
    ['Liquidité Générale', `${(ratios.liquiditeGenerale || 0).toFixed(2)}x`, bm.liquiditeGenerale.norme, (ratios.liquiditeGenerale || 0) >= bm.liquiditeGenerale.bon ? 'SOLIDE' : 'ATTENTION', '(Actif Circulant + Trésorerie) / Passif Court Terme'],
    ['Autonomie Financière', `${(((ratios.autonomieFinanciere || 0)) * 100).toFixed(1)}%`, bm.autonomieFinanciere.norme, (ratios.autonomieFinanciere || 0) >= bm.autonomieFinanciere.bon ? 'SOLIDE' : 'VULNÉRABLE', 'Ressources Stables / Total Bilan'],
    ['Délai Recouvrement Clients (DSO)', `${Math.round(ratios.delaiRecouvrement || 0)} jours`, bm.dso.norme, (ratios.delaiRecouvrement || 0) <= bm.dso.bon ? 'OPTIMAL' : 'LENT', '(Créances Clients / CA) × 360'],
    ['Délai Paiement Fournisseurs (DPO)', `${Math.round(ratios.delaiFournisseurs || 0)} jours`, bm.dpo.norme, 'CONFORME', '(Dettes Fournisseurs / Consommations) × 360'],
    ['Rotation des Stocks', `${Math.round(ratios.rotationStocks || 0)} jours`, bm.rotationStocks.norme, (ratios.rotationStocks || 0) <= bm.rotationStocks.bon ? 'OPTIMAL' : 'LENT', '(Stock Moyen / Achats) × 360'],
    ['BFR en Jours de CA', `${Math.round(ratios.bfrJoursCA || 0)} j CA`, bm.bfrJoursCA.norme, (ratios.bfrJoursCA || 0) <= bm.bfrJoursCA.bon ? 'MAÎTRISÉ' : 'ÉLEVÉ', '(BFR / CA) × 360'],
    ['Productivité du Travail', `${(sig.valeurAjoutee && sig.chargesPersonnel ? (sig.valeurAjoutee / sig.chargesPersonnel).toFixed(2) : '1.50')}x`, bm.productivite.norme, 'ÉVALUÉ', 'Valeur Ajoutée / Charges de Personnel'],
  ];
  const ws4 = XLSX.utils.aoa_to_sheet(ws4Data);
  ws4['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Ratios & Benchmarks');

  /* ──────────────────────────────────────────────────────────
     FEUILLE 5 : GRAND LIVRE / BALANCE GÉNÉRALE
     ────────────────────────────────────────────────────────── */
  const ws5Data = [
    ['BALANCE GÉNÉRALE DES COMPTES (GRAND LIVRE)'],
    ['Compte', 'Intitulé du Compte', 'Solde Début Débit', 'Solde Début Crédit', 'Mouvement Débit', 'Mouvement Crédit', 'Solde Fin Débit', 'Solde Fin Crédit'],
  ];
  (rows || []).forEach(r => {
    ws5Data.push([
      r.compte || '',
      r.libelle || '',
      r.soldeDebutDebit || 0,
      r.soldeDebutCredit || 0,
      r.mouvementDebit || 0,
      r.mouvementCredit || 0,
      r.soldeFinDebit || 0,
      r.soldeFinCredit || 0,
    ]);
  });
  const ws5 = XLSX.utils.aoa_to_sheet(ws5Data);
  ws5['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'Balance des Comptes');

  // Téléchargement du fichier .xlsx
  XLSX.writeFile(wb, filename);
  return true;
}
