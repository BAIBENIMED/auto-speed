import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { MODEL_TEMPLATES, createSimulationEntryFromLines, recalculateSimulatedDataset } from '../utils/simulationEngine';

export function WhatIfSimulator({ data, simulationEntries = [], setSimulationEntries, isSimulationActive, setIsSimulationActive, formatCurrency }) {
  // Mode Modèles Repliable
  const [showTemplates, setShowTemplates]   = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tous');

  // Saisie Rapide 1-Clic
  const [quickOpType, setQuickOpType]       = useState('vente');
  const [quickAmount, setQuickAmount]       = useState(5000000); // 5 Millions DA par défaut
  const [quickCounterpart, setQuickCounterpart] = useState('512');

  // Éditeur Multiligne Avancé
  const [editingId, setEditingId]           = useState(null);
  const [isEditorOpen, setIsEditorOpen]     = useState(false);
  const [opLabel, setOpLabel]               = useState('Nouvelle opération');

  // Lignes Débit/Crédit de l'écriture en cours dans l'éditeur
  const [editorLines, setEditorLines]       = useState([
    { compte: '411', libelle: 'Clients & comptes rattachés', debit: 5000000, credit: 0 },
    { compte: '700', libelle: 'Ventes de marchandises', debit: 0, credit: 5000000 },
  ]);

  const fmt = formatCurrency || ((v) => (v || 0).toLocaleString('fr-FR') + ' DA');
  const fmtPct = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

  if (!data || !data.sig || !data.bilan) {
    return (
      <div className="card fade-in" style={{ maxWidth: 480, margin: '40px auto', textAlign: 'center', padding: 40 }}>
        <span className="material-symbols-outlined" style={{ fontSize: 48, color: 'var(--text-sub)', marginBottom: 12 }}>tune</span>
        <h3 style={{ fontWeight: 800 }}>Simulateur non disponible</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Veuillez importer une balance comptable pour lancer des simulations en partie double.</p>
      </div>
    );
  }

  // --- SAISIE RAPIDE EN 1 CLIC ---
  const handleQuickAdd = () => {
    const amt = Number(quickAmount) || 0;
    if (amt <= 0) return;

    let label = '';
    let lines = [];

    switch (quickOpType) {
      case 'vente':
        label = `Augmentation du CA (+${fmt(amt)})`;
        lines = [
          { compte: quickCounterpart, libelle: quickCounterpart === '411' ? 'Clients (Créance)' : quickCounterpart === '530' ? 'Caisse (Espèces)' : 'Banque (Trésorerie)', debit: amt, credit: 0 },
          { compte: '700', libelle: 'Ventes de marchandises (CA)', debit: 0, credit: amt },
        ];
        break;
      case 'achat':
        label = `Augmentation des Achats (+${fmt(amt)})`;
        lines = [
          { compte: '600', libelle: 'Achats consommés (Charges)', debit: amt, credit: 0 },
          { compte: quickCounterpart, libelle: quickCounterpart === '401' ? 'Fournisseurs (Dette)' : quickCounterpart === '300' ? 'Stock' : 'Banque', debit: 0, credit: amt },
        ];
        break;
      case 'salaires':
        label = `Augmentation des Salaires (+${fmt(amt)})`;
        lines = [
          { compte: '630', libelle: 'Charges de personnel (Salaires)', debit: amt, credit: 0 },
          { compte: quickCounterpart, libelle: quickCounterpart === '421' ? 'Personnel - Rémunérations dues' : 'Banque (Virement direct)', debit: 0, credit: amt },
        ];
        break;
      case 'immo':
        label = `Acquisition d'Immobilisation (+${fmt(amt)})`;
        lines = [
          { compte: '210', libelle: 'Immobilisations corporelles', debit: amt, credit: 0 },
          { compte: quickCounterpart, libelle: quickCounterpart === '404' ? 'Fournisseurs d\'Immo' : quickCounterpart === '164' ? 'Emprunt bancaire' : 'Banque', debit: 0, credit: amt },
        ];
        break;
      case 'emprunt':
        label = `Souscription Emprunt Bancaire (+${fmt(amt)})`;
        lines = [
          { compte: '512', libelle: 'Banque (Trésorerie active)', debit: amt, credit: 0 },
          { compte: '164', libelle: 'Emprunts auprès des établissements de crédit', debit: 0, credit: amt },
        ];
        break;
      case 'recouvrement':
        label = `Encaissement Client (-DSO / +Trésorerie ${fmt(amt)})`;
        lines = [
          { compte: '512', libelle: 'Banque (Encaissement reçu)', debit: amt, credit: 0 },
          { compte: '411', libelle: 'Clients & comptes rattachés', debit: 0, credit: amt },
        ];
        break;
      case 'reglement':
        label = `Règlement Fournisseur (-DPO / -Trésorerie ${fmt(amt)})`;
        lines = [
          { compte: '401', libelle: 'Fournisseurs & comptes rattachés', debit: amt, credit: 0 },
          { compte: '512', libelle: 'Banque (Décaissement)', debit: 0, credit: amt },
        ];
        break;
      default:
        break;
    }

    if (lines.length > 0) {
      const newEntry = createSimulationEntryFromLines({ label, lines });
      setSimulationEntries(prev => [...prev, newEntry]);
      if (setIsSimulationActive) setIsSimulationActive(true);
    }
  };

  // --- OUVRIER / FERMER L'ÉDITEUR ---
  const handleOpenNewEditor = () => {
    setEditingId(null);
    setOpLabel('Nouvelle opération comptable');
    setEditorLines([
      { compte: '411', libelle: 'Clients & comptes rattachés', debit: 5000000, credit: 0 },
      { compte: '700', libelle: 'Ventes de marchandises', debit: 0, credit: 5000000 },
    ]);
    setIsEditorOpen(true);
  };

  const handleOpenEditEditor = (entry) => {
    setEditingId(entry.id);
    setOpLabel(entry.label);
    if (entry.lines && entry.lines.length > 0) {
      setEditorLines(entry.lines.map(l => ({ ...l })));
    } else {
      setEditorLines([
        { compte: entry.debitCompte || '411', libelle: 'Débit', debit: entry.montant, credit: 0 },
        { compte: entry.creditCompte || '700', libelle: 'Crédit', debit: 0, credit: entry.montant },
      ]);
    }
    setIsEditorOpen(true);
  };

  // --- CHARGER UN MODÈLE EN 1 CLIC ---
  const handleApplyTemplate = (tpl) => {
    const newEntry = createSimulationEntryFromLines({
      label: tpl.name,
      lines: tpl.lines,
    });
    setSimulationEntries(prev => [...prev, newEntry]);
    if (setIsSimulationActive) setIsSimulationActive(true);
    setShowTemplates(false);
  };

  // --- HANDLERS ÉDITEUR LIGNES ---
  const handleAddLine = (type = 'debit') => {
    if (type === 'debit') {
      setEditorLines(prev => [...prev, { compte: '600', libelle: 'Charge ou Débit', debit: 1000000, credit: 0 }]);
    } else {
      setEditorLines(prev => [...prev, { compte: '512', libelle: 'Banque ou Crédit', debit: 0, credit: 1000000 }]);
    }
  };

  const handleRemoveLine = (idx) => {
    if (editorLines.length <= 2) return;
    setEditorLines(prev => prev.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx, field, val) => {
    setEditorLines(prev => prev.map((l, i) => {
      if (i === idx) {
        return { ...l, [field]: val };
      }
      return l;
    }));
  };

  // Calcul équilibre Débit vs Crédit
  const sumDebit  = editorLines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const sumCredit = editorLines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const diffDC     = Math.abs(sumDebit - sumCredit);
  const isBalanced = diffDC < 0.01;

  // --- SAUVEGARDER L'ÉCRITURE DANS LE JOURNAL ---
  const handleSaveEntry = () => {
    if (!isBalanced) return;

    if (editingId) {
      setSimulationEntries(prev => prev.map(e => {
        if (e.id === editingId) {
          const cleanLines = editorLines.map(l => ({
            compte: String(l.compte).trim(),
            libelle: String(l.libelle).trim(),
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          }));
          const maxM = Math.max(sumDebit, sumCredit);
          return {
            ...e,
            label: opLabel.trim() || 'Opération modifiée',
            lines: cleanLines,
            montant: maxM,
            isBalanced: true,
          };
        }
        return e;
      }));
    } else {
      const newEntry = createSimulationEntryFromLines({
        label: opLabel.trim() || 'Nouvelle opération',
        lines: editorLines,
      });
      setSimulationEntries(prev => [...prev, newEntry]);
    }

    if (setIsSimulationActive) setIsSimulationActive(true);
    setIsEditorOpen(false);
  };

  // --- SUPPRIMER UNE ÉCRITURE ---
  const handleRemoveEntry = (id) => {
    setSimulationEntries(prev => prev.filter(e => e.id !== id));
  };

  // Recalcul du dataset simulé
  const simulatedData = recalculateSimulatedDataset(data, simulationEntries);

  // Indicateurs financiers
  const baseCA  = data.sig.chiffreAffaires || 1;
  const baseEBE = data.sig.ebe || 0;
  const baseNet = data.sig.resultatNet || 0;
  const baseBFR = data.bilan.bfr || 0;
  const baseTN  = data.bilan.tn || 0;

  const simCA  = simulatedData.sig.chiffreAffaires || 0;
  const simEBE = simulatedData.sig.ebe || 0;
  const simNet = simulatedData.sig.resultatNet || 0;
  const simBFR = simulatedData.bilan.bfr || 0;
  const simTN  = simulatedData.bilan.tn || 0;

  const totalSimulatedDebit = simulationEntries.reduce((sum, e) => sum + (Number(e.montant) || 0), 0);

  const categories = ['Tous', 'Ventes', 'Achats', 'Personnel', 'Investissement', 'Financement', 'Trésorerie'];
  const filteredTemplates = selectedCategory === 'Tous'
    ? MODEL_TEMPLATES
    : MODEL_TEMPLATES.filter(t => t.category === selectedCategory);

  const chartData = [
    { name: "Chiffre d'Affaires", Actuel: Math.round(baseCA), Simulé: Math.round(simCA) },
    { name: 'EBE', Actuel: Math.round(baseEBE), Simulé: Math.round(simEBE) },
    { name: 'Résultat Net', Actuel: Math.round(baseNet), Simulé: Math.round(simNet) },
    { name: 'BFR', Actuel: Math.round(baseBFR), Simulé: Math.round(simBFR) },
    { name: 'Trésorerie Nette', Actuel: Math.round(baseTN), Simulé: Math.round(simTN) },
  ];

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Header & Interrupteur Principal */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'linear-gradient(135deg, #059669, #047857)', borderRadius: 8, padding: '3px 9px', color: '#fff', fontSize: '0.68rem', fontWeight: 800 }}>
              MOTEUR EN PARTIE DOUBLE
            </span>
            Simulateur Comptable Multilignes (SCF Algérie)
          </div>
          <div className="section-sub" style={{ marginBottom: 0 }}>
            Simulez des opérations en partie double avec contrepartie au choix. L'impact s'applique en temps réel sur la Balance, le Bilan et le SIG.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowTemplates(!showTemplates)}
            style={{
              padding: '8px 14px', background: showTemplates ? '#f3e8ff' : 'var(--surface-alt)',
              color: showTemplates ? '#6b21a8' : 'var(--text)', border: `1px solid ${showTemplates ? '#c084fc' : 'var(--border)'}`,
              borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>auto_fix_high</span>
            {showTemplates ? 'Masquer Modèles ✕' : '💡 Modèles d\'Écritures (1-Clic)'}
          </button>

          <button
            onClick={handleOpenNewEditor}
            style={{
              padding: '8px 16px', background: 'var(--surface-alt)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.82rem',
              display: 'flex', alignItems: 'center', gap: 6
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary)' }}>edit_note</span>
            Saisie Multiligne Avancée
          </button>

          <button
            onClick={() => setIsSimulationActive(!isSimulationActive)}
            style={{
              padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
              background: isSimulationActive ? 'linear-gradient(135deg, #059669, #047857)' : 'var(--surface-alt)',
              color: isSimulationActive ? '#fff' : 'var(--text)',
              border: `1px solid ${isSimulationActive ? '#059669' : 'var(--border)'}`,
              fontWeight: 900, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: isSimulationActive ? '0 4px 12px rgba(5,150,105,0.25)' : 'none'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {isSimulationActive ? 'check_circle' : 'do_not_disturb_on'}
            </span>
            {isSimulationActive ? `Mode Simulé (${simulationEntries.length}) 📝` : 'Mode Réel 🔵'}
          </button>
        </div>
      </div>

      {/* ⚡ PANNEAU DE SIMULATION RAPIDE EN 1 CLIC (CONTRAT SIMPLE & PUISSANT) */}
      <div className="card" style={{ padding: 20, border: '2px solid #059669', background: '#f0fdf4' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#166534', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#059669' }}>flash_on</span>
            Créateur Rapide d'Opération Simulée (Partie Double SCF)
          </h3>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '3px 10px', borderRadius: 20 }}>
            Application immédiate sur toute la plateforme 🚀
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, alignItems: 'end' }}>
          {/* 1. Type d'opération */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
              1. Type d'Opération Simulée
            </label>
            <select
              value={quickOpType}
              onChange={e => {
                const type = e.target.value;
                setQuickOpType(type);
                if (type === 'vente') setQuickCounterpart('512');
                else if (type === 'achat') setQuickCounterpart('401');
                else if (type === 'salaires') setQuickCounterpart('421');
                else if (type === 'immo') setQuickCounterpart('512');
              }}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #86efac', borderRadius: 8, fontSize: '0.85rem', fontWeight: 800, color: '#14532d', background: '#ffffff', outline: 'none' }}
            >
              <option value="vente">🛒 Vente / Chiffre d'Affaires (+CA / Compte 700)</option>
              <option value="achat">📦 Achat de Marchandises (+Charges / Compte 600)</option>
              <option value="salaires">👥 Charges de Personnel (+Salaires / Compte 630)</option>
              <option value="immo">🏗️ Acquisition d'Immobilisation (+Investissement / Compte 210)</option>
              <option value="emprunt">🏦 Souscription Emprunt Bancaire (+Trésorerie / Compte 164)</option>
              <option value="recouvrement">📥 Recouvrement Créance Client (-DSO / Banque 512)</option>
              <option value="reglement">📤 Règlement Dette Fournisseur (-DPO / Banque 512)</option>
            </select>
          </div>

          {/* 2. Contrepartie */}
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
              2. Compte de Contrepartie (Partie Double)
            </label>
            <select
              value={quickCounterpart}
              onChange={e => setQuickCounterpart(e.target.value)}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #86efac', borderRadius: 8, fontSize: '0.85rem', fontWeight: 800, color: '#14532d', background: '#ffffff', outline: 'none' }}
            >
              {quickOpType === 'vente' && (
                <>
                  <option value="512">512 — Banque / Trésorerie (Comptant)</option>
                  <option value="411">411 — Créances Clients (Terme / Crédit)</option>
                  <option value="530">530 — Caisse (Comptant Espèces)</option>
                </>
              )}
              {quickOpType === 'achat' && (
                <>
                  <option value="401">401 — Dettes Fournisseurs (Terme / Crédit)</option>
                  <option value="512">512 — Banque (Paiement Comptant)</option>
                  <option value="300">300 — Stock de marchandises (Direct)</option>
                </>
              )}
              {quickOpType === 'salaires' && (
                <>
                  <option value="421">421 — Personnel (Rémunérations dues)</option>
                  <option value="512">512 — Banque (Virement direct)</option>
                </>
              )}
              {quickOpType === 'immo' && (
                <>
                  <option value="512">512 — Banque (Comptant)</option>
                  <option value="404">404 — Fournisseurs d'immobilisations</option>
                  <option value="164">164 — Emprunt financier long terme</option>
                </>
              )}
              {(quickOpType === 'emprunt' || quickOpType === 'recouvrement' || quickOpType === 'reglement') && (
                <option value="512">512 — Banque / Trésorerie</option>
              )}
            </select>
          </div>

          {/* 3. Montant */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>
                3. Montant (DA)
              </label>
              {/* Raccourcis de montants */}
              <div style={{ display: 'flex', gap: 4 }}>
                {[1000000, 5000000, 10000000, 50000000].map(m => (
                  <button
                    key={m}
                    onClick={() => setQuickAmount(m)}
                    style={{ fontSize: '0.62rem', padding: '2px 6px', borderRadius: 4, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', fontWeight: 800, cursor: 'pointer' }}
                  >
                    +{m / 1000000}M
                  </button>
                ))}
              </div>
            </div>
            <input
              type="number"
              value={quickAmount}
              onChange={e => setQuickAmount(Number(e.target.value))}
              placeholder="Ex: 5000000"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #86efac', borderRadius: 8, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem', fontWeight: 900, color: '#166534', outline: 'none', background: '#ffffff' }}
            />
          </div>

          {/* Bouton d'ajout */}
          <div>
            <button
              onClick={handleQuickAdd}
              style={{
                width: '100%', padding: '12px 18px', background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#ffffff', border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 900, fontSize: '0.88rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(5,150,105,0.3)'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_task</span>
              + Appliquer l'Écriture Simulée
            </button>
          </div>
        </div>
      </div>

      {/* 💡 ÉCRITURES MODÈLES COMPACTES & REPLIABLES */}
      {showTemplates && (
        <div className="card fade-in" style={{ padding: 16, border: '1px solid #c084fc', background: '#faf5ff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#581c87', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>auto_fix_high</span>
              Choisissez un Modèle d'Écriture Prédéfini
            </h4>

            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    fontSize: '0.68rem', padding: '3px 8px', borderRadius: 16,
                    border: `1px solid ${selectedCategory === cat ? '#7c3aed' : '#e9d5ff'}`,
                    background: selectedCategory === cat ? '#7c3aed' : '#fff',
                    color: selectedCategory === cat ? '#fff' : '#6b21a8',
                    fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
            {filteredTemplates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                style={{
                  background: '#fff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '8px 10px',
                  cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8
                }}
                className="card-hover-effect"
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#4c1d95', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {tpl.name}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#7c3aed', opacity: 0.8 }}>
                    Comptes {tpl.lines[0].compte} / {tpl.lines[1].compte}
                  </div>
                </div>
                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#7c3aed', flexShrink: 0 }}>arrow_forward</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 📝 ÉDITEUR MULTILIGNE (MODAL / INLINE) */}
      {isEditorOpen && (
        <div className="card fade-in" style={{ padding: 20, border: '2px solid var(--primary)', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 20 }}>edit_note</span>
              {editingId ? "Modification de l'Écriture Simulée" : "Saisie d'une Nouvelle Écriture Multiligne"}
            </h3>
            <button onClick={() => setIsEditorOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
              Libellé / Motif de l'Écriture
            </label>
            <input
              type="text"
              value={opLabel}
              onChange={e => setOpLabel(e.target.value)}
              placeholder="Ex: Vente de marchandises au comptant"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.85rem', fontWeight: 700, outline: 'none', background: 'var(--surface)' }}
            />
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
            <table className="data-table" style={{ width: '100%', tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>COMPTE (3 CH.)</th>
                  <th style={{ width: '38%' }}>INTITULÉ COMPTE</th>
                  <th className="right" style={{ width: '17%', color: 'var(--green)' }}>DÉBIT (DA)</th>
                  <th className="right" style={{ width: '17%', color: 'var(--primary-dk)' }}>CRÉDIT (DA)</th>
                  <th style={{ width: '6%', textAlign: 'center' }}>✕</th>
                </tr>
              </thead>
              <tbody>
                {editorLines.map((line, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        type="text"
                        value={line.compte}
                        onChange={e => handleLineChange(idx, 'compte', e.target.value)}
                        placeholder="700"
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 800, outline: 'none' }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={line.libelle}
                        onChange={e => handleLineChange(idx, 'libelle', e.target.value)}
                        placeholder="Intitulé"
                        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.78rem', outline: 'none' }}
                      />
                    </td>
                    <td className="right">
                      <input
                        type="number"
                        value={line.debit || ''}
                        onChange={e => handleLineChange(idx, 'debit', Number(e.target.value))}
                        placeholder="0"
                        style={{ width: '100%', textAlign: 'right', padding: '4px 6px', border: '1px solid var(--green)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 800, color: 'var(--green)', outline: 'none' }}
                      />
                    </td>
                    <td className="right">
                      <input
                        type="number"
                        value={line.credit || ''}
                        onChange={e => handleLineChange(idx, 'credit', Number(e.target.value))}
                        placeholder="0"
                        style={{ width: '100%', textAlign: 'right', padding: '4px 6px', border: '1px solid var(--primary)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-dk)', outline: 'none' }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => handleRemoveLine(idx)}
                        disabled={editorLines.length <= 2}
                        style={{ border: 'none', background: 'none', cursor: editorLines.length <= 2 ? 'not-allowed' : 'pointer', color: editorLines.length <= 2 ? '#cbd5e1' : 'var(--red)' }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="2" style={{ fontWeight: 800, fontSize: '0.75rem' }}>TOTAL ÉCRITURE SIMULÉE</td>
                  <td className="right mono" style={{ fontWeight: 900, color: 'var(--green)', fontSize: '0.85rem' }}>{fmt(sumDebit)}</td>
                  <td className="right mono" style={{ fontWeight: 900, color: 'var(--primary-dk)', fontSize: '0.85rem' }}>{fmt(sumCredit)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => handleAddLine('debit')}
                style={{ padding: '5px 10px', background: '#f0fdf4', color: '#166534', border: '1px solid #86efac', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                + Ligne Débit
              </button>
              <button
                onClick={() => handleAddLine('credit')}
                style={{ padding: '5px 10px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                + Ligne Crédit
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isBalanced ? (
                <span className="badge badge-green" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                  ✓ Équilibrée (D = C)
                </span>
              ) : (
                <span className="badge badge-red" style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                  ⚠ Écart: {fmt(diffDC)}
                </span>
              )}

              <button
                onClick={handleSaveEntry}
                disabled={!isBalanced}
                style={{
                  padding: '8px 18px', background: isBalanced ? 'linear-gradient(135deg, #059669, #047857)' : '#cbd5e1',
                  color: '#fff', border: 'none', borderRadius: 8, cursor: isBalanced ? 'pointer' : 'not-allowed',
                  fontWeight: 800, fontSize: '0.82rem'
                }}
              >
                {editingId ? 'Enregistrer' : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📚 JOURNAL DES ÉCRITURES SIMULÉES */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0 }}>Journal des Écritures Simulées</h3>
            <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{simulationEntries.length} écriture(s)</span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handleOpenNewEditor}
              className="btn btn-primary"
              style={{ fontSize: '0.75rem', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              + Saisie Avancée
            </button>

            {simulationEntries.length > 0 && (
              <button
                onClick={() => setSimulationEntries([])}
                style={{ border: 'none', background: 'none', color: 'var(--red)', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer' }}
              >
                × Vider Tout
              </button>
            )}
          </div>
        </div>

        <div style={{ width: '100%', overflow: 'hidden' }}>
          <table className="data-table compact-table" style={{ width: '100%', tableLayout: 'fixed', fontSize: '0.74rem' }}>
            <thead>
              <tr>
                <th style={{ width: '12%', padding: '8px 8px' }}>DATE</th>
                <th style={{ width: '44%', padding: '8px 8px' }}>LIBELLÉ &amp; LIGNES COMPTABLES</th>
                <th style={{ width: '16%', padding: '8px 8px' }}>COMPTES</th>
                <th className="right" style={{ width: '16%', padding: '8px 8px' }}>MONTANT (DA)</th>
                <th style={{ width: '12%', textAlign: 'center', padding: '8px 8px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {simulationEntries.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aucune écriture simulée dans le journal. Utilisez le <strong>Créateur Rapide</strong> ci-dessus pour simuler une opération.
                  </td>
                </tr>
              ) : (
                simulationEntries.map((e) => (
                  <tr key={e.id}>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)', verticalAlign: 'top', padding: '8px 8px' }}>
                      {e.date}
                    </td>

                    <td style={{ verticalAlign: 'top', padding: '8px 8px', wordBreak: 'break-word' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)', marginBottom: 4 }}>{e.label}</div>
                      
                      {e.lines && e.lines.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.7rem' }}>
                          {e.lines.map((l, li) => (
                            <div key={li} style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)', borderBottom: li < e.lines.length - 1 ? '1px dashed var(--border)' : 'none', paddingBottom: 1 }}>
                              <span>
                                <strong className="mono" style={{ color: l.debit > 0 ? 'var(--green)' : 'var(--primary-dk)' }}>{l.compte}</strong> — {l.libelle}
                              </span>
                              <span className="mono" style={{ fontWeight: 700, paddingLeft: 8 }}>
                                {l.debit > 0 ? `D: ${fmt(l.debit)}` : `C: ${fmt(l.credit)}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          D: {e.debitCompte} | C: {e.creditCompte}
                        </div>
                      )}
                    </td>

                    <td style={{ verticalAlign: 'top', padding: '8px 8px' }}>
                      {e.lines && e.lines.length > 0 ? (
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {e.lines.map((l, li) => (
                            <span key={li} className="mono" style={{ fontSize: '0.65rem', background: l.debit > 0 ? '#dcfce7' : '#eff6ff', color: l.debit > 0 ? '#166534' : '#1e40af', padding: '1px 5px', borderRadius: 4, fontWeight: 800 }}>
                              {l.compte}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 800 }}>{e.debitCompte} / {e.creditCompte}</span>
                      )}
                    </td>

                    <td className="right mono" style={{ verticalAlign: 'top', padding: '8px 8px', fontWeight: 900, color: 'var(--primary-dk)', fontSize: '0.85rem' }}>
                      {fmt(e.montant)}
                    </td>

                    <td style={{ verticalAlign: 'top', textAlign: 'center', padding: '8px 8px' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <button
                          onClick={() => handleOpenEditEditor(e)}
                          title="Modifier cette écriture"
                          style={{ border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', borderRadius: 6, padding: '3px 7px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit</span>
                          Éditer
                        </button>

                        <button
                          onClick={() => handleRemoveEntry(e.id)}
                          title="Supprimer cette écriture"
                          style={{ border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', borderRadius: 6, padding: '3px 6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 2 }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {simulationEntries.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="3" style={{ fontWeight: 800, fontSize: '0.75rem', padding: '8px 8px' }}>TOTAL GENERAL DU JOURNAL SIMULÉ</td>
                  <td className="right mono" style={{ fontWeight: 900, color: 'var(--primary-dk)', fontSize: '0.85rem', padding: '8px 8px' }}>{fmt(totalSimulatedDebit)}</td>
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                    <span className="badge badge-green" style={{ fontSize: '0.62rem' }}>✓ D = C</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* 📊 RECAPITULATIF DES IMPACTS SUR LES ÉTATS FINANCIERS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>CHIFFRE D'AFFAIRES (CA)</div>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: simCA >= baseCA ? 'var(--green)' : 'var(--red)', margin: '2px 0' }}>{fmt(simCA)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Actuel: {fmt(baseCA)} ({fmtPct(baseCA ? ((simCA - baseCA)/baseCA)*100 : 0)})</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>EXCÉDENT BRUT (EBE)</div>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: simEBE >= baseEBE ? 'var(--green)' : 'var(--red)', margin: '2px 0' }}>{fmt(simEBE)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Actuel: {fmt(baseEBE)}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>RÉSULTAT NET</div>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: simNet >= baseNet ? 'var(--green)' : 'var(--red)', margin: '2px 0' }}>{fmt(simNet)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Actuel: {fmt(baseNet)}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>BFR (BESOIN EN FONDS)</div>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: simBFR <= baseBFR ? 'var(--green)' : 'var(--red)', margin: '2px 0' }}>{fmt(simBFR)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Actuel: {fmt(baseBFR)}</div>
        </div>

        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700 }}>TRÉSORERIE NETTE (TN)</div>
          <div className="mono" style={{ fontSize: '1.15rem', fontWeight: 900, color: simTN >= baseTN ? 'var(--green)' : 'var(--red)', margin: '2px 0' }}>{fmt(simTN)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)' }}>Actuel: {fmt(baseTN)}</div>
        </div>

      </div>

      {/* Comparison Chart */}
      <div className="card" style={{ padding: 18 }}>
        <div className="card-header" style={{ marginBottom: 14 }}>
          <h3 style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
            <span className="material-symbols-outlined" style={{ color: 'var(--primary)', fontSize: 18 }}>bar_chart</span>
            Comparatif Visuel : Situation Actuelle vs Scénario Simulé
          </h3>
        </div>

        <div style={{ height: 260, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
              <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(val) => [fmt(val)]}
              />
              <Legend wrapperStyle={{ paddingTop: 8, fontSize: 11 }} />
              <Bar dataKey="Actuel" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={32} />
              <Bar dataKey="Simulé" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
