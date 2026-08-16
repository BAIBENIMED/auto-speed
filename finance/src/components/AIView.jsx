import { useState, useRef, useEffect } from 'react';
import { runAIAnalysis, buildGeminiContext } from '../utils/aiEngine';

/* ═══════════════════════════════════════════════════════════
   FINANALYZE — Moteur IA Financier
   Analyse locale intelligente + Chat Gemini (si clé configurée)
   ═══════════════════════════════════════════════════════════ */

const SEVERITE_STYLE = {
  critique: { bg: '#fff1f2', border: '#fca5a5', color: '#be123c', label: 'CRITIQUE',  icon: 'dangerous'    },
  eleve:    { bg: '#fff7ed', border: '#fdba74', color: '#c2410c', label: 'ÉLEVÉ',     icon: 'warning'      },
  moyen:    { bg: '#fffbeb', border: '#fde68a', color: '#92400e', label: 'MODÉRÉ',    icon: 'info'         },
  faible:   { bg: '#f0fdf4', border: '#86efac', color: '#166534', label: 'FAIBLE',    icon: 'check_circle' },
};
const URGENCE_STYLE = {
  critique: { color: '#dc2626', bg: '#fee2e2', label: '🔴 CRITIQUE' },
  haute:    { color: '#ea580c', bg: '#fff7ed', label: '🟠 HAUTE'    },
  moyenne:  { color: '#d97706', bg: '#fffbeb', label: '🟡 MOYENNE'  },
  basse:    { color: '#059669', bg: '#f0fdf4', label: '🟢 BASSE'    },
};

export function AIView({ data, geminiKey }) {
  const [activeTab, setActiveTab]     = useState('analyse');
  const [inputText, setInputText]     = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const chatEndRef = useRef(null);

  const analysis = data ? runAIAnalysis(data) : null;

  const [chatMessages, setChatMessages] = useState(() => {
    if (data && analysis) {
      return [{
        role: 'assistant',
        text: `**Bonjour ! Je suis votre Assistant IA Financier FINANALYZE.**\n\nJ'ai analysé vos données comptables. Voici un résumé rapide :\n\n${analysis.resume}\n\n💡 Posez-moi n'importe quelle question sur votre situation financière : *"Pourquoi mon BFR est élevé ?"*, *"Comment améliorer ma marge ?"*, *"Quel est le risque principal ?"*...`,
        time: new Date()
      }];
    }
    return [];
  });

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  /* ── Call Gemini API ── */
  const callGemini = async (userMessage) => {
    if (!geminiKey) return null;
    const context = buildGeminiContext(data, analysis);
    const prompt  = context + `\n\n## QUESTION DE L'UTILISATEUR\n${userMessage}\n\nRéponds de manière structurée, professionnelle et en français. Utilise des titres, des listes à puces et mets en gras les chiffres et points importants.`;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );
      const json = await res.json();
      return json?.candidates?.[0]?.content?.parts?.[0]?.text || null;
    } catch {
      return null;
    }
  };

  /* ── Local AI response (sans API) ── */
  const buildLocalResponse = (msg) => {
    const m   = msg.toLowerCase();
    const met = analysis?.metriques || {};
    const fmt = (v) => (v || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' DA';
    const pct = (v) => `${(v * 100).toFixed(1)}%`;

    if (m.includes('bfr') || m.includes('besoin'))
      return `**Analyse du BFR (Besoin en Fonds de Roulement)**\n\nVotre BFR est de **${fmt(data?.bilan?.bfr)}**, soit **${Math.round(met.bfrJCA)} jours de CA**.\n\n**Composantes :**\n- DSO (délai clients) : ${Math.round(met.dso)} jours\n- DPO (délai fournisseurs) : ${Math.round(met.dpo)} jours\n- Rotation stocks : ${Math.round(met.rotS)} jours\n\n**Formule :** BFR = Stocks + Créances clients - Dettes fournisseurs\n\n${met.bfrJCA > 60 ? '⚠️ Votre BFR est élevé. Agissez sur les 3 leviers simultanément pour le réduire.' : '✅ Votre BFR est dans la norme acceptable.'}`;

    if (m.includes('marge') || m.includes('rentabilit') || m.includes('profit'))
      return `**Analyse des Marges & Rentabilité**\n\n| Indicateur | Valeur | Norme |\n|---|---|---|\n| Marge EBE | ${pct(met.margeEBE)} | ≥ 10% |\n| Marge Opérationnelle | ${pct(met.margeOper)} | ≥ 5% |\n| Marge Nette | ${pct(met.margeNette)} | > 0% |\n| Taux Valeur Ajoutée | ${pct(met.tauxVA)} | > 20% |\n\n${met.margeNette > 0.05 ? '✅ Votre rentabilité est satisfaisante.' : met.margeNette > 0 ? '⚠️ La rentabilité est positive mais fragile. Surveillez vos charges.' : '🔴 Résultat déficitaire : plan de redressement urgent nécessaire.'}`;

    if (m.includes('trésorer') || m.includes('tresor') || m.includes('liquidit'))
      return `**Analyse de la Trésorerie & Liquidité**\n\n- Trésorerie Nette : **${fmt(data?.bilan?.tn)}** ${(data?.bilan?.tn || 0) >= 0 ? '✅' : '🔴'}\n- FRNG : **${fmt(data?.bilan?.frng)}** ${(data?.bilan?.frng || 0) >= 0 ? '✅' : '🔴'}\n- Liquidité Générale : **${met.liq.toFixed(2)}x** ${met.liq >= 1 ? '✅' : '🔴 (< 1 : RISQUE)'}\n\n${met.liq < 1 ? '🚨 **Alerte liquidité** : Votre actif circulant ne couvre pas vos dettes à court terme. Action urgente requise.' : met.liq < 1.5 ? '⚠️ La liquidité est correcte mais avec peu de marge de sécurité.' : '✅ Votre position de liquidité est confortable.'}`;

    if (m.includes('stock') || m.includes('rotation'))
      return `**Analyse des Stocks & Rotation**\n\n- Délai d'écoulement : **${Math.round(met.rotS)} jours** (norme ≤ 90j) ${met.rotS <= 90 ? '✅' : '⚠️'}\n- Stock moyen : **${fmt(data?.ratios?.stockMoyen)}**\n- Vitesse de rotation : **${(data?.ratios?.tauxRotationStocks || 0).toFixed(1)}x / an**\n\n${met.rotS > 120 ? "🔴 Rotation très lente : risque d'obsolescence et coûts de stockage élevés." : met.rotS > 90 ? "⚠️ Rotation à optimiser : classement ABC et politique de réapprovisionnement." : '✅ La rotation des stocks est satisfaisante.'}`;


    if (m.includes('client') || m.includes('créance') || m.includes('recouvrement') || m.includes('dso'))
      return `**Analyse du Recouvrement Clients (DSO)**\n\n- DSO : **${Math.round(met.dso)} jours** (norme ≤ 60j) ${met.dso <= 60 ? '✅' : '⚠️'}\n- Créances clients : **${fmt(data?.ratios?.creancesClients)}**\n- Vitesse de rotation créances : **${(data?.ratios?.tauxRotationCreances || 0).toFixed(1)}x / an**\n\n${met.dso > 90 ? '🔴 DSO critique : mettre en place un système de relance automatique et réviser les conditions de crédit.' : met.dso > 60 ? '⚠️ DSO élevé : intensifier les relances et proposer des escomptes pour paiement anticipé.' : '✅ Le délai de recouvrement est dans la norme.'}`;

    if (m.includes('fournisseur') || m.includes('dpo'))
      return `**Analyse des Délais Fournisseurs (DPO)**\n\n- DPO : **${Math.round(met.dpo)} jours** (norme 30-90j) ${met.dpo >= 30 && met.dpo <= 90 ? '✅' : '⚠️'}\n- Dettes fournisseurs : **${fmt(data?.ratios?.dettesFournisseurs)}**\n\n${met.dpo < 30 && met.dpo > 0 ? '⚠️ Vous payez trop tôt vos fournisseurs. Négociez des délais de 45 à 60 jours pour améliorer votre trésorerie.' : met.dpo > 90 ? '⚠️ Délai excessif : risque de tensions avec les fournisseurs.' : '✅ Les délais fournisseurs sont équilibrés.'}`;

    if (m.includes('score') || m.includes('santé') || m.includes('état') || m.includes('global'))
      return `**Score de Santé Financière Global**\n\n🎯 **Score Global : ${analysis.scoreGlobal}/100 — ${analysis.niveau.emoji} ${analysis.niveau.label}**\n\n| Dimension | Score |\n|---|---|\n| Rentabilité | ${Math.round(analysis.scores.rentabilite)}/100 |\n| Liquidité | ${Math.round(analysis.scores.liquidite)}/100 |\n| Structure | ${Math.round(analysis.scores.structure)}/100 |\n| Activité | ${Math.round(analysis.scores.activite)}/100 |\n| Productivité | ${Math.round(analysis.scores.productivite)}/100 |\n\n**Forces :** ${analysis.forces.length} identifiées\n**Faiblesses :** ${analysis.faiblesses.length} identifiées\n\nConsultez l'onglet **Analyse Complète** pour le détail.`;

    if (m.includes('recommand') || m.includes('conseil') || m.includes('action') || m.includes('améliorer'))
      return `**Recommandations Prioritaires**\n\n${analysis.recommandations.slice(0, 3).map((rec, i) => `**${i + 1}. ${rec.action}** [${rec.urgence.toUpperCase()}]\n${rec.detail.substring(0, 200)}...`).join('\n\n')}\n\nConsultez l'onglet **Recommandations** pour le plan d'action complet.`;

    if (m.includes('autonomie') || m.includes('fonds propres') || m.includes('endett'))
      return `**Analyse de la Structure Financière**\n\n- Autonomie Financière : **${pct(met.autFin)}** (norme ≥ 30%) ${met.autFin >= 0.3 ? '✅' : '⚠️'}\n- FRNG : **${fmt(data?.bilan?.frng)}** ${(data?.bilan?.frng || 0) >= 0 ? '✅' : '🔴'}\n\n${met.autFin < 0.2 ? '🔴 Dépendance excessive aux dettes : augmentation de capital recommandée en urgence.' : met.autFin < 0.3 ? '⚠️ Renforcer les fonds propres par mise en réserve des bénéfices.' : '✅ L\'autonomie financière est satisfaisante.'}`;

    // Réponse générique
    return `Je n'ai pas de réponse spécifique à cette question dans mon mode local.\n\n${geminiKey ? '🔁 Votre clé Gemini est configurée — la réponse IA avancée est en cours...' : '💡 **Conseil :** Configurez une clé API Gemini dans les Paramètres pour obtenir des réponses IA avancées sur n\'importe quelle question financière.\n\nVoici ce que je peux analyser localement :\n- Score et santé globale\n- Marges et rentabilité\n- Trésorerie et liquidité\n- Stocks et rotation\n- Créances clients (DSO)\n- Fournisseurs (DPO)\n- BFR et équilibre financier\n- Recommandations prioritaires'}`;
  };

  /* ── Envoyer un message direct ── */
  const sendCustomMessage = async (msgText) => {
    if (!msgText.trim() || isLoading || !data) return;
    const userMsg = msgText.trim();
    setInputText('');
    setIsLoading(true);

    const newMessages = [...chatMessages, { role: 'user', text: userMsg, time: new Date() }];
    setChatMessages(newMessages);

    let response;
    if (geminiKey) {
      response = await callGemini(userMsg);
    }
    if (!response) {
      response = buildLocalResponse(userMsg);
    }

    setChatMessages([...newMessages, { role: 'assistant', text: response, time: new Date() }]);
    setIsLoading(false);
  };

  const sendMessage = async () => {
    sendCustomMessage(inputText);
  };

  const exportAISynthesis = () => {
    let content = `FINANALYZE — SYNTHÈSE DU DIAGNOSTIC & ASSISTANT IA\n`;
    content += `Date: ${new Date().toLocaleDateString('fr-FR')}\n`;
    content += `Dossier: Dossier Financier Anonyme\n`;
    content += `Score Global: ${analysis?.scoreGlobal || 'N/A'}/100 — ${analysis?.niveau?.label || ''}\n\n`;

    content += `--- RÉSUMÉ EXÉCUTIF ---\n${analysis?.resume || ''}\n\n`;

    content += `--- FORCES IDENTIFIÉES (${analysis?.forces?.length || 0}) ---\n`;
    (analysis?.forces || []).forEach((f, i) => {
      content += `${i + 1}. ${f.titre} [${f.cat}]\n   ${f.detail}\n\n`;
    });

    content += `--- FAIBLESSES & RISQUES (${analysis?.faiblesses?.length || 0}) ---\n`;
    (analysis?.faiblesses || []).forEach((f, i) => {
      content += `${i + 1}. ${f.titre} [${f.severite.toUpperCase()}]\n   ${f.detail}\n\n`;
    });

    content += `--- PLAN D'ACTION RECOMMANDÉ (${analysis?.recommandations?.length || 0}) ---\n`;
    (analysis?.recommandations || []).forEach((r, i) => {
      content += `${i + 1}. ${r.action} [Urgence: ${r.urgence}]\n   ${r.detail}\n\n`;
    });

    if (chatMessages.length > 0) {
      content += `--- ÉCHANGES CHAT IA (${chatMessages.length}) ---\n`;
      chatMessages.forEach(m => {
        content += `[${m.role.toUpperCase()}] ${m.text.replace(/\*\*/g, '')}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Synthese_IA_FINANALYZE_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  /* ── Formatter le Markdown simple ── */
  const formatText = (text) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      if (line.startsWith('## '))   return <h4 key={i} style={{ fontWeight: 800, fontSize: '0.95rem', margin: '10px 0 4px', color: 'var(--text)' }}>{line.slice(3)}</h4>;
      if (line.startsWith('### '))  return <h5 key={i} style={{ fontWeight: 700, fontSize: '0.85rem', margin: '8px 0 4px', color: '#2563eb' }}>{line.slice(4)}</h5>;
      if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ fontWeight: 800, margin: '4px 0', fontSize: '0.85rem' }}>{line.slice(2, -2)}</p>;
      if (line.startsWith('- '))    return <li key={i} style={{ marginLeft: 16, fontSize: '0.83rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>{renderBold(line.slice(2))}</li>;
      if (line.startsWith('|') && line.includes('---')) return null;
      if (line.startsWith('|'))     return <div key={i} style={{ fontSize: '0.78rem', fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid var(--border)', padding: '3px 0' }}>{line}</div>;
      if (line === '')              return <br key={i} />;
      return <p key={i} style={{ margin: '3px 0', fontSize: '0.83rem', lineHeight: 1.6 }}>{renderBold(line)}</p>;
    });
  };

  const renderBold = (text) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p);
  };

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40 }}>
      <div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 10, padding: '4px 10px', fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>IA</span>
          Assistant IA Financier
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Analyse intelligente avec diagnostic, forces, faiblesses et recommandations.</p>
      </div>
      <div className="card" style={{ maxWidth: 480, margin: '20px auto', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ width: 64, height: 64, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#fff' }}>smart_toy</span>
        </div>
        <h3 style={{ fontWeight: 800, fontSize: '1.1rem', marginBottom: 8 }}>Importez vos données d'abord</h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>L'IA analyse votre balance comptable pour produire un diagnostic complet.</p>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* ── En-tête ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 10, padding: '4px 10px', fontSize: '0.7rem', color: '#fff', fontWeight: 800, letterSpacing: '0.05em' }}>IA FINANALYZE</span>
            Assistant IA Financier
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {geminiKey
              ? '✅ Gemini IA connectée — Réponses avancées disponibles'
              : '🔵 Mode local — Configurez une clé Gemini pour l\'IA avancée'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={exportAISynthesis}
            style={{
              padding: '8px 16px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg, #2563eb, #7c3aed)', color: '#fff',
              fontWeight: 800, fontSize: '0.8rem', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, boxShadow: 'var(--shadow-sm)'
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Exporter la synthèse IA (.txt)
          </button>
          {analysis && (
            <div style={{ background: `${analysis.niveau.color}15`, border: `1px solid ${analysis.niveau.color}40`, borderRadius: 16, padding: '10px 18px', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: analysis.niveau.color, lineHeight: 1 }} className="mono">{analysis.scoreGlobal}</div>
              <div style={{ fontSize: '0.62rem', fontWeight: 800, color: analysis.niveau.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>/ 100 — {analysis.niveau.label}</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: 4, background: 'var(--surface-alt)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', width: 'fit-content' }}>
        {[
          { id: 'analyse',        label: 'Analyse Complète', icon: 'auto_graph'  },
          { id: 'forces',         label: 'Forces',           icon: 'thumb_up'    },
          { id: 'faiblesses',     label: 'Faiblesses',       icon: 'thumb_down'  },
          { id: 'recommandations',label: 'Plan d\'Action',   icon: 'lightbulb'   },
          { id: 'chat',           label: 'Chat IA',          icon: 'chat'        },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
            background: activeTab === t.id ? '#2563eb' : 'transparent',
            color: activeTab === t.id ? '#fff' : 'var(--text-muted)',
            transition: 'all 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════
          TAB : ANALYSE COMPLÈTE
      ══════════════════════════ */}
      {activeTab === 'analyse' && analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Score détaillé */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', background: `${analysis.niveau.color}10`, borderBottom: `3px solid ${analysis.niveau.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: analysis.niveau.color, marginBottom: 2 }}>Score de Santé Globale</div>
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: analysis.niveau.color, lineHeight: 1 }} className="mono">{analysis.scoreGlobal} / 100</div>
                  <div style={{ fontWeight: 700, color: 'var(--text)', marginTop: 4 }}>{analysis.niveau.emoji} Situation {analysis.niveau.label}</div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(analysis.scores).map(([key, val]) => {
                    const labels = { rentabilite: 'Rentabilité', liquidite: 'Liquidité', structure: 'Structure', activite: 'Activité', productivite: 'Productivité' };
                    const c = val >= 70 ? '#059669' : val >= 45 ? '#d97706' : '#dc2626';
                    return (
                      <div key={key} style={{ textAlign: 'center', minWidth: 80 }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', border: `3px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px', background: `${c}10` }}>
                          <span className="mono" style={{ fontSize: '1rem', fontWeight: 800, color: c }}>{Math.round(val)}</span>
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{labels[key]}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Barre score */}
              <div style={{ marginTop: 14, height: 8, background: '#f1f5f9', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${analysis.scoreGlobal}%`, background: analysis.niveau.color, borderRadius: 6, transition: 'width 1s ease' }} />
              </div>
            </div>
            {/* Résumé exécutif */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb', marginBottom: 10 }}>
                📋 Résumé Exécutif — Généré par le Moteur IA
              </div>
              <div style={{ fontSize: '0.83rem', lineHeight: 1.7, color: 'var(--text)', background: 'var(--surface-alt)', padding: 16, borderRadius: 10, border: '1px solid var(--border)' }}>
                {analysis.resume.split('**').map((part, i) =>
                  i % 2 === 1
                    ? <strong key={i} style={{ color: 'var(--text)' }}>{part}</strong>
                    : part
                )}
              </div>
            </div>
          </div>

          {/* Compteurs Forces / Faiblesses */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'Forces',     count: analysis.forces.length,        color: '#059669', bg: '#f0fdf4', icon: 'thumb_up'    },
              { label: 'Faiblesses', count: analysis.faiblesses.length,    color: '#dc2626', bg: '#fff1f2', icon: 'thumb_down'  },
              { label: 'Actions',    count: analysis.recommandations.length,color: '#2563eb', bg: '#eff6ff', icon: 'lightbulb'  },
            ].map(({ label, count, color, bg, icon }) => (
              <div key={label} style={{ background: bg, border: `1px solid ${color}25`, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 24, color, display: 'block', marginBottom: 4 }}>{icon}</span>
                <div className="mono" style={{ fontSize: '2rem', fontWeight: 900, color, lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Métriques clés */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', background: 'var(--surface-alt)', borderBottom: '1px solid var(--border)', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#2563eb' }}>
              📊 Métriques Financières Clés
            </div>
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {[
                { label: 'Marge EBE',          val: `${(analysis.metriques.margeEBE * 100).toFixed(1)}%`,  ok: analysis.metriques.margeEBE >= 0.10 },
                { label: 'Marge Nette',         val: `${(analysis.metriques.margeNette * 100).toFixed(1)}%`,ok: analysis.metriques.margeNette > 0 },
                { label: 'Liquidité Générale',  val: `${analysis.metriques.liq.toFixed(2)}x`,              ok: analysis.metriques.liq >= 1 },
                { label: 'Autonomie Financière',val: `${(analysis.metriques.autFin * 100).toFixed(1)}%`,   ok: analysis.metriques.autFin >= 0.3 },
                { label: 'DSO Clients',         val: `${Math.round(analysis.metriques.dso)} j`,             ok: analysis.metriques.dso <= 60 && analysis.metriques.dso > 0 },
                { label: 'DPO Fournisseurs',    val: `${Math.round(analysis.metriques.dpo)} j`,             ok: analysis.metriques.dpo >= 30 && analysis.metriques.dpo <= 90 },
                { label: 'Rotation Stocks',     val: `${Math.round(analysis.metriques.rotS)} j`,            ok: analysis.metriques.rotS <= 90 && analysis.metriques.rotS > 0 },
                { label: 'BFR en jours CA',     val: `${Math.round(analysis.metriques.bfrJCA)} j`,          ok: analysis.metriques.bfrJCA <= 60 },
              ].map(({ label, val, ok }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: ok ? '#f0fdf4' : '#fff1f2', borderRadius: 8, border: `1px solid ${ok ? '#86efac' : '#fca5a5'}` }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="mono" style={{ fontWeight: 800, fontSize: '0.88rem', color: ok ? '#059669' : '#dc2626' }}>{val}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: ok ? '#059669' : '#dc2626' }}>{ok ? 'check_circle' : 'cancel'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommandations Prioritaires dans l'Analyse Complète */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', background: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: 20 }}>lightbulb</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#1e40af' }}>
                  🎯 Recommandations Prioritaires de l'IA ({analysis.recommandations.length})
                </span>
              </div>
              <button
                onClick={() => setActiveTab('recommandations')}
                style={{ background: 'transparent', border: 'none', color: '#2563eb', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                Voir le plan d'action complet <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
              </button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {analysis.recommandations.slice(0, 3).map((rec, i) => {
                const u = URGENCE_STYLE[rec.urgence] || URGENCE_STYLE.moyenne;
                return (
                  <div key={i} style={{ background: `${u.color}06`, border: `1px solid ${u.color}25`, borderLeft: `4px solid ${u.color}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.85rem', color: u.color }}>{rec.action}</span>
                      {rec.categorie && <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 20 }}>{rec.categorie}</span>}
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, background: u.bg, color: u.color, padding: '2px 8px', borderRadius: 20 }}>{u.label}</span>
                      {rec.gainEstime && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '2px 8px', borderRadius: 6 }}>
                          Impact : {rec.gainEstime}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', margin: 0, lineHeight: 1.5 }}>{rec.detail}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════
          TAB : FORCES
      ══════════════════════ */}
      {activeTab === 'forces' && analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 20 }}>thumb_up</span>
            </div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#166534' }}>Forces Identifiées</h3>
              <span style={{ fontSize: '0.72rem', color: '#059669' }}>{analysis.forces.length} point(s) favorable(s) détecté(s)</span>
            </div>
          </div>
          {analysis.forces.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--surface-alt)', borderRadius: 10 }}>Aucune force significative détectée. Consultez les recommandations.</div>
            : analysis.forces.map((f, i) => (
              <div key={i} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderLeft: '4px solid #059669', borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 36, height: 36, background: '#d1fae5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 18 }}>check_circle</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', color: '#166534' }}>{f.titre}</span>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, background: '#d1fae5', color: '#059669', padding: '2px 8px', borderRadius: 20 }}>{f.cat}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 60, height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${f.score}%`, background: '#059669', borderRadius: 4 }} />
                      </div>
                      <span className="mono" style={{ fontSize: '0.7rem', color: '#059669', fontWeight: 700 }}>{f.score}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#166534', lineHeight: 1.6 }}>{f.detail}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* ══════════════════════
          TAB : FAIBLESSES
      ══════════════════════ */}
      {activeTab === 'faiblesses' && analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: 20 }}>thumb_down</span>
            </div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1rem', color: '#be123c' }}>Faiblesses &amp; Points de Vigilance</h3>
              <span style={{ fontSize: '0.72rem', color: '#dc2626' }}>{analysis.faiblesses.length} risque(s) identifié(s)</span>
            </div>
          </div>
          {analysis.faiblesses.length === 0
            ? <div style={{ padding: 20, textAlign: 'center', color: '#059669', background: '#f0fdf4', borderRadius: 10, border: '1px solid #86efac' }}>✅ Aucune faiblesse majeure détectée. Situation financière saine !</div>
            : analysis.faiblesses.map((f, i) => {
                const s = SEVERITE_STYLE[f.severite] || SEVERITE_STYLE.moyen;
                return (
                  <div key={i} style={{ background: s.bg, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.color}`, borderRadius: 12, padding: '14px 18px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 36, height: 36, background: `${s.color}20`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="material-symbols-outlined" style={{ color: s.color, fontSize: 18 }}>{s.icon}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.88rem', color: s.color }}>{f.titre}</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, background: `${s.color}20`, color: s.color, padding: '2px 8px', borderRadius: 20 }}>{f.cat}</span>
                        <span style={{ fontSize: '0.62rem', fontWeight: 900, background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: '2px 8px', borderRadius: 20 }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: s.color, lineHeight: 1.6 }}>{f.detail}</p>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {/* ══════════════════════════════
          TAB : RECOMMANDATIONS (PLAN D'ACTION COMPLET)
      ══════════════════════════════ */}
      {activeTab === 'recommandations' && analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#2563eb', fontSize: 22 }}>lightbulb</span>
              </div>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e40af', margin: 0 }}>Plan d'Action Stratégique &amp; Recommandations</h3>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>{analysis.recommandations.length} recommandations opérationnelles adaptées au secteur {analysis.secteur.label}</span>
              </div>
            </div>

            <button
              onClick={exportAISynthesis}
              style={{
                padding: '8px 14px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 10,
                fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>file_download</span>
              Télécharger le Plan (.txt)
            </button>
          </div>

          {analysis.recommandations.map((rec, i) => {
            const u = URGENCE_STYLE[rec.urgence] || URGENCE_STYLE.moyenne;
            return (
              <div key={i} style={{ background: '#ffffff', border: `1px solid ${u.color}35`, borderLeft: `5px solid ${u.color}`, borderRadius: 14, padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
                
                {/* En-tête de la recommandation */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: u.bg, border: `2px solid ${u.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span className="mono" style={{ fontSize: '0.8rem', fontWeight: 900, color: u.color }}>{i + 1}</span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 900, fontSize: '0.95rem', color: 'var(--text)' }}>{rec.action}</span>
                        {rec.categorie && (
                          <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#e0e7ff', color: '#3730a3', padding: '2px 8px', borderRadius: 20 }}>
                            {rec.categorie}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {rec.gainEstime && (
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, background: '#dcfce7', color: '#15803d', padding: '3px 10px', borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        💰 {rec.gainEstime}
                      </span>
                    )}
                    <span style={{ fontSize: '0.68rem', fontWeight: 800, background: u.bg, color: u.color, padding: '3px 10px', borderRadius: 20, border: `1px solid ${u.color}40` }}>
                      {u.label}
                    </span>
                  </div>
                </div>

                {/* Détail analytique */}
                <p style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.6, margin: '8px 0 14px' }}>
                  {rec.detail}
                </p>

                {/* Étapes d'action concrètes */}
                {rec.etapes && rec.etapes.length > 0 && (
                  <div style={{ background: 'var(--surface-alt)', borderRadius: 10, padding: '12px 16px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: '#475569', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#2563eb' }}>checklist</span>
                      Actions Concrètes Recommandées :
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rec.etapes.map((etape, eIdx) => (
                        <div key={eIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: '0.8rem', color: 'var(--text)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#059669', flexShrink: 0, marginTop: 1 }}>check_box</span>
                          <span>{etape}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════
          TAB : CHAT IA
      ══════════════════════ */}
      {activeTab === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!geminiKey && (
            <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, fontSize: '0.8rem', color: '#92400e' }}>
              ⚡ <strong>Mode local actif</strong> — Les réponses sont générées par le moteur IA embarqué. Configurez une clé <strong>Gemini</strong> dans Paramètres pour une IA conversationnelle avancée.
            </div>
          )}
          {geminiKey && (
            <div style={{ padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, fontSize: '0.8rem', color: '#1e40af' }}>
              🤖 <strong>Gemini IA connectée</strong> — Posez n'importe quelle question sur votre situation financière !
            </div>
          )}

          {/* Zone de chat */}
          <div style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: 520 }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {chatMessages.map((msg, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                  {msg.role === 'assistant' && (
                    <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>smart_toy</span>
                    </div>
                  )}
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: msg.role === 'user' ? '#2563eb' : '#fff',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    boxShadow: 'var(--shadow-sm)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border)',
                  }}>
                    {msg.role === 'user'
                      ? <p style={{ fontSize: '0.83rem', lineHeight: 1.5 }}>{msg.text}</p>
                      : <div style={{ fontSize: '0.83rem', lineHeight: 1.6 }}>{formatText(msg.text)}</div>
                    }
                    <div style={{ fontSize: '0.62rem', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : 'var(--text-sub)', marginTop: 4, textAlign: msg.role === 'user' ? 'right' : 'left' }}>
                      {msg.time?.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div style={{ width: 32, height: 32, background: '#e2e8f0', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#64748b' }}>person</span>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #2563eb, #7c3aed)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#fff' }}>smart_toy</span>
                  </div>
                  <div style={{ padding: '10px 16px', background: '#fff', border: '1px solid var(--border)', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{ width: 7, height: 7, borderRadius: '50%', background: '#2563eb', animation: `bounce 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Suggestions rapides */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                '📊 Score global ?',
                '💰 Analyser les marges',
                '🔄 Pourquoi mon BFR est élevé ?',
                '⚡ Principales recommandations',
                '💧 Ma trésorerie est-elle saine ?',
                '📦 Diagnostic des stocks',
                '🚨 Quel est le risque principal ?',
              ].map(q => (
                <button
                  key={q}
                  onClick={() => sendCustomMessage(q.slice(3))}
                  style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface-alt)', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div style={{ padding: 12, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={handleKey}
                placeholder={data ? 'Posez une question sur votre situation financière...' : 'Importez des données pour commencer'}
                disabled={!data || isLoading}
                style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.85rem', outline: 'none', background: data ? '#fff' : 'var(--surface-alt)', color: 'var(--text)' }}
              />
              <button
                onClick={sendMessage}
                disabled={!data || isLoading || !inputText.trim()}
                style={{ width: 42, height: 42, borderRadius: 10, border: 'none', cursor: (!data || isLoading || !inputText.trim()) ? 'not-allowed' : 'pointer', background: (!data || !inputText.trim()) ? '#e2e8f0' : 'linear-gradient(135deg, #2563eb, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: (!data || !inputText.trim()) ? '#94a3b8' : '#fff' }}>send</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Animation CSS pour les points */}
      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
