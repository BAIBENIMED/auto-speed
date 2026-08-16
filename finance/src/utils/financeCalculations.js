import * as XLSX from 'xlsx';

/**
 * ═══════════════════════════════════════════════════════════════
 * VÉRIFICATION DE LA NATURE DES COMPTES (SCF Algérie — Loi 07-11)
 * Contrôle de cohérence comptable, classification et détection d'anomalies de solde.
 * ═══════════════════════════════════════════════════════════════
 */
export function verifyAccountNature(compte, soldeFinDebit = 0, soldeFinCredit = 0) {
  if (!compte) return { classe: 0, classeLabel: 'Inconnu', nature: 'Inconnue', sensAttendu: 'MIXTE', statut: 'CONFORME', diagnostic: 'Compte non défini' };
  
  const parseNum = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const s = String(v).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const c = String(compte).trim();
  const deb = parseNum(soldeFinDebit);
  const cred = parseNum(soldeFinCredit);
  const netSolde = deb - cred; // > 0 = Débiteur, < 0 = Créditeur, 0 = Nul
  const isDeb = netSolde > 0.001;
  const isCred = netSolde < -0.001;
  const isNul = !isDeb && !isCred;

  // ── CLASSE 1 : COMPTES DE CAPITAUX (Passif / Capitaux Propres & Dettes LT) ──
  if (c.startsWith('1')) {
    if (c.startsWith('109')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Actionnaires : Capital souscrit non appelé', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isCred ? 'Anomalie : Le compte 109 doit être débiteur.' : 'Conforme au SCF (Actif soustractif des capitaux propres).'
      };
    }
    // 11 — Report à nouveau (110 Bénéficiaire = Crédit, 119 Déficitaire = Débit)
    if (c.startsWith('119')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Report à nouveau débiteur (Pertes antérieures reportées)', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isCred ? 'Solde créditeur sur compte 119 (utiliser 110 si bénéficiaire).' : 'Pertes antérieures cumulées conformes au SCF (solde débiteur).'
      };
    }
    if (c.startsWith('110')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Report à nouveau créditeur (Bénéfices antérieurs reportés)', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur sur compte 110 (utiliser 119 si déficitaire).' : 'Bénéfices reportés réguliers (solde créditeur).'
      };
    }
    if (c.startsWith('11')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Report à nouveau (Compte 11)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb ? 'Report à nouveau débiteur (Pertes antérieures).' : isCred ? 'Report à nouveau créditeur (Bénéfices antérieurs).' : 'Solde nul.'
      };
    }
    // 12 — Résultat de l'exercice (120 Bénéfice = Crédit, 129 Perte = Débit)
    if (c.startsWith('129')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Résultat de l\'exercice (Perte nette)', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isCred ? 'Solde créditeur sur compte 129 (utiliser compte 120 si bénéfice).' : 'Perte nette de l\'exercice conforme au SCF (solde débiteur).'
      };
    }
    if (c.startsWith('120')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Résultat de l\'exercice (Bénéfice net)', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur sur compte 120 (utiliser compte 129 si perte).' : 'Bénéfice net régulier (solde créditeur).'
      };
    }
    if (c.startsWith('12')) {
      return {
        classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Résultat net de l\'exercice (Compte 12)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb ? 'Résultat déficitaire / Perte nette (Solde débiteur conforme).' : isCred ? 'Résultat bénéficiaire / Bénéfice net (Solde créditeur conforme).' : 'Résultat équilibré (Solde nul).'
      };
    }
    if (c.startsWith('16')) {
      return {
        classe: 1, classeLabel: '1 — Dettes Financières', nature: 'Emprunts et dettes financières à long terme', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Un emprunt (Compte 16) ne peut présenter un solde débiteur.' : 'Dette financière LT régulière (solde créditeur).'
      };
    }
    if (c.startsWith('15')) {
      return {
        classe: 1, classeLabel: '1 — Provisions pour charges', nature: 'Provisions pour risques et charges', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Une provision pour risques (Compte 15) doit être créditrice.' : 'Provision pour risques régulière (solde créditeur).'
      };
    }
    // 13 — Produits & charges différés (131 Subventions = Crédit, 133 Impôts différés = MIXTE)
    if (c.startsWith('133')) {
      return {
        classe: 1, classeLabel: '1 — Impôts Différés', nature: 'Impôts différés actif & passif (Compte 133)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Impôt différé actif conforme SCF (Créance d\'impôt future / Actif non courant).'
          : isCred
          ? 'Impôt différé passif conforme SCF (Dette fiscale future / Passif non courant).'
          : 'Solde nul (Imposition différée soldée).'
      };
    }
    if (c.startsWith('131') || c.startsWith('132')) {
      return {
        classe: 1, classeLabel: '1 — Subventions d\'Investissement', nature: 'Subventions d\'équipement et d\'investissement (Compte 131/132)', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Une subvention d\'investissement ne peut présenter un solde débiteur.' : 'Subvention d\'investissement régulière (Passif non courant).'
      };
    }
    if (c.startsWith('13')) {
      return {
        classe: 1, classeLabel: '1 — Produits & Charges Différés', nature: 'Produits et charges différés (Compte 13)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb ? 'Charge différée ou impôt différé actif (Débiteur).' : 'Produit différé ou subvention (Créditeur).'
      };
    }
    return {
      classe: 1, classeLabel: '1 — Capitaux Propres', nature: 'Fonds propres & Réserves', sensAttendu: 'CRÉDITEUR',
      statut: isDeb ? 'ANOMALIE' : 'CONFORME',
      diagnostic: isDeb ? 'Anomalie majeure : Les fonds propres (Compte 10) ne peuvent être débiteurs.' : 'Capitaux propres réguliers (solde créditeur).'
    };
  }

  // ── CLASSE 2 : COMPTES D'IMMOBILISATIONS (Actif Non Courant) ──
  if (c.startsWith('2')) {
    if (c.startsWith('28')) {
      return {
        classe: 2, classeLabel: '2 — Amortissements', nature: 'Amortissements des immobilisations', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Les amortissements (Compte 28) doivent obligatoirement être créditeurs.' : 'Amortissement cumulé régulier (valeur négative d\'actif).'
      };
    }
    if (c.startsWith('29')) {
      return {
        classe: 2, classeLabel: '2 — Dépréciations', nature: 'Pertes de valeur / Dépréciations d\'immobilisations', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Une dépréciation d\'actif doit être créditrice.' : 'Perte de valeur régulière (compte correcteur d\'actif).'
      };
    }
    return {
      classe: 2, classeLabel: '2 — Immobilisations', nature: 'Immobilisations incorporelles, corporelles ou financières (Brut)', sensAttendu: 'DÉBITEUR',
      statut: isCred ? 'ANOMALIE' : 'CONFORME',
      diagnostic: isCred ? 'Anomalie critique : Une immobilisation brute (Compte 20/21/22/23/26/27) ne peut avoir un solde créditeur.' : 'Immobilisation brute régulière (solde débiteur).'
    };
  }

  // ── CLASSE 3 : COMPTES DE STOCKS ET EN-COURS (Actif Circulant) ──
  if (c.startsWith('3')) {
    if (c.startsWith('39')) {
      return {
        classe: 3, classeLabel: '3 — Dépréciations Stocks', nature: 'Pertes de valeur sur stocks', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : La dépréciation de stock (Compte 39) doit être créditrice.' : 'Dépréciation de stock régulière.'
      };
    }
    return {
      classe: 3, classeLabel: '3 — Stocks & En-cours', nature: 'Stocks de marchandises, matières ou produits', sensAttendu: 'DÉBITEUR',
      statut: isCred ? 'ANOMALIE' : 'CONFORME',
      diagnostic: isCred ? 'Anomalie critique : Un compte de stock physique (30/31/32/33/35) ne peut avoir un solde négatif (créditeur).' : 'Stock régulier (solde débiteur).'
    };
  }

  // ── CLASSE 4 : COMPTES DE TIERS (Créances & Dettes) ──
  if (c.startsWith('4')) {
    if (c.startsWith('49')) {
      return {
        classe: 4, classeLabel: '4 — Dépréciations Tiers', nature: 'Pertes de valeur sur créances clients/tiers', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : La dépréciation des créances (Compte 49) doit être créditrice.' : 'Provision pour créances douteuses régulière.'
      };
    }
    // Fournisseurs
    if (c.startsWith('40')) {
      if (c.startsWith('409')) {
        return {
          classe: 4, classeLabel: '4 — Fournisseurs Débiteurs', nature: 'Fournisseurs débiteurs (Avances & acomptes versés)', sensAttendu: 'DÉBITEUR',
          statut: isCred ? 'ATYPIQUE' : 'CONFORME',
          diagnostic: isCred ? 'Solde créditeur sur compte d\'avances fournisseurs (utiliser 401).' : 'Avances/acomptes versés réguliers (Actif circulant).'
        };
      }
      return {
        classe: 4, classeLabel: '4 — Dettes Fournisseurs', nature: 'Dettes Fournisseurs d\'exploitation & immobilisations', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur atypique sur Fournisseur (Trop-versé ou avance : reclasser en 409 au bilan).' : 'Dette fournisseur régulière (Passif circulant).'
      };
    }
    // Clients
    if (c.startsWith('41')) {
      if (c.startsWith('419')) {
        return {
          classe: 4, classeLabel: '4 — Clients Créditeurs', nature: 'Clients créditeurs (Avances reçues & avoirs à établir)', sensAttendu: 'CRÉDITEUR',
          statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
          diagnostic: isDeb ? 'Solde débiteur sur compte d\'avances reçues (utiliser 411).' : 'Avances reçues des clients régulières (Passif circulant).'
        };
      }
      return {
        classe: 4, classeLabel: '4 — Créances Clients', nature: 'Créances Clients & comptes rattachés', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isCred ? 'Solde créditeur atypique sur Client (Acompte reçu ou avoir à émettre : reclasser en 419 au bilan).' : 'Créance client régulière (Actif circulant).'
      };
    }
    // Personnel & Organismes sociaux
    if (c.startsWith('42') || c.startsWith('43')) {
      return {
        classe: 4, classeLabel: '4 — Dettes Sociales', nature: 'Personnel (42) & Organismes Sociaux CNAS/CASNOS (43)', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur (Avance sur salaire ou trop-versé cotisations : compte 425).' : 'Dette salariale/sociale régulière.'
      };
    }
    // État & Collectivités Publiques (Compte 44 — MIXTE)
    if (c.startsWith('44')) {
      return {
        classe: 4, classeLabel: '4 — Fiscalité & État', nature: 'État, impôts et taxes (TVA, IBS, TAP, Retenues)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Créance fiscale sur l\'État conforme SCF (Crédit de TVA 4456, Acompte IBS payé ou subventions à recevoir 441).'
          : isCred
          ? 'Dette fiscale exigible conforme SCF (TVA collectée 4457, IBS dû 444, IRG/TAP à décaisser).'
          : 'Solde fiscal apuré.'
      };
    }
    // Groupe & Associés (Compte 45 — MIXTE)
    if (c.startsWith('45')) {
      return {
        classe: 4, classeLabel: '4 — Groupe & Associés', nature: 'Comptes courants d\'associés & Sociétés liées', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Créance sur associés / Groupe conforme SCF (Avance intra-groupe ou prêt).'
          : isCred
          ? 'Dette envers les associés / Groupe conforme SCF (Compte courant d\'associé créditeur).'
          : 'Solde nul.'
      };
    }
    // Débiteurs & Créditeurs Divers (Compte 46 — MIXTE)
    if (c.startsWith('46')) {
      return {
        classe: 4, classeLabel: '4 — Tiers Divers', nature: 'Débiteurs et créditeurs divers (Compte 46)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Créance diverse conforme SCF (Cession d\'actif 462 ou débiteur divers).'
          : isCred
          ? 'Dette diverse conforme SCF (Dette sur titres 464 ou créditeur divers).'
          : 'Solde nul.'
      };
    }
    // Comptes d'Attente & Transitoires (Compte 47 — Transitoire à régulariser)
    if (c.startsWith('47')) {
      return {
        classe: 4, classeLabel: '4 — Comptes d\'Attente', nature: 'Comptes transitoires à régulariser (Compte 47)', sensAttendu: 'MIXTE',
        statut: isNul ? 'CONFORME' : 'ATYPIQUE',
        diagnostic: isNul
          ? 'Compte d\'attente lettré et soldé (Conforme).'
          : 'Compte d\'attente non soldé (À justifier et imputer aux comptes définitifs avant clôture).'
      };
    }
    // Comptes de Régularisation (Compte 48 — MIXTE)
    if (c.startsWith('48')) {
      if (c.startsWith('486')) {
        return {
          classe: 4, classeLabel: '4 — Régularisation', nature: 'Charges constatées d\'avance (Compte 486)', sensAttendu: 'DÉBITEUR',
          statut: isCred ? 'ATYPIQUE' : 'CONFORME',
          diagnostic: isCred ? 'Solde créditeur sur charges constatées d\'avance (utiliser 487).' : 'Charge constatée d\'avance régulière (Actif circulant).'
        };
      }
      if (c.startsWith('487')) {
        return {
          classe: 4, classeLabel: '4 — Régularisation', nature: 'Produits constatés d\'avance (Compte 487)', sensAttendu: 'CRÉDITEUR',
          statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
          diagnostic: isDeb ? 'Solde débiteur sur produits constatés d\'avance (utiliser 486).' : 'Produit constaté d\'avance régulier (Passif circulant).'
        };
      }
      return {
        classe: 4, classeLabel: '4 — Régularisation', nature: 'Comptes de régularisation & Écarts de conversion (Compte 48)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb ? 'Régularisation Actif / Écart de conversion débiteur.' : 'Régularisation Passif / Écart de conversion créditeur.'
      };
    }
    return {
      classe: 4, classeLabel: '4 — Autres Tiers', nature: 'Comptes de tiers divers', sensAttendu: 'MIXTE',
      statut: 'CONFORME',
      diagnostic: isDeb ? 'Créance diverse (Actif).' : 'Dette diverse (Passif).'
    };
  }

  // ── CLASSE 5 : COMPTES FINANCIERS (Trésorerie Active & Passive) ──
  if (c.startsWith('5')) {
    if (c.startsWith('59')) {
      return {
        classe: 5, classeLabel: '5 — Dépréciations Trésorerie', nature: 'Pertes de valeur sur valeurs mobilières', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isDeb ? 'Anomalie : Dépréciation financière débitrice.' : 'Dépréciation financière régulière.'
      };
    }
    if (c.startsWith('53')) {
      return {
        classe: 5, classeLabel: '5 — Caisse', nature: 'Disponibilités en Caisse physique', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ANOMALIE' : 'CONFORME',
        diagnostic: isCred ? 'Anomalie critique : La caisse (Compte 53) ne peut JAMAIS être créditrice (dépenses supérieures aux recettes) !' : 'Disponibilité en caisse régulière (solde débiteur).'
      };
    }
    if (c.startsWith('519')) {
      return {
        classe: 5, classeLabel: '5 — Trésorerie Passive', nature: 'Concours bancaires courants / Découverts', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur sur compte de découvert (utiliser 512 Banque).' : 'Découvert bancaire autorisé (Passif de trésorerie).'
      };
    }
    // Virements internes (58 — compte transitoire)
    if (c.startsWith('58')) {
      return {
        classe: 5, classeLabel: '5 — Virements Internes', nature: 'Virements de fonds internes (Compte 58)', sensAttendu: 'MIXTE',
        statut: isNul ? 'CONFORME' : 'ATYPIQUE',
        diagnostic: isNul ? 'Virements internes équilibrés et soldés.' : 'Solde résiduel sur virements internes (À rapprocher avant clôture).'
      };
    }
    return {
      classe: 5, classeLabel: '5 — Trésorerie Active', nature: 'Banques, VMP, chèques postaux & régies', sensAttendu: 'DÉBITEUR',
      statut: isCred ? 'ATYPIQUE' : 'CONFORME',
      diagnostic: isCred ? 'Solde bancaire créditeur (Découvert bancaire : reclasser en 519 au bilan).' : 'Trésorerie bancaire disponible (Actif).'
    };
  }

  // ── CLASSE 6 : COMPTES DE CHARGES (Compte de Résultat - Débit) ──
  if (c.startsWith('6')) {
    if (c.startsWith('603')) {
      return {
        classe: 6, classeLabel: '6 — Variation Stocks Achats', nature: 'Variation des stocks de marchandises & matières (Compte 603)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Déstockage des achats (Solde débiteur régulier : Stock initial > Stock final).'
          : isCred
          ? 'Stockage des achats (Solde créditeur régulier : Stock final > Stock initial).'
          : 'Solde nul (Variation nulle).'
      };
    }
    if (c.startsWith('609') || c.startsWith('619') || c.startsWith('629')) {
      return {
        classe: 6, classeLabel: '6 — Rabais obtenus', nature: 'Rabais, remises et ristournes obtenus sur achats & services', sensAttendu: 'CRÉDITEUR',
        statut: isDeb ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isDeb ? 'Solde débiteur sur RRR obtenus.' : 'RRR obtenus réguliers (diminution des charges).'
      };
    }
    return {
      classe: 6, classeLabel: '6 — Charges d\'Exploitation/Financières', nature: 'Achats, services, personnel, dotations & impôts', sensAttendu: 'DÉBITEUR',
      statut: isCred ? 'ANOMALIE' : 'CONFORME',
      diagnostic: isCred ? 'Anomalie : Une charge (Classe 6) ne doit pas avoir un solde net créditeur (annulations ou erreurs d\'imputation).' : 'Charge d\'exploitation régulière (solde débiteur).'
    };
  }

  // ── CLASSE 7 : COMPTES DE PRODUITS (Compte de Résultat - Crédit) ──
  if (c.startsWith('7')) {
    if (c.startsWith('72')) {
      return {
        classe: 7, classeLabel: '7 — Variation Stocks Produits', nature: 'Production stockée ou déstockage (Compte 72)', sensAttendu: 'MIXTE',
        statut: 'CONFORME',
        diagnostic: isDeb
          ? 'Déstockage (Solde débiteur conforme SCF : Consommation de stocks, Stock final < Stock initial).'
          : isCred
          ? 'Production stockée (Solde créditeur conforme SCF : Augmentation des stocks de produits).'
          : 'Solde nul (Production égale aux ventes).'
      };
    }
    if (c.startsWith('709')) {
      return {
        classe: 7, classeLabel: '7 — Rabais accordés', nature: 'Rabais, remises et ristournes accordés par l\'entreprise', sensAttendu: 'DÉBITEUR',
        statut: isCred ? 'ATYPIQUE' : 'CONFORME',
        diagnostic: isCred ? 'Solde créditeur sur RRR accordés.' : 'RRR accordés réguliers (diminution du chiffre d\'affaires).'
      };
    }
    return {
      classe: 7, classeLabel: '7 — Produits & Ventes', nature: 'Ventes, subventions, produits annexes & financiers', sensAttendu: 'CRÉDITEUR',
      statut: isDeb ? 'ANOMALIE' : 'CONFORME',
      diagnostic: isDeb ? 'Anomalie : Un compte de produit (Classe 7) ne doit pas avoir un solde net débiteur (avoirs supérieurs aux factures).' : 'Produit régulier (solde créditeur).'
    };
  }

  return {
    classe: 0, classeLabel: 'Hors Classement', nature: 'Compte spécial ou hors bilan', sensAttendu: 'MIXTE',
    statut: 'CONFORME', diagnostic: 'Compte non classé au SCF standard.'
  };
}

/**
 * Effectue un audit exhaustif de la cohérence de tous les comptes de la balance.
 */
export function auditBalanceAccounts(rows = []) {
  if (!rows || !Array.isArray(rows)) return { total: 0, conformes: 0, atypiques: 0, anomalies: 0, scoreCoherence: 100, comptesAudit: [] };

  const safeNum = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const s = String(v).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const comptesAudit = rows.filter(r => r.compte && !r.ignore).map(r => {
    let deb = safeNum(r.soldeFinDebit);
    let cred = safeNum(r.soldeFinCredit);
    if (deb === 0 && cred === 0) {
      if (r.solde !== undefined) {
        const s = safeNum(r.solde);
        if (s > 0) deb = s;
        else if (s < 0) cred = -s;
      }
      if (deb === 0 && cred === 0) {
        const md = safeNum(r.mouvementDebit);
        const mc = safeNum(r.mouvementCredit);
        if (md > mc) deb = md - mc;
        else if (mc > md) cred = mc - md;
        else if (md > 0 || mc > 0) {
          deb = md;
          cred = mc;
        }
      }
    }
    const verification = verifyAccountNature(r.compte, deb, cred);

    return {
      ...r,
      deb,
      cred,
      mouvDeb: safeNum(r.mouvementDebit),
      mouvCred: safeNum(r.mouvementCredit),
      netSolde: deb - cred,
      verification
    };
  });

  const total = comptesAudit.length;
  const conformes = comptesAudit.filter(c => c.verification.statut === 'CONFORME').length;
  const atypiques = comptesAudit.filter(c => c.verification.statut === 'ATYPIQUE').length;
  const anomalies = comptesAudit.filter(c => c.verification.statut === 'ANOMALIE').length;

  const scoreCoherence = total > 0
    ? Math.max(0, Math.round(100 - (anomalies * 15 + atypiques * 5) / (total / 10)))
    : 100;

  return {
    total,
    conformes,
    atypiques,
    anomalies,
    scoreCoherence: Math.min(100, Math.max(0, scoreCoherence)),
    comptesAudit
  };
}

/**
 * ═══════════════════════════════════════════════════════════════
 * AUDIT DES FLUX CROISÉS & CONTRÔLE DES MOUVEMENTS INTER-COMPTES (SCF)
 * Vérification des égalités et jeux d'écritures de période :
 * 1. Cycle Achats & Entrées en stocks : Crédit 38x vs Débit 3x (380->30, 381->31, 382->32)
 * 2. Cycle Dotations / Provisions : Débit 68 vs Crédit (28, 29, 39, 49, 59, 15)
 * 3. Cycle Reprises sur Provisions : Crédit 78 vs Débit (29, 39, 49, 59, 15)
 * 4. Cycle Virements Internes : Débit 58 vs Crédit 58 (Solde nul)
 * 5. Cycle Production stockée : Solde 72 vs Variation réelle stocks produits (33, 34, 35)
 * 6. Cycle Variation stocks appros : Solde 603 vs Variation réelle stocks appros (30, 31, 32)
 * 7. Cycle Masse Salariale : Débit 631/635 vs Mouvements Tiers 42/43
 * ═══════════════════════════════════════════════════════════════
 */
export function auditCrossAccountMovements(rows = []) {
  if (!rows || !Array.isArray(rows)) return { regles: [], scoreFlux: 100, totalAnomaliesFlux: 0, totalAtypiquesFlux: 0, totalConformesFlux: 0 };

  const safeNum = (v) => {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;
    const s = String(v).replace(/\s/g, '').replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  };

  const fmtDA = (v) => {
    const num = safeNum(v);
    return num.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DA';
  };

  const getSums = (prefixes, excludePrefixes = []) => {
    let initDeb = 0, initCred = 0, mouvDeb = 0, mouvCred = 0, finDeb = 0, finCred = 0;
    const accounts = [];
    const pList = Array.isArray(prefixes) ? prefixes : [prefixes];
    const exList = Array.isArray(excludePrefixes) ? excludePrefixes : [excludePrefixes];

    rows.forEach(r => {
      if (!r.compte || r.ignore) return;
      const c = String(r.compte).trim();
      const cClean = c.replace(/[\s.-]/g, '');
      if (exList.some(ex => c.startsWith(ex) || cClean.startsWith(ex))) return;
      if (pList.some(p => c.startsWith(p) || cClean.startsWith(p))) {
        const id = safeNum(r.soldeDebutDebit);
        const ic = safeNum(r.soldeDebutCredit);
        const md = safeNum(r.mouvementDebit);
        const mc = safeNum(r.mouvementCredit);

        let fd = safeNum(r.soldeFinDebit);
        let fc = safeNum(r.soldeFinCredit);
        if (fd === 0 && fc === 0 && r.solde !== undefined) {
          const s = safeNum(r.solde);
          if (s > 0) fd = s;
          else if (s < 0) fc = -s;
        }

        initDeb += id;
        initCred += ic;
        mouvDeb += md;
        mouvCred += mc;
        finDeb += fd;
        finCred += fc;

        accounts.push({
          compte: c,
          libelle: r.libelle || '',
          initDeb: id,
          initCred: ic,
          mouvDeb: md,
          mouvCred: mc,
          finDeb: fd,
          finCred: fc,
          soldeInit: id - ic,
          soldeFin: fd - fc
        });
      }
    });

    const soldeInit = safeNum(initDeb - initCred);
    const soldeFin = safeNum(finDeb - finCred);
    return { 
      initDeb: safeNum(initDeb), 
      initCred: safeNum(initCred), 
      mouvDeb: safeNum(mouvDeb), 
      mouvCred: safeNum(mouvCred), 
      finDeb: safeNum(finDeb), 
      finCred: safeNum(finCred), 
      soldeInit, 
      soldeFin,
      accounts: accounts.sort((a, b) => a.compte.localeCompare(b.compte, undefined, { numeric: true }))
    };
  };

  const regles = [];

  // ── 1. CYCLE ACHATS & ENTRÉES EN MAGASIN (Crédit 38x vs Débit 3x) ──
  const c380 = getSums('380');
  const c30  = getSums('30', ['39']);
  const ecart380 = safeNum(Math.abs(c380.mouvCred - c30.mouvDeb));
  const isZero380 = c380.mouvCred === 0 && c30.mouvDeb === 0;
  regles.push({
    id: 'achats_380_30',
    cycle: 'Achats & Stocks',
    titre: 'Marchandises : Sorties 380 (Crédit) vs Entrées en Magasin 30 (Débit)',
    sourceLabel: 'Crédit 380 (Achats stockés)',
    sourceVal: c380.mouvCred,
    sourceAccounts: c380.accounts,
    sourceFocus: 'CREDIT',
    cibleLabel: 'Débit 30 (Entrées stocks)',
    cibleVal: c30.mouvDeb,
    cibleAccounts: c30.accounts,
    cibleFocus: 'DEBIT',
    ecart: ecart380,
    statut: isZero380 ? 'NON_MOUVEMENTE' : ecart380 < 1 ? 'CONFORME' : ecart380 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero380
      ? 'Aucun mouvement d\'achats de marchandises (380) ou d\'entrées en stock (30) enregistré sur la période.'
      : ecart380 < 1
      ? 'Égalité parfaite (SCF) : La totalité des achats de marchandises (380) a été réceptionnée en stocks (30).'
      : `Écart de ${fmtDA(ecart380)} : Décalage entre les réceptions physiques et les factures parvenues (Factures à recevoir / réceptions en transit).`
  });

  const c381 = getSums('381');
  const c31  = getSums('31', ['39']);
  const ecart381 = safeNum(Math.abs(c381.mouvCred - c31.mouvDeb));
  const isZero381 = c381.mouvCred === 0 && c31.mouvDeb === 0;
  regles.push({
    id: 'achats_381_31',
    cycle: 'Achats & Stocks',
    titre: 'Matières Premières : Sorties 381 (Crédit) vs Entrées en Magasin 31 (Débit)',
    sourceLabel: 'Crédit 381 (Achats matières)',
    sourceVal: c381.mouvCred,
    sourceAccounts: c381.accounts,
    sourceFocus: 'CREDIT',
    cibleLabel: 'Débit 31 (Entrées matières)',
    cibleVal: c31.mouvDeb,
    cibleAccounts: c31.accounts,
    cibleFocus: 'DEBIT',
    ecart: ecart381,
    statut: isZero381 ? 'NON_MOUVEMENTE' : ecart381 < 1 ? 'CONFORME' : ecart381 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero381
      ? 'Aucun mouvement d\'achats de matières (381) ou d\'entrées en stock (31) enregistré sur la période.'
      : ecart381 < 1
      ? 'Égalité parfaite (SCF) : Toutes les matières achetées (381) sont entrées en stock (31).'
      : `Écart de ${fmtDA(ecart381)} : Écart sur réceptions magasin ou transit fournisseurs matières.`
  });

  const c382 = getSums('382');
  const c32  = getSums('32', ['39']);
  const ecart382 = safeNum(Math.abs(c382.mouvCred - c32.mouvDeb));
  const isZero382 = c382.mouvCred === 0 && c32.mouvDeb === 0;
  regles.push({
    id: 'achats_382_32',
    cycle: 'Achats & Stocks',
    titre: 'Autres Approvisionnements : Sorties 382 (Crédit) vs Entrées en Stock 32 (Débit)',
    sourceLabel: 'Crédit 382 (Autres appros)',
    sourceVal: c382.mouvCred,
    sourceAccounts: c382.accounts,
    sourceFocus: 'CREDIT',
    cibleLabel: 'Débit 32 (Entrées appros)',
    cibleVal: c32.mouvDeb,
    cibleAccounts: c32.accounts,
    cibleFocus: 'DEBIT',
    ecart: ecart382,
    statut: isZero382 ? 'NON_MOUVEMENTE' : ecart382 < 1 ? 'CONFORME' : ecart382 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero382
      ? 'Aucun mouvement d\'autres approvisionnements (382) ou d\'entrées en stock (32) sur la période.'
      : ecart382 < 1
      ? 'Égalité parfaite : Tous les approvisionnements (382) correspondent aux réceptions en stock (32).'
      : `Écart de ${fmtDA(ecart382)} : À auditer pour vérification des réceptions.`
  });

  // Soldes résiduels globaux sur comptes 38 (380, 381, 382, 387)
  const c38Global = getSums('38');
  const soldeNet38 = safeNum(Math.abs(c38Global.soldeFin));
  const isZero38 = c38Global.mouvDeb === 0 && c38Global.mouvCred === 0 && soldeNet38 === 0;
  regles.push({
    id: 'solde_compte_38',
    cycle: 'Achats & Stocks',
    titre: 'Apurement des Comptes d\'Achats Stockés (Compte 38 global)',
    sourceLabel: 'Solde Final Net 38',
    sourceVal: c38Global.soldeFin,
    sourceAccounts: c38Global.accounts,
    sourceFocus: 'FIN',
    cibleLabel: 'Solde visé (0 DA)',
    cibleVal: 0,
    cibleAccounts: [],
    cibleFocus: 'NONE',
    ecart: soldeNet38,
    statut: isZero38 ? 'NON_MOUVEMENTE' : soldeNet38 < 1 ? 'CONFORME' : 'ATYPIQUE',
    explication: isZero38
      ? 'Comptes 38 non mouvementés sur la période.'
      : soldeNet38 < 1
      ? 'Comptes 38 parfaitement soldés à la clôture (0 DA).'
      : c38Global.soldeFin > 0
      ? `Solde débiteur de ${fmtDA(soldeNet38)} : Achats facturés non encore réceptionnés (Marchandises/Matières en cours de route).`
      : `Solde créditeur de ${fmtDA(soldeNet38)} : Marchandises reçues sans facture parvenue (Fournisseurs - Factures non parvenues).`
  });

  // ── 2. CYCLE CONSOMMATIONS & SORTIES DE STOCKS (Inventaire Permanent : Débit 60x vs Crédit 3x) ──
  const c601 = getSums('601');
  const ecart601_31 = safeNum(Math.abs(c601.mouvDeb - c31.mouvCred));
  const isZero601 = c601.mouvDeb === 0 && c31.mouvCred === 0;
  regles.push({
    id: 'conso_601_31',
    cycle: 'Consommations & Production',
    titre: 'Matières Premières Consommées : Débit 601 vs Sorties de Stock 31 (Crédit)',
    sourceLabel: 'Débit 601 (Matières consommées)',
    sourceVal: c601.mouvDeb,
    sourceAccounts: c601.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 31 (Sorties magasin)',
    cibleVal: c31.mouvCred,
    cibleAccounts: c31.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecart601_31,
    statut: isZero601 ? 'NON_MOUVEMENTE' : ecart601_31 < 1 ? 'CONFORME' : ecart601_31 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero601
      ? 'Aucune consommation de matières premières (601) ni sortie de stock (31) constatée.'
      : ecart601_31 < 1
      ? 'Égalité parfaite (Inventaire Permanent SCF) : La totalité des sorties de matières (Crédit 31) correspond aux consommations passées en charges (Débit 601).'
      : `Écart de stock constaté de ${fmtDA(ecart601_31)} : Différence entre les consommations (601) et les sorties physiques (31).`
  });

  const c600 = getSums('600');
  const ecart600_30 = safeNum(Math.abs(c600.mouvDeb - c30.mouvCred));
  const isZero600 = c600.mouvDeb === 0 && c30.mouvCred === 0;
  regles.push({
    id: 'conso_600_30',
    cycle: 'Consommations & Ventes',
    titre: 'Marchandises Vendues : Débit 600 vs Sorties de Stock 30 (Crédit)',
    sourceLabel: 'Débit 600 (Achats vendus)',
    sourceVal: c600.mouvDeb,
    sourceAccounts: c600.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 30 (Sorties marchandises)',
    cibleVal: c30.mouvCred,
    cibleAccounts: c30.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecart600_30,
    statut: isZero600 ? 'NON_MOUVEMENTE' : ecart600_30 < 1 ? 'CONFORME' : ecart600_30 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero600
      ? 'Aucun achat vendu (600) ni sortie de stock de marchandises (30) constaté.'
      : ecart600_30 < 1
      ? 'Égalité parfaite : Le coût d\'achat des marchandises vendues (600) correspond exactement aux sorties de stock (30).'
      : `Écart de stock constaté de ${fmtDA(ecart600_30)} : Décalage d'inventaire ou régularisation de fin d'exercice.`
  });

  const c602 = getSums('602');
  const ecart602_32 = safeNum(Math.abs(c602.mouvDeb - c32.mouvCred));
  const isZero602 = c602.mouvDeb === 0 && c32.mouvCred === 0;
  regles.push({
    id: 'conso_602_32',
    cycle: 'Consommations & Production',
    titre: 'Autres Approvisionnements Consommés : Débit 602 vs Sorties de Stock 32 (Crédit)',
    sourceLabel: 'Débit 602 (Appros consommés)',
    sourceVal: c602.mouvDeb,
    sourceAccounts: c602.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 32 (Sorties appros)',
    cibleVal: c32.mouvCred,
    cibleAccounts: c32.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecart602_32,
    statut: isZero602 ? 'NON_MOUVEMENTE' : ecart602_32 < 1 ? 'CONFORME' : ecart602_32 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero602
      ? 'Aucun autre approvisionnement consommé (602) ni sortie de stock (32) constaté.'
      : ecart602_32 < 1
      ? 'Égalité parfaite : Toutes les sorties d\'autres approvisionnements (32) sont justifiées par les charges (602).'
      : `Écart de ${fmtDA(ecart602_32)} : Écart de stock ou ajustement d'inventaire à vérifier.`
  });

  // ── 3. CYCLE DOTATIONS AUX AMORTISSEMENTS, DÉPRÉCIATIONS & PROVISIONS (SCF Arrêté 26/07/2008) ──
  // Helpers universels pour balances à 4, 6 ou 8 colonnes
  const getCreditAugmentation = (sums) => sums.mouvCred > 0 ? sums.mouvCred : Math.max(0, sums.finCred - sums.initCred);
  const getDebitDiminution = (sums) => sums.mouvDeb > 0 ? sums.mouvDeb : Math.max(0, sums.initCred - sums.finCred);
  const getDebitCharge = (sums) => sums.mouvDeb > 0 ? sums.mouvDeb : Math.max(0, sums.finDeb - sums.initDeb) || sums.finDeb;
  const getCreditProduit = (sums) => sums.mouvCred > 0 ? sums.mouvCred : Math.max(0, sums.finCred - sums.initCred) || sums.finCred;

  // A. Amortissements des Immobilisations : Débit 68x (hors 685/686) vs Crédit 28
  //    Inclut tous les sous-comptes : 680x, 681x, 682x, 683x, 684x, 687x, 688x, 689x
  const c68_amort = getSums('68', ['685', '686']);
  const c28 = getSums('28');
  const dotationAmortCharge = getDebitCharge(c68_amort);
  const dotationAmortAttendue = getCreditAugmentation(c28);
  const ecartAmort = safeNum(Math.abs(dotationAmortAttendue - dotationAmortCharge));
  const isZeroAmort = dotationAmortCharge === 0 && dotationAmortAttendue === 0;

  regles.push({
    id: 'dotations_amortissements_680_681_28',
    cycle: 'Dotations & Amortissements',
    titre: 'Amortissements Immobilisations : Débit (680 + 681) vs Crédit Compte 28',
    sourceLabel: 'Débit 680 / 681 (Dotations Amort.)',
    sourceVal: dotationAmortCharge,
    sourceAccounts: c68_amort.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 28 (Amort. Immobilisations)',
    cibleVal: dotationAmortAttendue,
    cibleAccounts: c28.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecartAmort,
    statut: isZeroAmort ? 'NON_MOUVEMENTE' : ecartAmort < 1 ? 'CONFORME' : ecartAmort < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZeroAmort
      ? 'Aucune dotation aux amortissements (680/681) ni accroissement d\'amortissement (28) sur la période.'
      : ecartAmort < 1
      ? 'Égalité parfaite (SCF) : La dotation aux amortissements de l\'exercice (680/681) est rigoureusement égale à l\'augmentation des amortissements au bilan (Crédit 28).'
      : `Écart de ${fmtDA(ecartAmort)} : Décalage entre la charge d'amortissement de l'exercice (680/681) et l'accroissement du compte 28.`
  });

  // B. Pertes de valeur / Dépréciations d'actifs : Débit 685 / 686 vs Crédit (29, 39, 49, 59)
  const c685 = getSums(['685', '686']);
  const c29 = getSums('29');
  const c39 = getSums('39');
  const c49 = getSums('49');
  const c59 = getSums('59');
  const totalPertesValeurCred = safeNum(
    getCreditAugmentation(c29) +
    getCreditAugmentation(c39) +
    getCreditAugmentation(c49) +
    getCreditAugmentation(c59)
  );
  const dotationDeprecCharge = getDebitCharge(c685);
  const ecartDeprec = safeNum(Math.abs(dotationDeprecCharge - totalPertesValeurCred));
  const isZeroDeprec = dotationDeprecCharge === 0 && totalPertesValeurCred === 0;

  regles.push({
    id: 'dotations_pertes_valeur_685_29_39_49_59',
    cycle: 'Pertes de Valeur & Dépréciations',
    titre: 'Pertes de Valeur sur Actifs : Débit 685 vs Crédit (29 + 39 + 49 + 59)',
    sourceLabel: 'Débit 685 (Dotations Dépréciations)',
    sourceVal: dotationDeprecCharge,
    sourceAccounts: c685.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 29+39+49+59 (Dépréciations)',
    cibleVal: totalPertesValeurCred,
    cibleAccounts: [...c29.accounts, ...c39.accounts, ...c49.accounts, ...c59.accounts],
    cibleFocus: 'CREDIT',
    ecart: ecartDeprec,
    details: [
      { label: 'Dépréciations Immo (29)', val: getCreditAugmentation(c29) },
      { label: 'Dépréciations Stocks (39)', val: getCreditAugmentation(c39) },
      { label: 'Dépréciations Créances Clients (49)', val: getCreditAugmentation(c49) },
      { label: 'Dépréciations Financières (59)', val: getCreditAugmentation(c59) },
    ],
    statut: isZeroDeprec ? 'NON_MOUVEMENTE' : ecartDeprec < 1 ? 'CONFORME' : ecartDeprec < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZeroDeprec
      ? 'Aucune dotation aux pertes de valeur sur actifs (29/39/49/59) enregistrée sur la période.'
      : ecartDeprec < 1
      ? 'Égalité parfaite (SCF) : Toutes les dotations aux dépréciations d\'actifs (685) sont fidèlement enregistrées au bilan (Crédit 29, 39, 49, 59).'
      : `Écart de ${fmtDA(ecartDeprec)} : Différence entre les dotations aux dépréciations au compte 685 et les mouvements de provisions au bilan.`
  });

  // C. Provisions pour Risques et Charges (6815 Non courants + 6855 Courants + 687 Financiers vs 15)
  const c68Prov = getSums(['6815', '6855', '687']);
  const c15 = getSums('15');
  const dotationProvCharge = getDebitCharge(c68Prov);
  const dotationProvAttendue = getCreditAugmentation(c15);
  const ecartProv = safeNum(Math.abs(dotationProvCharge - dotationProvAttendue));
  const isZeroProv = dotationProvCharge === 0 && dotationProvAttendue === 0;

  regles.push({
    id: 'dotations_provisions_15',
    cycle: 'Provisions pour Risques & Charges',
    titre: '3. Provisions pour Risques & Charges : Dotations Débit 6815/6855/687 vs Crédit Compte 15',
    sourceLabel: 'Débit 68 (Dotations Prov.)',
    sourceVal: dotationProvCharge,
    sourceAccounts: c68Prov.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 15 (Provisions Risques)',
    cibleVal: dotationProvAttendue,
    cibleAccounts: c15.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecartProv,
    statut: isZeroProv ? 'NON_MOUVEMENTE' : ecartProv < 1 ? 'CONFORME' : ecartProv < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZeroProv
      ? 'Aucune dotation pour risques et charges (15) constatée sur la période.'
      : ecartProv < 1
      ? 'Égalité parfaite : Les dotations pour risques et charges correspondent rigoureusement aux dotations du compte 15.'
      : `Écart de ${fmtDA(ecartProv)} : Décalage sur les provisions pour risques et charges.`
  });

  // D. Synthèse Globale Compte 68 vs Total Augmentations (28 + 29 + 39 + 49 + 59 + 15)
  const c68Total = getSums('68');
  const totalGlobalProvisionsCred = safeNum(dotationAmortAttendue + totalPertesValeurCred + dotationProvAttendue);
  const total68Debit = getDebitCharge(c68Total);
  const ecart68Total = safeNum(Math.abs(total68Debit - totalGlobalProvisionsCred));
  const isZero68Global = total68Debit === 0 && totalGlobalProvisionsCred === 0;

  regles.push({
    id: 'dotations_68_global',
    cycle: 'Synthèse Dotations & Provisions',
    titre: '4. Synthèse Globale : Total Débit 68 vs Total Crédit (28 + 29 + 39 + 49 + 59 + 15)',
    sourceLabel: 'Total Débit 68 (Toutes dotations)',
    sourceVal: total68Debit,
    sourceAccounts: c68Total.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Total Crédit Provisions & Amort.',
    cibleVal: totalGlobalProvisionsCred,
    cibleAccounts: [...c28.accounts, ...c29.accounts, ...c39.accounts, ...c49.accounts, ...c59.accounts, ...c15.accounts],
    cibleFocus: 'CREDIT',
    ecart: ecart68Total,
    statut: isZero68Global ? 'NON_MOUVEMENTE' : ecart68Total < 1 ? 'CONFORME' : ecart68Total < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero68Global
      ? 'Aucune dotation globale (68) ni provision enregistrée sur l\'exercice.'
      : ecart68Total < 1
      ? 'Équilibre comptable global vérifié : La totalité des dotations (68) est intégralement justifiée par les comptes d\'amortissements (28), dépréciations (29, 39, 49, 59) et provisions (15).'
      : `Écart global de ${fmtDA(ecart68Total)} sur le cycle des dotations.`
  });

  // ── 4. CYCLE REPRISES SUR PROVISIONS & PERTES DE VALEUR (Crédit 78 vs Débit 29, 39, 49, 59, 15) ──
  const c78 = getSums('78');
  const c7811 = getSums('7811');
  const includesAmortReprise = c7811.mouvCred > 0 || c7811.finCred > 0;
  const targetReprisesAccounts = includesAmortReprise
    ? [...c28.accounts, ...c29.accounts, ...c39.accounts, ...c49.accounts, ...c59.accounts, ...c15.accounts]
    : [...c29.accounts, ...c39.accounts, ...c49.accounts, ...c59.accounts, ...c15.accounts];

  const totalReprisesDeb = safeNum(
    (includesAmortReprise ? getDebitDiminution(c28) : 0) +
    getDebitDiminution(c29) +
    getDebitDiminution(c39) +
    getDebitDiminution(c49) +
    getDebitDiminution(c59) +
    getDebitDiminution(c15)
  );
  const total78Credit = getCreditProduit(c78);
  const ecart78 = safeNum(Math.abs(total78Credit - totalReprisesDeb));
  const isZero78 = total78Credit === 0 && totalReprisesDeb === 0;

  regles.push({
    id: 'reprises_78_vs_provisions',
    cycle: 'Reprises sur Pertes & Provisions',
    titre: 'Reprises de l\'Exercice : Crédit 78 (781/785/786) vs Débit (29 + 39 + 49 + 59 + 15)',
    sourceLabel: 'Crédit 78 (Total Reprises)',
    sourceVal: total78Credit,
    sourceAccounts: c78.accounts,
    sourceFocus: 'CREDIT',
    cibleLabel: includesAmortReprise ? 'Débit (28+29+39+49+59+15)' : 'Débit (29+39+49+59+15)',
    cibleVal: totalReprisesDeb,
    cibleAccounts: targetReprisesAccounts,
    cibleFocus: 'DEBIT',
    ecart: ecart78,
    statut: isZero78 ? 'NON_MOUVEMENTE' : ecart78 < 1 ? 'CONFORME' : ecart78 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero78
      ? 'Aucune reprise sur dépréciations ou provisions (78) constatée sur l\'exercice.'
      : ecart78 < 1
      ? 'Égalité comptable vérifiée : Toutes les reprises constatées au TCR (78) correspondent aux annulations et réductions de dépréciations (29, 39, 49, 59) et provisions (15) au bilan.'
      : `Écart de ${fmtDA(ecart78)} : Décalage entre les reprises constatées au TCR (78) et les diminutions de provisions/dépréciations au bilan.`
  });

  // ── 5. CYCLE PRODUCTION STOCKÉE (Compte 72 vs Variation Stocks Produits 35 & En-cours 33, 34, 36) ──
  const c72 = getSums('72');
  const cProdStocks = getSums(['33', '34', '35', '36'], ['39']);
  const varReelleProd = safeNum(cProdStocks.soldeFin - cProdStocks.soldeInit); // Stock Final - Stock Initial (Production stockée si > 0)
  const soldeNet72 = safeNum(c72.soldeFinCredit - c72.soldeFinDebit); // Crédit 72 (stockage) - Débit 72 (déstockage)
  const ecart72 = safeNum(Math.abs(varReelleProd - soldeNet72));
  const isZero72 = Math.abs(soldeNet72) < 0.001 && Math.abs(varReelleProd) < 0.001;

  regles.push({
    id: 'production_stockee_72',
    cycle: 'Production & Produits Finis (TCR)',
    titre: 'Compte 72 (Production stockée/déstockage) vs Variation Nette Bilan (35 Produits + 33/34 En-cours)',
    sourceLabel: 'Solde Net 72 (TCR - Prod. Stockée)',
    sourceVal: soldeNet72,
    sourceAccounts: c72.accounts,
    sourceFocus: 'FIN',
    cibleLabel: 'Var. Stocks Bilan (SF - SI)',
    cibleVal: varReelleProd,
    cibleAccounts: cProdStocks.accounts,
    cibleFocus: 'VAR',
    ecart: ecart72,
    statut: isZero72 ? 'NON_MOUVEMENTE' : ecart72 < 1 ? 'CONFORME' : ecart72 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero72
      ? 'Aucune production stockée (72) ni variation de stocks de produits finis constatée.'
      : ecart72 < 1
      ? 'Concordance parfaite (SCF) : Le compte 72 (Production stockée ou déstockage) correspond rigoureusement à la variation des stocks de produits finis (35) et en-cours (33/34).'
      : `Écart constaté de ${fmtDA(ecart72)} : Le montant de la variation de production (Compte 72) au TCR diffère de la variation constatée au bilan (Comptes 35/33/34).`
  });

  // ── 6. CYCLE VARIATION DES STOCKS DE MARCHANDISES (Compte 603 vs Stocks Marchandises 30 UNIQUEMENT) ──
  const c603 = getSums('603');
  const cMarchandises30 = getSums('30', ['39']); // Compte 30 Marchandises UNIQUEMENT
  const varReelleMarchandises = safeNum(cMarchandises30.soldeInit - cMarchandises30.soldeFin); // Stock Initial 30 - Stock Final 30 = Déstockage Marchandises
  const soldeNet603 = safeNum(c603.soldeFinDebit - c603.soldeFinCredit); // Débit 603 (déstockage) - Crédit 603 (stockage)
  const ecart603 = safeNum(Math.abs(varReelleMarchandises - soldeNet603));
  const isZero603 = Math.abs(soldeNet603) < 0.001 && Math.abs(varReelleMarchandises) < 0.001;

  regles.push({
    id: 'variation_stocks_603',
    cycle: 'Marchandises (TCR & Bilan)',
    titre: 'Compte 603 (Variation Stocks Marchandises) vs Déstockage Marchandises 30 UNIQUEMENT (Stock Initial - Stock Final)',
    sourceLabel: 'Solde Net 603 (TCR - Var. Marchandises)',
    sourceVal: soldeNet603,
    sourceAccounts: c603.accounts,
    sourceFocus: 'FIN',
    cibleLabel: 'Déstockage Net Compte 30 (SI - SF)',
    cibleVal: varReelleMarchandises,
    cibleAccounts: cMarchandises30.accounts,
    cibleFocus: 'VAR',
    ecart: ecart603,
    statut: isZero603 ? 'NON_MOUVEMENTE' : ecart603 < 1 ? 'CONFORME' : ecart603 < 1000 ? 'TOLERANCE' : 'ANOMALIE',
    explication: isZero603
      ? 'Aucune variation de stock de marchandises (603 / 30) sur la période.'
      : ecart603 < 1
      ? 'Concordance parfaite : Le compte 603 reflète fidèlement la variation des stocks de marchandises (Compte 30 uniquement : Stock Initial - Stock Final).'
      : `Écart constaté de ${fmtDA(ecart603)} : Le compte 603 au TCR ne correspond pas à la variation constatée sur le compte de marchandises 30 (Stock Initial ${fmtDA(cMarchandises30.soldeInit)} → Stock Final ${fmtDA(cMarchandises30.soldeFin)}).`
  });

  // ── 7. CYCLE VIREMENTS INTERNES (58 Débit vs 58 Crédit) ──
  const c58 = getSums('58');
  const ecart58 = safeNum(Math.abs(c58.mouvDeb - c58.mouvCred));
  const soldeFin58 = safeNum(Math.abs(c58.soldeFin));
  const isZero58 = c58.mouvDeb === 0 && c58.mouvCred === 0 && soldeFin58 === 0;

  regles.push({
    id: 'virements_internes_58',
    cycle: 'Trésorerie',
    titre: 'Équilibre des Virements Internes : Débit 58 vs Crédit 58',
    sourceLabel: 'Débit 58 (Fonds émis)',
    sourceVal: c58.mouvDeb,
    sourceAccounts: c58.accounts,
    sourceFocus: 'DEBIT',
    cibleLabel: 'Crédit 58 (Fonds reçus)',
    cibleVal: c58.mouvCred,
    cibleAccounts: c58.accounts,
    cibleFocus: 'CREDIT',
    ecart: ecart58,
    statut: isZero58 ? 'NON_MOUVEMENTE' : (ecart58 < 1 && soldeFin58 < 1) ? 'CONFORME' : 'ANOMALIE',
    explication: isZero58
      ? 'Aucun virement interne de fonds (58) mouvementé sur la période.'
      : (ecart58 < 1 && soldeFin58 < 1)
      ? 'Virements internes rigoureusement équilibrés et soldés (Solde final = 0 DA).'
      : `Anomalie : Écart de ${fmtDA(ecart58)} sur les virements de fonds internes (Solde non nul de ${fmtDA(soldeFin58)} à rapprocher d'urgence).`
  });

  // Score global des flux croisés
  const totalConformesFlux = regles.filter(r => r.statut === 'CONFORME').length;
  const totalAnomaliesFlux = regles.filter(r => r.statut === 'ANOMALIE').length;
  const totalAtypiquesFlux = regles.filter(r => r.statut === 'ATYPIQUE' || r.statut === 'TOLERANCE').length;
  const totalNonMouvFlux   = regles.filter(r => r.statut === 'NON_MOUVEMENTE').length;

  // Calcul du score proportionnel réel sur les règles actives
  const reglesActives = regles.filter(r => r.statut !== 'NON_MOUVEMENTE');
  const baseCalcul = reglesActives.length > 0 ? reglesActives.length : regles.length;

  // Points : Conforme = 100%, Tolérance/Atypique = 50%, Anomalie = 0%
  const scoreFlux = baseCalcul > 0
    ? Math.min(100, Math.max(0, Math.round(((totalConformesFlux + totalAtypiquesFlux * 0.5) / baseCalcul) * 100)))
    : 100;

  return {
    regles,
    scoreFlux,
    totalAnomaliesFlux,
    totalAtypiquesFlux,
    totalConformesFlux,
    totalNonMouvFlux
  };
}

export function calculateStockEvolution(rows) {
  if (!rows || !Array.isArray(rows)) return { categories: [], totalInitial: 0, totalFinal: 0, totalVariation: 0, totalPctVariation: 0, globalMouvement: 'STABLE' };

  const categoriesDef = [
    { code: '30', label: '30 — Stock de Marchandises', type: 'appro', icon: 'inventory_2' },
    { code: '31', label: '31 — Matières Premières & Fournitures', type: 'appro', icon: 'category' },
    { code: '32', label: '32 — Autres Approvisionnements', type: 'appro', icon: 'box' },
    { code: '33', label: '33 — En-cours de Production de Biens', type: 'prod', icon: 'precision_manufacturing' },
    { code: '34', label: '34 — En-cours de Production de Services', type: 'prod', icon: 'engineering' },
    { code: '35', label: '35 — Stocks de Produits (Finis, Semis...)', type: 'prod', icon: 'widgets' },
    { code: '37', label: '37 — Stocks en Transit / à l\'Extérieur', type: 'appro', icon: 'local_shipping' },
    { code: '38', label: '38 — Achats Stockés', type: 'appro', icon: 'shopping_cart' },
  ];

  let totalInitial = 0;
  let totalFinal = 0;

  const categories = categoriesDef.map(cat => {
    let stockInitial = 0;
    let stockFinal = 0;
    let comptesDetails = [];

    rows.forEach(r => {
      if (!r.compte || r.ignore) return;
      const c = r.compte.toString().trim();
      if (c.startsWith(cat.code) && !c.startsWith('39')) {
        const init = (r.soldeDebutDebit || 0) - (r.soldeDebutCredit || 0);
        const fin  = (r.soldeFinDebit || 0) - (r.soldeFinCredit || 0);
        stockInitial += init;
        stockFinal += fin;

        if (Math.abs(init) > 0.01 || Math.abs(fin) > 0.01) {
          const varAmt = fin - init;
          const varPct = init !== 0 ? (varAmt / Math.abs(init)) * 100 : (varAmt > 0 ? 100 : 0);
          comptesDetails.push({
            compte: c,
            libelle: r.libelle,
            init,
            fin,
            variation: varAmt,
            pctVariation: varPct
          });
        }
      }
    });

    totalInitial += stockInitial;
    totalFinal += stockFinal;

    const variation = stockFinal - stockInitial;
    const pctVariation = stockInitial !== 0 ? (variation / Math.abs(stockInitial)) * 100 : (variation > 0 ? 100 : 0);

    let mouvement = 'STABLE';
    let badgeCls = 'badge-blue';
    let impactSCF = 'Aucun impact';

    if (variation > 0.01) {
      mouvement = 'STOCKAGE';
      badgeCls = 'badge-green';
      impactSCF = cat.type === 'appro'
        ? 'Réduction des charges consommées (Compte 603)'
        : 'Augmentation de la production (Compte 72)';
    } else if (variation < -0.01) {
      mouvement = 'DÉSTOCKAGE';
      badgeCls = 'badge-red';
      impactSCF = cat.type === 'appro'
        ? 'Augmentation des charges consommées (Compte 603)'
        : 'Réduction de la production de l\'exercice (Compte 72)';
    }

    return {
      code: cat.code,
      label: cat.label,
      type: cat.type,
      icon: cat.icon,
      stockInitial,
      stockFinal,
      variation,
      pctVariation,
      mouvement,
      badgeCls,
      impactSCF,
      comptesDetails,
      hasData: Math.abs(stockInitial) > 0.01 || Math.abs(stockFinal) > 0.01 || comptesDetails.length > 0
    };
  }).filter(c => c.hasData);

  const totalVariation = totalFinal - totalInitial;
  const totalPctVariation = totalInitial !== 0 ? (totalVariation / Math.abs(totalInitial)) * 100 : (totalVariation > 0 ? 100 : 0);

  let globalMouvement = 'STABLE';
  if (totalVariation > 0.01) globalMouvement = 'STOCKAGE';
  else if (totalVariation < -0.01) globalMouvement = 'DÉSTOCKAGE';

  return { categories, totalInitial, totalFinal, totalVariation, totalPctVariation, globalMouvement };
}


export const parseFile = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let data;
        if (file.name.endsWith('.csv')) {
          // Détecter le délimiteur : si la première ligne contient plus de ";" que de ",", c'est un CSV français
          const firstLine = e.target.result.split('\n')[0] || '';
          const semicolonCount = (firstLine.match(/;/g) || []).length;
          const commaCount = (firstLine.match(/,/g) || []).length;
          const delimiter = semicolonCount >= commaCount ? ';' : ',';

          // Split direct par ligne puis par délimiteur pour éviter tout conflit avec les guillemets (comme Amor.E"convoyeurs)
          const lines = e.target.result.split(/\r?\n/);
          data = lines
            .filter(line => line.trim() !== '')
            .map(line => {
              return line.split(delimiter).map(cell => {
                let cleaned = cell.trim();
                // Supprimer les guillemets entourant la cellule si présents
                if (cleaned.startsWith('"')) {
                  cleaned = cleaned.slice(1);
                }
                if (cleaned.endsWith('"')) {
                  cleaned = cleaned.slice(0, -1);
                }
                return cleaned.trim();
              });
            });
        } else {
          // Utiliser xlsx pour Excel (en mode tableau 2D)
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1 });
        }
        
        // Trouver la ligne d'en-tête — cherche la ligne qui contient "Compte"
        // Parfois l'en-tête est sur 2 lignes (ex: "Solde Fin" sur une ligne, "Débit" sur la suivante)
        // On fusionne donc deux lignes consécutives pour créer un en-tête combiné
        let headerRowIndex = -1;
        let colMap = {};
        
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          if (!row || !Array.isArray(row)) continue;

          const rowText = row.map(cell => String(cell || '').toLowerCase().trim());
          const compteIdx = rowText.findIndex(t => t.includes('compte'));
          if (compteIdx === -1) continue;

          // En-tête trouvé. Fusionner avec la ligne suivante si elle existe (cas 2 lignes)
          headerRowIndex = i;
          const nextRow = data[i + 1] ? data[i + 1].map(cell => String(cell || '').toLowerCase().trim()) : [];
          const combined = rowText.map((t, idx) => (t + ' ' + (nextRow[idx] || '')).trim());

          // Recherche des colonnes par mots-clés sur l'en-tête combiné
          colMap.compte = compteIdx;
          colMap.libelle = combined.findIndex(t => t.includes('libell') || t.includes('désignation') || t.includes('designation'));
          if (colMap.libelle === -1) colMap.libelle = compteIdx + 1;

          // Détecter TOUTES les colonnes de solde et débit/crédit
          const findColIdx = (keywords, excludeKeywords = []) => {
            return combined.findIndex(t => 
              keywords.every(kw => t.includes(kw)) &&
              excludeKeywords.every(ex => !t.includes(ex))
            );
          };

          // Structure avec 2 lignes d'en-tête : les sous-colonnes (débit/crédit) sont sur la 2ème ligne
          // On cherche d'abord en combinant les 2 lignes, sinon on utilise la position

          // Chercher les indices de chaque groupe de colonnes
          let soldeDebutDebitIdx  = findColIdx(['solde', 'début', 'débit']);
          let soldeDebutCreditIdx = findColIdx(['solde', 'début', 'crédit']);
          let mouvDebitIdx        = findColIdx(['mouvement', 'débit']);
          let mouvCreditIdx       = findColIdx(['mouvement', 'crédit']);
          let soldePeriodeDebitIdx  = findColIdx(['période', 'débit']);
          let soldePeriodeCreditIdx = findColIdx(['période', 'crédit']);
          let soldeFinDebitIdx    = findColIdx(['fin', 'débit']);
          let soldeFinCreditIdx   = findColIdx(['fin', 'crédit']);

          // Essayer aussi les variantes sans accent
          if (soldeDebutDebitIdx  === -1) soldeDebutDebitIdx  = findColIdx(['solde', 'debut', 'debit']);
          if (soldeDebutCreditIdx === -1) soldeDebutCreditIdx = findColIdx(['solde', 'debut', 'credit']);
          if (mouvDebitIdx        === -1) mouvDebitIdx        = findColIdx(['mouv', 'debit']);
          if (mouvCreditIdx       === -1) mouvCreditIdx       = findColIdx(['mouv', 'credit']);
          if (soldePeriodeDebitIdx  === -1) soldePeriodeDebitIdx  = findColIdx(['periode', 'debit']);
          if (soldePeriodeCreditIdx === -1) soldePeriodeCreditIdx = findColIdx(['periode', 'credit']);
          if (soldeFinDebitIdx    === -1) soldeFinDebitIdx    = findColIdx(['fin', 'debit']);
          if (soldeFinCreditIdx   === -1) soldeFinCreditIdx   = findColIdx(['fin', 'credit']);

          // Si détection par mots-clés a réussi pour Solde Fin → utiliser
          if (soldeFinDebitIdx !== -1 && soldeFinCreditIdx !== -1) {
            colMap.soldeDebutDebitIdx  = soldeDebutDebitIdx;
            colMap.soldeDebutCreditIdx = soldeDebutCreditIdx;
            colMap.mouvDebitIdx        = mouvDebitIdx;
            colMap.mouvCreditIdx       = mouvCreditIdx;
            colMap.soldePeriodeDebitIdx  = soldePeriodeDebitIdx;   // peut être -1 si absent
            colMap.soldePeriodeCreditIdx = soldePeriodeCreditIdx;  // peut être -1 si absent
            colMap.soldeFinDebitIdx    = soldeFinDebitIdx;
            colMap.soldeFinCreditIdx   = soldeFinCreditIdx;
          } else {
            // Fallback : structure connue. Détecter si 8 ou 10 colonnes selon la présence de "période"
            const hasPeriode = combined.some(t => t.includes('période') || t.includes('periode'));
            const base = compteIdx + 2; // après Compte et Libellé
            colMap.soldeDebutDebitIdx  = base;
            colMap.soldeDebutCreditIdx = base + 1;
            colMap.mouvDebitIdx        = base + 2;
            colMap.mouvCreditIdx       = base + 3;
            if (hasPeriode) {
              colMap.soldePeriodeDebitIdx  = base + 4;
              colMap.soldePeriodeCreditIdx = base + 5;
              colMap.soldeFinDebitIdx      = base + 6;
              colMap.soldeFinCreditIdx     = base + 7;
            } else {
              colMap.soldePeriodeDebitIdx  = -1;
              colMap.soldePeriodeCreditIdx = -1;
              colMap.soldeFinDebitIdx      = base + 4;
              colMap.soldeFinCreditIdx     = base + 5;
            }
          }

          // Si l'en-tête était sur 2 lignes, sauter la 2ème ligne aussi
          if (nextRow.length > 0 && (nextRow.some(t => t.includes('débit') || t.includes('debit') || t.includes('crédit') || t.includes('credit')))) {
            headerRowIndex = i + 1; // les données commencent après la 2ème ligne d'en-tête
          }

          break;
        }

        if (headerRowIndex === -1) {
          return reject(new Error("Impossible de trouver la ligne d'en-tête (la colonne 'Compte' est introuvable)."));
        }

        const normalized = [];
        for (let i = headerRowIndex + 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length === 0) continue;
          
          const compte = String(row[colMap.compte] || '').trim();
          const libelle = String(row[colMap.libelle] || '').trim();
          
          const parseNumber = (val) => {
            if (typeof val === 'number') return val;
            if (!val) return 0;
            return parseFloat(String(val).replace(/\s/g, '').replace(',', '.')) || 0;
          };

          const getCol = (idx) => idx !== -1 ? parseNumber(row[idx]) : 0;

          const soldeDebutDebit  = getCol(colMap.soldeDebutDebitIdx);
          const soldeDebutCredit = getCol(colMap.soldeDebutCreditIdx);
          const mouvementDebit   = getCol(colMap.mouvDebitIdx);
          const mouvementCredit  = getCol(colMap.mouvCreditIdx);
          // Solde Période : détecté mais IGNORÉ du calcul (on utilise Solde Fin uniquement)
          const soldeFinDebit    = getCol(colMap.soldeFinDebitIdx);
          const soldeFinCredit   = getCol(colMap.soldeFinCreditIdx);

          const debit  = soldeFinDebit;
          const credit = soldeFinCredit;
          const solde  = debit - credit;

          const isTotal = !compte || compte.toLowerCase().includes('total') || libelle.toLowerCase().includes('total') || libelle.toLowerCase().includes('sous-total');
          
          if (compte || libelle || soldeFinDebit !== 0 || soldeFinCredit !== 0 || soldeDebutDebit !== 0) {
            normalized.push({ 
              compte, 
              libelle, 
              soldeDebutDebit, 
              soldeDebutCredit,
              mouvementDebit,
              mouvementCredit,
              soldeFinDebit,
              soldeFinCredit,
              debit, 
              credit, 
              solde, 
              isTotal, 
              ignore: isTotal 
            });
          }
        }
        
        resolve(normalized);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsBinaryString(file);
    }
  });
};

export const calculateBilanFonctionnel = (data) => {
  if (data && data.isManual && data.bilanActif) {
    const act = data.bilanActif;
    const emploisStables = (Number(act[0].brutN) || 0) + (Number(act[1].brutN) || 0) + (Number(act[2].brutN) || 0);
    const actifCirculant = (Number(act[3].brutN) || 0) + (Number(act[4].brutN) || 0);
    const tresorerieActive = (Number(act[5].brutN) || 0);
    const totalAmort = act.reduce((sum, item) => sum + (Number(item.amortN) || 0), 0);
    const ressourcesStables = 150000 + totalAmort; 
    const passifCirculant = 50000; 
    const tresoreriePassive = 5000; 

    return {
      emploisStables, ressourcesStables, actifCirculant, passifCirculant, tresorerieActive, tresoreriePassive,
      frng: ressourcesStables - emploisStables,
      bfr: actifCirculant - passifCirculant,
      tn: tresorerieActive - tresoreriePassive
    };
  }

  if (data && data.isBalance && data.rows) {
    let emploisStables = 0;
    let ressourcesStables = 0;
    let actifCirculant = 0;
    let passifCirculant = 0;
    let tresorerieActive = 0;
    let tresoreriePassive = 0;

    // Calculer le Résultat Net à partir des classes 6 et 7 pour équilibrer si nécessaire
    let sum6 = 0;
    let sum7 = 0;

    data.rows.forEach(row => {
      if (row.ignore || !row.compte) return;
      const c = row.compte.toString().trim();
      const solde = row.solde || 0; // debit - credit (positif = debiteur, negatif = crediteur)

      if (c.startsWith('6')) {
        sum6 += solde;
      } else if (c.startsWith('7')) {
        sum7 += solde;
      }
    });

    const resultatNetCalcule = -(sum6 + sum7);

    data.rows.forEach(row => {
      if (row.ignore || !row.compte) return;
      const c = row.compte.toString().trim();
      const solde = row.solde || 0;

      // 1. Amortissements et Dépréciations de l'actif (28, 29, 39, 49, 59)
      if (c.startsWith('28') || c.startsWith('29') || c.startsWith('39') || c.startsWith('49') || c.startsWith('59')) {
        ressourcesStables += -solde;
      }
      // 2. Ressources Stables ordinaires (Classe 1)
      else if (c.startsWith('1')) {
        ressourcesStables += -solde;
      }
      // 3. Emplois Stables ordinaires (Classe 2 excepté 28, 29)
      else if (c.startsWith('2')) {
        emploisStables += solde;
      }
      // 4. Stocks brut (Classe 3 excepté 39)
      else if (c.startsWith('3')) {
        actifCirculant += solde;
      }
      // 5. Comptes de Tiers (Classe 4 excepté 49)
      else if (c.startsWith('4')) {
        if (solde > 0) {
          actifCirculant += solde;
        } else {
          passifCirculant += -solde;
        }
      }
      // 6. Trésorerie (Classe 5 excepté 59)
      else if (c.startsWith('5')) {
        if (c.startsWith('519') || solde < 0) {
          tresoreriePassive += -solde;
        } else {
          tresorerieActive += solde;
        }
      }
    });

    // Ajouter le résultat net calculé aux ressources stables pour équilibrer le bilan
    // si des charges/produits (classes 6/7) ont été trouvés dans la balance
    if (Math.abs(resultatNetCalcule) > 0.01) {
      ressourcesStables += resultatNetCalcule;
    }

    return {
      emploisStables, ressourcesStables, actifCirculant, passifCirculant, tresorerieActive, tresoreriePassive,
      frng: ressourcesStables - emploisStables,
      bfr: actifCirculant - passifCirculant,
      tn: tresorerieActive - tresoreriePassive
    };
  }

  return { emploisStables: 0, ressourcesStables: 0, actifCirculant: 0, passifCirculant: 0, tresorerieActive: 0, tresoreriePassive: 0, frng: 0, bfr: 0, tn: 0 };
};

export const calculateSIG = (data) => {
  if (data && data.isBalance && data.rows) {
    // Rubriques officielles du TCR par Nature (SCF Algérie)
    let c70 = 0; // Ventes et produits annexes (CA)
    let c72 = 0; // Variation des stocks de produits finis et en-cours
    let c73 = 0; // Production immobilisée
    let c74 = 0; // Subventions d'exploitation

    let c60 = 0; // Achats consommés
    let c61 = 0; // Services extérieurs
    let c62 = 0; // Autres services extérieurs

    let c63 = 0; // Charges de personnel (SCF)
    let c64 = 0; // Impôts, taxes et versements assimilés (SCF)

    let c75 = 0; // Autres produits opérationnels
    let c65 = 0; // Autres charges opérationnelles
    let c68_expl = 0; // Dotations aux amortissements/provisions (exploitation)
    let c78_expl = 0; // Reprises sur pertes de valeur et provisions (exploitation)

    let c76 = 0; // Produits financiers
    let c66 = 0; // Charges financières
    let c68_fina = 0; // Dotations financières (686)
    let c78_fina = 0; // Reprises financières (786)

    let c69 = 0; // Impôts sur les bénéfices (IBS 695/698 & Impôts différés 692/693)

    let c77 = 0; // Produits extraordinaires
    let c67 = 0; // Charges extraordinaires

    data.rows.forEach(row => {
      if (row.ignore || !row.compte) return;
      const c = row.compte.toString().trim();
      const solde = row.solde || 0; // solde = debit - credit (debiteur > 0, crediteur < 0)

      // ── CLASSE 6 : CHARGES (solde débiteur = positif) ──
      if (c.startsWith('6')) {
        const val = solde;

        if (c.startsWith('60'))       c60 += val;
        else if (c.startsWith('61'))  c61 += val;
        else if (c.startsWith('62'))  c62 += val;
        else if (c.startsWith('63'))  c63 += val; // Personnel en SCF
        else if (c.startsWith('64'))  c64 += val; // Impôts/Taxes en SCF
        else if (c.startsWith('65'))  c65 += val;
        else if (c.startsWith('66'))  c66 += val;
        else if (c.startsWith('67'))  c67 += val;
        else if (c.startsWith('68')) {
          if (c.startsWith('686')) c68_fina += val;
          else c68_expl += val;
        }
        else if (c.startsWith('69'))  c69 += val;
        else c65 += val; // fallback charges
      }
      // ── CLASSE 7 : PRODUITS (solde créditeur = négatif en base → inverser) ──
      else if (c.startsWith('7')) {
        const val = -solde;

        if (c.startsWith('70'))       c70 += val;
        else if (c.startsWith('72'))  c72 += val;
        else if (c.startsWith('73'))  c73 += val;
        else if (c.startsWith('74'))  c74 += val;
        else if (c.startsWith('75'))  c75 += val;
        else if (c.startsWith('76'))  c76 += val;
        else if (c.startsWith('77'))  c77 += val;
        else if (c.startsWith('78')) {
          if (c.startsWith('786')) c78_fina += val;
          else c78_expl += val;
        }
        else if (c.startsWith('71'))  c72 += val; // 71 en PCG → équivalent 72 en SCF
        else c75 += val; // fallback produits
      }
    });

    // ── CASCADE DES SOLDES DU TCR SELON LE SCF ──
    const chiffreAffaires = c70;
    const productionExercice = c70 + c72 + c73 + c74;
    const consommationExercice = c60 + c61 + c62;
    const margeCommerciale = c70 - c60; // Indicatif pour activités commerciales
    const valeurAjoutee = productionExercice - consommationExercice;
    const chargesPersonnel = c63;
    const impotsTaxes = c64;
    const ebe = valeurAjoutee - (c63 + c64);

    const autresProduitsOp = c75;
    const autresChargesOp = c65;
    const dotationsExploitation = c68_expl;
    const reprisesExploitation = c78_expl;
    const resultatExploitation = ebe + c75 - c65 - c68_expl + c78_expl;

    const produitsFinanciers = c76 + c78_fina;
    const chargesFinancieres = c66 + c68_fina;
    const resultatFinancier = produitsFinanciers - chargesFinancieres;

    const rcai = resultatExploitation + resultatFinancier;
    const impotsBenefices = c69;
    const resultatNetOrdinaire = rcai - c69;

    const resultatExtraordinaire = c77 - c67;
    const resultatNet = resultatNetOrdinaire + resultatExtraordinaire;

    // Capacité d'Autofinancement (CAF) selon la méthode soustractive SCF
    const caf = ebe + c75 - c65 + c76 - c66 - c69;

    return {
      chiffreAffaires,
      productionExercice,
      consommationExercice,
      margeCommerciale,
      valeurAjoutee,
      chargesPersonnel,
      impotsTaxes,
      ebe,
      autresProduitsOp,
      autresChargesOp,
      dotationsExploitation,
      reprisesExploitation,
      resultatExploitation,
      produitsFinanciers,
      chargesFinancieres,
      resultatFinancier,
      rcai,
      impotsBenefices,
      resultatNetOrdinaire,
      resultatExtraordinaire,
      resultatNet,
      caf,
      achats: c60, // Achats consommés (Compte 60)
      // Détail des comptes de charges/produits pour les vues
      c70, c72, c73, c74, c60, c61, c62, c63, c64, c75, c65, c68_expl, c78_expl, c76, c66, c69, c77, c67
    };
  }

  return {
    chiffreAffaires: 0, productionExercice: 0, consommationExercice: 0, margeCommerciale: 0,
    valeurAjoutee: 0, chargesPersonnel: 0, impotsTaxes: 0, ebe: 0, autresProduitsOp: 0,
    autresChargesOp: 0, dotationsExploitation: 0, reprisesExploitation: 0, resultatExploitation: 0,
    produitsFinanciers: 0, chargesFinancieres: 0, resultatFinancier: 0, rcai: 0, impotsBenefices: 0,
    resultatNetOrdinaire: 0, resultatExtraordinaire: 0, resultatNet: 0, caf: 0, achats: 0
  };
};

export const calculateRatios = (bilan, sig, rows) => {
  const totalBilan = (bilan.emploisStables || 0) + (bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0);
  const denomLiquidite = (bilan.passifCirculant || 0) + (bilan.tresoreriePassive || 0);

  let creancesClients = 0;
  let stocks = 0;
  let dettesFournisseurs = 0;
  let stockInitialTotal = 0;
  let stockFinalTotal = 0;
  let capitauxPropres = 0;
  let dettesFinancieresLT = 0;

  if (rows && Array.isArray(rows)) {
    rows.forEach(row => {
      if (row.ignore || !row.compte) return;
      const c = row.compte.toString().trim();
      const solde = row.solde || 0;

      // Créances clients (Compte 41x hors 419)
      if (c.startsWith('41') && !c.startsWith('419')) {
        const soldeNet = solde > 0 ? solde : ((row.soldeFinDebit || 0) - (row.soldeFinCredit || 0));
        if (soldeNet > 0) creancesClients += soldeNet;
      }
      
      // Stocks (Compte 3x hors 39)
      if (c.startsWith('3') && !c.startsWith('39')) {
        const init = (row.soldeDebutDebit || 0) - (row.soldeDebutCredit || 0);
        const fin  = (row.soldeFinDebit || 0) - (row.soldeFinCredit || 0);
        if (init > 0) stockInitialTotal += init;
        if (fin > 0)  stockFinalTotal += fin;
        const soldeNet = solde > 0 ? solde : fin;
        if (soldeNet > 0) stocks += soldeNet;
      }

      // Dettes Fournisseurs (Compte 40x hors 409 et 406)
      if (c.startsWith('40') && !c.startsWith('409') && !c.startsWith('406')) {
        const soldeNet = solde < 0 ? -solde : ((row.soldeFinCredit || 0) - (row.soldeFinDebit || 0));
        if (soldeNet > 0) dettesFournisseurs += soldeNet;
      }

      // Capitaux Propres (Comptes 10, 11, 12, 13, 14, 15)
      if (c.startsWith('10') || c.startsWith('11') || c.startsWith('12') || c.startsWith('13') || c.startsWith('14') || c.startsWith('15')) {
        capitauxPropres += -solde;
      }

      // Emprunts et dettes financières LT (Compte 16)
      if (c.startsWith('16')) {
        dettesFinancieresLT += -solde;
      }
    });
  }

  // Fallback si capitaux propres non décomposés
  if (capitauxPropres === 0 && (bilan.ressourcesStables || 0) > 0) {
    capitauxPropres = (bilan.ressourcesStables || 0) * 0.7;
  }

  const ca = sig.chiffreAffaires || 0;
  const achats = sig.achats || sig.c60 || 0;
  const consoExercice = sig.consommationExercice || ((sig.c60 || 0) + (sig.c61 || 0) + (sig.c62 || 0));
  const ebe = sig.ebe || 0;
  const va = sig.valeurAjoutee || 0;
  const re = sig.resultatExploitation || 0;
  const rn = sig.resultatNet || 0;
  const chargesFin = sig.chargesFinancieres || 0;
  const chargesPers = sig.chargesPersonnel || sig.c63 || 0;

  // Stock Moyen (si stock initial disponible, sinon stock final)
  const stockMoyen = (stockInitialTotal > 0 && stockFinalTotal > 0)
    ? (stockInitialTotal + stockFinalTotal) / 2
    : (stocks || stockFinalTotal || 0);

  // Rotation des stocks (jours) = (Stock Moyen / Achats) * 360
  const rotationStocks = achats === 0 ? 0 : (stockMoyen / achats) * 360;
  const tauxRotationStocks = stockMoyen === 0 ? 0 : achats / stockMoyen;

  // Délai de recouvrement des créances clients (jours) = (Créances Clients / CA) * 360
  const delaiRecouvrement = ca === 0 ? 0 : (creancesClients / ca) * 360;
  const tauxRotationCreances = creancesClients === 0 ? 0 : ca / creancesClients;

  // Délai de règlement fournisseurs (jours) = (Dettes Fournisseurs / Consommation) * 360
  const delaiFournisseurs = (consoExercice || achats) === 0 ? 0 : (dettesFournisseurs / (consoExercice || achats)) * 360;

  // BFR exprimé en jours de CA
  const bfrJoursCA = ca === 0 ? 0 : ((bilan.bfr || 0) / ca) * 360;

  // Ratios de liquidité
  const liquiditeGenerale = denomLiquidite === 0 ? 0 : ((bilan.actifCirculant || 0) + (bilan.tresorerieActive || 0)) / denomLiquidite;
  const liquiditeReduite = denomLiquidite === 0 ? 0 : (creancesClients + (bilan.tresorerieActive || 0)) / denomLiquidite;
  const liquiditeImmediate = denomLiquidite === 0 ? 0 : (bilan.tresorerieActive || 0) / denomLiquidite;

  // Ratios de rentabilité et rendement
  const rentabiliteNette = ca === 0 ? 0 : rn / ca;
  const margeEBE = ca === 0 ? 0 : ebe / ca;
  const tauxVA = ca === 0 ? 0 : va / ca;
  const roe = capitauxPropres === 0 ? 0 : rn / capitauxPropres;
  const roa = totalBilan === 0 ? 0 : re / totalBilan;

  // Structure et solvabilité
  const autonomieFinanciere = totalBilan === 0 ? 0 : (bilan.ressourcesStables || 0) / totalBilan;
  const poidsPersonnel = va === 0 ? 0 : chargesPers / va;
  const couvertureChargesFin = chargesFin > 0 ? ebe / chargesFin : 99;

  return {
    liquiditeGenerale,
    liquiditeReduite,
    liquiditeImmediate,
    autonomieFinanciere,
    rentabiliteNette,
    margeEBE,
    tauxVA,
    roe,
    roa,
    poidsPersonnel,
    couvertureChargesFin,
    delaiRecouvrement,
    tauxRotationCreances,
    rotationStocks,
    tauxRotationStocks,
    delaiFournisseurs,
    bfrJoursCA,
    creancesClients,
    stocks,
    stockMoyen,
    stockInitialTotal,
    stockFinalTotal,
    dettesFournisseurs,
    capitauxPropres,
    dettesFinancieresLT,
    achats,
    chiffreAffaires: ca
  };
};
