import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, File, ChevronRight, ChevronLeft } from 'lucide-react';
import { parseFile, calculateBilanFonctionnel, calculateSIG, calculateRatios } from '../utils/financeCalculations';
import { SECTEURS } from '../utils/secteurs';

export function ImportData({ onDataImported }) {
  const [step, setStep] = useState(1); // 1: Profil & Secteur, 2: Import Balances N et N-1

  // ── Step 1 : Profil & Secteur ──
  const [profil, setProfil] = useState({
    nomEntreprise: 'Dossier Anonyme',
    secteurId: 'commerce_gros',
    effectif: '',
  });

  // ── Multi-Dossiers localStorage ──
  const [savedDossiers, setSavedDossiers] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('finanalyze_saved_dossiers') || '[]');
    } catch {
      return [];
    }
  });

  // ── Step 2 : Balances N et N-1 ──
  const [fileN, setFileN] = useState(null);
  const [fileN1, setFileN1] = useState(null);
  const [parsedN, setParsedN] = useState(null);
  const [parsedN1, setParsedN1] = useState(null);
  const [previewTarget, setPreviewTarget] = useState('N'); // 'N' ou 'N-1'

  const saveDossierToStorage = (payloadData) => {
    const dDate = new Date().toLocaleDateString('fr-FR');
    const dossierTitle = `Dossier du ${dDate} (${savedDossiers.length + 1})`;
    const newDossier = {
      id: Date.now().toString(),
      nom: dossierTitle,
      date: dDate,
      profil,
      data: payloadData,
    };
    const updated = [newDossier, ...savedDossiers];
    setSavedDossiers(updated);
    try {
      localStorage.setItem('finanalyze_saved_dossiers', JSON.stringify(updated));
    } catch (e) {
      console.warn('Erreur sauvegarde localStorage:', e);
    }
  };

  const deleteDossierFromStorage = (id, e) => {
    e.stopPropagation();
    const updated = savedDossiers.filter(d => d.id !== id);
    setSavedDossiers(updated);
    localStorage.setItem('finanalyze_saved_dossiers', JSON.stringify(updated));
  };

  const loadSavedDossier = (dossier) => {
    onDataImported(dossier.data);
  };

  // ── Handlers Profil ──
  const handleProfilChange = (field, val) => {
    setProfil(prev => ({ ...prev, [field]: val }));
  };

  // ── Handlers Fichiers ──
  const handleFileN = async (f) => {
    setFileN(f);
    try {
      const data = await parseFile(f);
      setParsedN(data);
    } catch (err) {
      console.error(`Erreur Fichier N: ${err.message}`);
    }
  };

  const handleFileN1 = async (f) => {
    setFileN1(f);
    try {
      const data = await parseFile(f);
      setParsedN1(data);
    } catch (err) {
      console.error(`Erreur Fichier N-1: ${err.message}`);
    }
  };

  // ── Toggle Ignore Lines ──
  const toggleIgnoreRow = (target, index) => {
    const setter = target === 'N' ? setParsedN : setParsedN1;
    setter(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ignore: !copy[index].ignore };
      return copy;
    });
  };

  // ── Final Launch Analysis ──
  const finishAndLaunch = () => {
    if (!parsedN) return;

    setTimeout(() => {
      // 1. Calcul Exercice N
      const payloadN = { isBalance: true, rows: parsedN };
      const bilanN   = calculateBilanFonctionnel(payloadN);
      const sigN     = calculateSIG(payloadN);
      const ratiosN  = calculateRatios(bilanN, sigN, parsedN);

      // 2. Calcul Exercice N-1 (si fourni)
      let dataN1 = null;
      if (parsedN1) {
        const payloadN1 = { isBalance: true, rows: parsedN1 };
        const bilanN1   = calculateBilanFonctionnel(payloadN1);
        const sigN1     = calculateSIG(payloadN1);
        const ratiosN1  = calculateRatios(bilanN1, sigN1, parsedN1);
        dataN1 = { bilan: bilanN1, sig: sigN1, ratios: ratiosN1, rows: parsedN1 };
      }

      const fullPayload = {
        bilan: bilanN,
        sig: sigN,
        ratios: ratiosN,
        rows: parsedN,
        profil,
        dataN1,
      };

      saveDossierToStorage(fullPayload);
      onDataImported(fullPayload);
    }, 300);
  };

  const selectedSecteurObj = SECTEURS.find(s => s.id === profil.secteurId) || SECTEURS[0];

  return (
    <div className="animate-fade-in space-y-6" style={{ maxWidth: 1000, margin: '0 auto', paddingBottom: 40 }}>

      {/* Stepper Header */}
      <div style={{ background: '#ffffff', borderRadius: 16, padding: '20px 24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Configuration &amp; Importation des Données</h2>
            <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Choisissez votre secteur d'activité et importez vos balances comptables SCF.</p>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, background: '#eff6ff', color: '#2563eb', padding: '4px 12px', borderRadius: 20 }}>Étape {step} sur 2</span>
        </div>

        {/* Stepper Bar */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[
            { n: 1, title: 'Profil & Secteur', desc: 'Identité & Benchmarks' },
            { n: 2, title: 'Balances N & N-1', desc: 'Fichiers comptables SCF' },
          ].map((s) => (
            <div key={s.n} onClick={() => setStep(s.n)} style={{
              flex: 1, padding: '10px 14px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.2s',
              background: step === s.n ? '#2563eb' : step > s.n ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${step === s.n ? '#2563eb' : step > s.n ? '#86efac' : '#e2e8f0'}`,
              color: step === s.n ? '#ffffff' : step > s.n ? '#166534' : '#64748b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', fontSize: '0.75rem', fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step === s.n ? '#ffffff' : step > s.n ? '#059669' : '#cbd5e1',
                  color: step === s.n ? '#2563eb' : step > s.n ? '#ffffff' : '#ffffff',
                }}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>{s.title}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{s.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ÉTAPE 1 : PROFIL & SECTEUR D'ACTIVITÉ
      ═══════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 16, padding: 28, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* 📂 Mes Dossiers Sauvés (Multi-dossiers) */}
          {savedDossiers.length > 0 && (
            <div style={{ background: 'var(--surface-alt)', padding: 18, borderRadius: 14, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--primary)' }}>folder_shared</span>
                  Mes Dossiers Enregistrés ({savedDossiers.length})
                </h4>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Cliquez pour charger en 1 clic</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {savedDossiers.map(d => (
                  <div
                    key={d.id}
                    onClick={() => loadSavedDossier(d)}
                    style={{
                      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
                      cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.15s'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.nom}
                      </div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Modifié le {d.date}
                      </div>
                    </div>

                    <button
                      onClick={(e) => deleteDossierFromStorage(d.id, e)}
                      title="Supprimer ce dossier"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 4 }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 🔒 1. Confidentialité & Anonymat */}
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#059669' }}>lock</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#166534' }}>
                Confidentialité &amp; Anonymat Garantis 🔒
              </div>
              <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 2 }}>
                Aucune demande de raison sociale ou d'identité d'entreprise. Vos données comptables sont traitées à 100% localement dans votre navigateur sans transfert externe.
              </div>
            </div>
          </div>

          {/* 🎯 2. Sélecteur de Secteur d'Activité */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined text-blue-600" style={{ fontSize: 20 }}>domain</span>
                Secteur d'Activité (Recalibrage des Benchmarks SCF)
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Sélectionnez votre secteur pour adapter automatiquement les seuils de rentabilité, liquidité, DSO, DPO et rotation des stocks.
              </p>
            </div>

            {/* Grid des secteurs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {SECTEURS.map(sec => {
                const isSelected = profil.secteurId === sec.id;
                return (
                  <div
                    key={sec.id}
                    onClick={() => handleProfilChange('secteurId', sec.id)}
                    style={{
                      padding: '12px 14px', borderRadius: 12, cursor: 'pointer', transition: 'all 0.2s',
                      background: isSelected ? `${sec.couleur}12` : '#f8fafc',
                      border: `2px solid ${isSelected ? sec.couleur : '#e2e8f0'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: isSelected ? sec.couleur : '#cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#fff' }}>{sec.icon}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 800, color: isSelected ? sec.couleur : '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sec.label}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#64748b', lineHeight: 1.4, height: 28, overflow: 'hidden' }}>
                      {sec.description}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Preview du secteur sélectionné */}
            <div style={{ marginTop: 14, padding: 16, background: `${selectedSecteurObj.couleur}08`, border: `1px solid ${selectedSecteurObj.couleur}30`, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, color: selectedSecteurObj.couleur, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Référentiel Sectoriel Algérie (Loi de Finances / SCF)</span>
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{selectedSecteurObj.label}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 800 }}>
                    IBS Algérie : {selectedSecteurObj.tauxIBS}
                  </span>
                  <span style={{ background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe', padding: '3px 10px', borderRadius: 8, fontSize: '0.72rem', fontWeight: 800 }}>
                    TVA : {selectedSecteurObj.tvaStandard}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', flexWrap: 'wrap' }}>
                <span style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>Marge EBE: <strong>{selectedSecteurObj.benchmarks.margeEBE.norme}</strong></span>
                <span style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>DSO: <strong>{selectedSecteurObj.benchmarks.dso.norme}</strong></span>
                <span style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>Stock: <strong>{selectedSecteurObj.benchmarks.rotationStocks.norme}</strong></span>
                <span style={{ background: '#fff', padding: '4px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>Liquidité: <strong>{selectedSecteurObj.benchmarks.liquiditeGenerale.norme}</strong></span>
              </div>

              {selectedSecteurObj.specificitesAlgerie && (
                <div style={{ fontSize: '0.7rem', color: '#475569', borderTop: '1px dashed #cbd5e1', paddingTop: 8 }}>
                  <strong>🇩🇿 Spécificités fiscales &amp; réglementaires en Algérie :</strong> {selectedSecteurObj.specificitesAlgerie[0]}
                </div>
              )}
            </div>
          </div>

          {/* Bouton Suivant */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
            <button
              onClick={() => setStep(2)}
              style={{ padding: '12px 24px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              Étape suivante : Charger la Balance (N)
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          ÉTAPE 2 : IMPORT BALANCES (N OBLIGATOIRE, N-1 OPTIONNEL) + LANCEMENT
      ═══════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div style={{ background: '#ffffff', borderRadius: 16, padding: 28, border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 24 }}>

          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Chargement des Balances Comptables SCF</h3>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Importez la balance de l'exercice N (obligatoire). Vous pouvez également importer la balance N-1 (optionnelle) pour débloquer l'analyse comparative d'évolution.</p>
          </div>

          <div style={{ display: 'flex', gap: 20, alignItems: 'stretch' }}>

            {/* 📁 BALANCE EXERCICE N (PRINCIPALE — LARGEMENT MISE EN AVANT) */}
            <div style={{
              flex: 17,
              border: `2px dashed ${fileN ? '#059669' : '#2563eb'}`,
              background: fileN ? '#f0fdf4' : '#eff6ff',
              borderRadius: 16, padding: 32, textAlign: 'center', transition: 'all 0.2s',
              boxShadow: fileN ? '0 4px 12px rgba(5,150,105,0.1)' : '0 4px 12px rgba(37,99,235,0.1)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', background: '#2563eb', color: '#ffffff', padding: '4px 12px', borderRadius: 20 }}>
                  EXERCICE N (BALANCE PRINCIPALE — REQUISE)
                </span>
                <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700 }}>
                  * Source d'analyse principale
                </span>
              </div>

              <input
                type="file"
                id="file-upload-n"
                className="hidden"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => e.target.files?.[0] && handleFileN(e.target.files[0])}
              />

              {!fileN ? (
                <div onClick={() => document.getElementById('file-upload-n').click()} style={{ cursor: 'pointer', padding: '24px 20px' }}>
                  <div style={{ width: 56, height: 56, background: '#dbeafe', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Upload size={32} className="text-blue-600" />
                  </div>
                  <h4 style={{ fontWeight: 900, fontSize: '1.1rem', color: '#1e293b', marginBottom: 6 }}>
                    Importer la Balance Principale (Exercice N)
                  </h4>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 6 }}>Glissez-déposez votre fichier balance comptable ici ou cliquez pour parcourir</p>
                  <span style={{ fontSize: '0.72rem', color: '#2563eb', fontWeight: 700, background: '#ffffff', padding: '4px 12px', borderRadius: 20, border: '1px solid #bfdbfe' }}>
                    Formats acceptés : CSV, Excel (.xlsx, .xls)
                  </span>
                </div>
              ) : (
                <div style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', padding: 16, borderRadius: 12, border: '1px solid #86efac', marginBottom: 14 }}>
                    <File size={28} className="text-emerald-600" />
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: '0.95rem', color: '#0f172a' }} className="truncate">{fileN.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>
                        {parsedN ? `✅ ${parsedN.length} lignes valides importées` : 'Chargement...'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => setPreviewTarget('N')}
                      style={{ flex: 1, padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: '0.85rem' }}
                    >
                      👁 Contrôler &amp; Prévisualiser la Balance N
                    </button>
                    <button
                      onClick={() => { setFileN(null); setParsedN(null); }}
                      style={{ padding: '10px 16px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 10, cursor: 'pointer', color: '#dc2626', fontSize: '0.82rem', fontWeight: 700 }}
                    >
                      Changer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 📁 BALANCE EXERCICE N-1 (SECONDAIRE — COMPACTE & OPTIONNELLE) */}
            <div style={{
              flex: 3,
              minWidth: 0,
              overflow: 'hidden',
              border: `2px dashed ${fileN1 ? '#059669' : '#cbd5e1'}`,
              background: fileN1 ? '#f0fdf4' : '#f8fafc',
              borderRadius: 14, padding: '14px 10px', textAlign: 'center',
              display: 'flex', flexDirection: 'column', justifyContent: 'center'
            }}>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#64748b', marginBottom: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                N-1 (OPTIONNEL)
              </div>

              <input
                type="file"
                id="file-upload-n1"
                style={{ display: 'none' }}
                accept=".csv, .xlsx, .xls"
                onChange={(e) => e.target.files?.[0] && handleFileN1(e.target.files[0])}
              />

              {!fileN1 ? (
                <div onClick={() => document.getElementById('file-upload-n1').click()} style={{ cursor: 'pointer', padding: '8px 4px' }}>
                  <Upload size={22} style={{ margin: '0 auto 6px', color: '#94a3b8', display: 'block' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.75rem', color: '#475569', marginBottom: 2 }}>Balance N-1</div>
                  <div style={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.3 }}>Comparatif N vs N-1</div>
                </div>
              ) : (
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', padding: '8px 6px', borderRadius: 8, border: '1px solid #86efac', marginBottom: 8 }}>
                    <File size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.72rem', color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileN1.name}</div>
                      <div style={{ fontSize: '0.62rem', color: '#059669' }}>{parsedN1 ? `✅ ${parsedN1.length} l.` : '...'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => setPreviewTarget('N-1')}
                      style={{ flex: 1, padding: '5px 4px', background: '#059669', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.65rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      👁 Voir
                    </button>
                    <button
                      onClick={() => { setFileN1(null); setParsedN1(null); }}
                      style={{ padding: '5px 8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', color: '#dc2626', fontSize: '0.72rem', fontWeight: 800 }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Navigation Buttons & Launch */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={() => setStep(1)}
              style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <ChevronLeft size={18} />
              Retour au Profil
            </button>

            <button
              disabled={!parsedN}
              onClick={finishAndLaunch}
              style={{
                padding: '14px 32px', background: parsedN ? 'linear-gradient(135deg, #059669, #047857)' : '#cbd5e1', color: '#fff', border: 'none', borderRadius: 12,
                cursor: parsedN ? 'pointer' : 'not-allowed', fontWeight: 900, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 10, boxShadow: parsedN ? '0 4px 14px rgba(5,150,105,0.3)' : 'none'
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 22 }}>rocket_launch</span>
              Lancer l'Analyse Financière IA
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL DE PRÉVISUALISATION ET CONTRÔLE COMPTABLE (N ou N-1)
      ═══════════════════════════════════════════════════════════ */}
      {previewTarget && (previewTarget === 'N' ? parsedN : parsedN1) && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.7)', zIndex: 99999, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', background: '#ffffff', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ color: '#1e40af', fontSize: '1.2rem', margin: 0, fontWeight: 800 }}>
                Contrôle &amp; Prévisualisation — Balance {previewTarget}
              </h3>
              <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '2px 0 0' }}>
                Cochez "Ignorer" pour exclure les lignes de sous-totaux.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setPreviewTarget(null)}
                style={{ padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', background: '#2563eb', color: 'white', border: 'none', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Fermer
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', background: '#f8fafc' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead style={{ position: 'sticky', top: 0, background: '#ffffff', zIndex: 1 }}>
                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                  {['Ignorer', 'Compte', 'Libellé', 'S. Début D', 'S. Début C', 'Mouv. Débit', 'Mouv. Crédit', 'S. Fin Débit', 'S. Fin Crédit'].map((h, i) => (
                    <th key={i} style={{ padding: '10px 12px', color: '#475569', fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', textAlign: i > 2 ? 'right' : 'left' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(previewTarget === 'N' ? parsedN : parsedN1).map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', background: row.ignore ? '#fff1f2' : '#ffffff' }}>
                    <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                      <input type="checkbox" checked={row.ignore} onChange={() => toggleIgnoreRow(previewTarget, i)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '6px 12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: '#2563eb' }}>{row.compte}</td>
                    <td style={{ padding: '6px 12px' }}>{row.libelle}</td>
                    {[row.soldeDebutDebit, row.soldeDebutCredit, row.mouvementDebit, row.mouvementCredit, row.soldeFinDebit, row.soldeFinCredit].map((v, j) => (
                      <td key={j} style={{ padding: '6px 12px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace' }}>
                        {v ? v.toLocaleString('fr-FR') : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
