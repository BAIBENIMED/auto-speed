import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import { AccountDetailDrawer } from './AccountDetailDrawer';

export function SIGView({ data, rows, formatCurrency }) {
  const [drawerState, setDrawerState] = useState({ isOpen: false, title: '', accountPrefixes: [], excludePrefixes: [] });

  const fmt = (v) => formatCurrency ? formatCurrency(v) : (v || 0).toLocaleString('fr-FR');
  const pct = (v) => `${(isFinite(v) ? v * 100 : 0).toFixed(1)} %`;
  const ratio = (v, d = 2) => isFinite(v) && v !== null ? Number(v).toFixed(d) : '—';
  const safe = (a, b) => (b && b !== 0 ? a / b : 0);

  const openDrillDownForCode = (code, label) => {
    let prefixes = [];
    if (code === '70') prefixes = ['70'];
    else if (code === '72') prefixes = ['72'];
    else if (code === '73') prefixes = ['73'];
    else if (code === '74') prefixes = ['74'];
    else if (code === '60') prefixes = ['60'];
    else if (code === '61/62') prefixes = ['61', '62'];
    else if (code === '63') prefixes = ['63'];
    else if (code === '64') prefixes = ['64'];
    else if (code === '65') prefixes = ['65'];
    else if (code === '68') prefixes = ['68'];
    else if (code === '75') prefixes = ['75'];
    else if (code === '78') prefixes = ['78'];
    else if (code === '76/786') prefixes = ['76', '786'];
    else if (code === '66/686') prefixes = ['66', '686'];
    else if (code === '69') prefixes = ['69'];
    else if (code === '77/67') prefixes = ['77', '67'];
    
    if (prefixes.length > 0) {
      setDrawerState({ isOpen: true, title: `Détail : ${label}`, accountPrefixes: prefixes, excludePrefixes: [] });
    }
  };

  if (!data) return (
    <div className="card fade-in" style={{ maxWidth: 420, margin: '60px auto' }}>
      <div style={{ padding: '48px 32px', textAlign: 'center' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 52, color: '#cbd5e1', display: 'block', marginBottom: 16 }}>analytics</span>
        <h3 style={{ fontWeight: 800, fontSize: '1.15rem', marginBottom: 8 }}>TCR / SIG non disponibles</h3>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Veuillez importer une balance comptable.</p>
      </div>
    </div>
  );

  /* ── KPIs principaux ── */
  const kpis = [
    { title: "Chiffre d'Affaires (70)", value: data.chiffreAffaires, sub: 'Ventes & Prestations', icon: 'payments', positive: true },
    { title: 'Valeur Ajoutée (VA)',       value: data.valeurAjoutee,  sub: 'Richesse créée',      icon: 'add_circle',  positive: data.valeurAjoutee > 0 },
    { title: 'EBE (Excédent Brut)',       value: data.ebe,            sub: 'Performance brute',   icon: 'show_chart',  positive: data.ebe > 0 },
    { title: "Résultat Net de l'Exercice",value: data.resultatNet,   sub: data.resultatNet >= 0 ? 'Bénéfice net' : 'Perte nette', icon: 'pie_chart', positive: data.resultatNet >= 0 },
  ];

  /* ── TCR officiel ── */
  const tcrRows = [
    { code: '70',    label: "Ventes et produits annexes (Chiffre d'affaires)", val: data.c70 || data.chiffreAffaires, type: 'compte' },
    { code: '72',    label: 'Variation des stocks de produits finis et en-cours', val: data.c72 || 0, type: 'compte' },
    { code: '73',    label: 'Production immobilisée', val: data.c73 || 0, type: 'compte' },
    { code: '74',    label: "Subventions d'exploitation", val: data.c74 || 0, type: 'compte' },
    { code: 'I',     label: "PRODUCTION DE L'EXERCICE (70 + 72 + 73 + 74)", val: data.productionExercice, type: 'subtotal' },
    { code: '60',    label: 'Achats consommés', val: data.c60 || 0, type: 'compte', isCharge: true },
    { code: '61/62', label: 'Services extérieurs et autres consommations', val: (data.c61 || 0) + (data.c62 || 0), type: 'compte', isCharge: true },
    { code: 'II',    label: "CONSOMMATION DE L'EXERCICE (60 + 61 + 62)", val: data.consommationExercice, type: 'subtotal', isCharge: true },
    { code: 'III',   label: 'VALEUR AJOUTÉE (I - II)', val: data.valeurAjoutee, type: 'total' },
    { code: '63',    label: 'Charges de personnel', val: data.c63 || data.chargesPersonnel || 0, type: 'compte', isCharge: true },
    { code: '64',    label: 'Impôts, taxes et versements assimilés', val: data.c64 || data.impotsTaxes || 0, type: 'compte', isCharge: true },
    { code: 'IV',    label: "EXCÉDENT BRUT D'EXPLOITATION (EBE)", val: data.ebe, type: 'total' },
    { code: '75',    label: 'Autres produits opérationnels', val: data.c75 || 0, type: 'compte' },
    { code: '65',    label: 'Autres charges opérationnelles', val: data.c65 || 0, type: 'compte', isCharge: true },
    { code: '68',    label: 'Dotations aux amortissements, provisions et pertes de valeur', val: data.c68_expl || data.dotationsExploitation || 0, type: 'compte', isCharge: true },
    { code: '78',    label: 'Reprises sur pertes de valeur et provisions', val: data.c78_expl || data.reprisesExploitation || 0, type: 'compte' },
    { code: 'V',     label: 'RÉSULTAT OPÉRATIONNEL', val: data.resultatExploitation, type: 'total' },
    { code: '76/786',label: 'Produits financiers', val: data.produitsFinanciers || 0, type: 'compte' },
    { code: '66/686',label: 'Charges financières', val: data.chargesFinancieres || 0, type: 'compte', isCharge: true },
    { code: 'VI',    label: 'RÉSULTAT FINANCIER', val: data.resultatFinancier, type: 'subtotal' },
    { code: 'VII',   label: "RÉSULTAT ORDINAIRE AVANT IMPÔTS (V + VI)", val: data.rcai, type: 'total' },
    { code: '69',    label: 'Impôts exigibles & différés sur résultats ordinaires', val: data.c69 || data.impotsBenefices || 0, type: 'compte', isCharge: true },
    { code: 'VIII',  label: "RÉSULTAT NET DES ACTIVITÉS ORDINAIRES (VII - 69)", val: data.resultatNetOrdinaire, type: 'subtotal' },
    { code: '77/67', label: 'Éléments extraordinaires (Produits - Charges)', val: data.resultatExtraordinaire || 0, type: 'compte' },
    { code: 'IX',    label: "RÉSULTAT NET DE L'EXERCICE", val: data.resultatNet, type: 'grand-total' },
  ];

  /* ── Cascade chart ── */
  const chartData = [
    { name: 'Production', Valeur: data.productionExercice },
    { name: 'Conso.', Valeur: -data.consommationExercice },
    { name: 'Val. Ajoutée', Valeur: data.valeurAjoutee },
    { name: 'EBE', Valeur: data.ebe },
    { name: 'Résultat Opérationnel', Valeur: data.resultatExploitation },
    { name: 'RCAI', Valeur: data.rcai },
    { name: 'Résultat Net', Valeur: data.resultatNet },
  ];

  /* ══════════════════════════════════════════════
     RATIOS DE PERFORMANCE & RENDEMENT
  ══════════════════════════════════════════════ */
  const ca    = data.chiffreAffaires     || 0;
  const va    = data.valeurAjoutee       || 0;
  const ebe   = data.ebe                 || 0;
  const reop  = data.resultatExploitation|| 0;
  const rnet  = data.resultatNet         || 0;
  const cpers = data.chargesPersonnel    || 0;
  const dotam = data.dotationsExploitation || data.c68_expl || 0;
  const cchfin= data.chargesFinancieres  || 0;
  const conso = data.consommationExercice|| 0;
  const prod  = data.productionExercice  || 0;
  const impots= data.impotsBenefices     || 0;

  // Capacité d'Autofinancement (CAF)
  const cafBrute = ebe + (data.autresProduitsOp || 0) - (data.autresChargesOp || 0) - cchfin - impots;

  /* ── Marges ── */
  const margeCommerciale  = safe(data.margeCommerciale || (ca - (data.c60 || 0)), ca);
  const tauxVA            = safe(va, ca);
  const margeEBE          = safe(ebe, ca);
  const margeOperationnelle = safe(reop, ca);
  const margeNette        = safe(rnet, ca);

  /* ── Productivité ── */
  const productivitePersonnel  = safe(va, cpers); // VA par unité de charges personnel
  const integrationVerticale   = safe(va, prod);  // % VA dans la production
  const chargePersonnelPctVA   = safe(cpers, va);
  const intensiteCapital       = safe(dotam, va); // Amortissements / VA
  const poidsChFinancieres     = safe(cchfin, ebe); // Charges fin / EBE

  /* ── Levier opérationnel (DOL) ── */
  const dol = (ca !== 0 && reop !== 0) ? safe(va, reop) : null;

  /* ── Rendement des charges ── */
  const rendementCharges = safe(rnet, conso + cpers + (data.impotsTaxes || 0));
  const txConvCA         = safe(reop, ca);          // même que marge opérationnelle

  /* ── Performance du TCR (résumé des flux) ── */
  const fluxChargesTotal = conso + cpers + (data.impotsTaxes || 0) + (data.autresChargesOp || 0) + dotam + cchfin + impots;
  const fluxProduitsTotal= prod + (data.autresProduitsOp || 0) + (data.produitsFinanciers || 0);

  /* ── Data pour radar chart ── */
  const radarData = [
    { subject: 'Marge EBE', A: Math.max(0, Math.min(margeEBE * 100, 100)), fullMark: 100 },
    { subject: 'Marge Nette', A: Math.max(0, Math.min(margeNette * 100, 100)), fullMark: 100 },
    { subject: 'Taux VA', A: Math.max(0, Math.min(tauxVA * 100, 100)), fullMark: 100 },
    { subject: 'Prod. Personnel', A: Math.max(0, Math.min(productivitePersonnel * 50, 100)), fullMark: 100 },
    { subject: 'Marge Opérat.', A: Math.max(0, Math.min(margeOperationnelle * 100, 100)), fullMark: 100 },
    { subject: 'Rend. Charges', A: Math.max(0, Math.min(rendementCharges * 100, 100)), fullMark: 100 },
  ];

  /* ── Bar chart des marges ── */
  const margesBarData = [
    { name: 'Marge VA', val: Math.round(tauxVA * 100), color: '#2563eb' },
    { name: 'Marge EBE', val: Math.round(margeEBE * 100), color: '#059669' },
    { name: 'Marge Opérat.', val: Math.round(margeOperationnelle * 100), color: '#d97706' },
    { name: 'Marge Nette', val: Math.round(margeNette * 100), color: margeNette >= 0 ? '#7c3aed' : '#dc2626' },
  ];

  /* ── Tableau des ratios de performance ── */
  const performanceRatios = [
    {
      categorie: 'MARGES SUR CA',
      rows: [
        { label: 'Taux de Valeur Ajoutée (VA / CA)', val: pct(tauxVA), norme: '> 20 %', ok: tauxVA >= 0.20, detail: 'Part de richesse créée sur le CA' },
        { label: 'Taux de Marge EBE (EBE / CA)', val: pct(margeEBE), norme: '≥ 10 %', ok: margeEBE >= 0.10, detail: 'Rentabilité avant financement et amortissements' },
        { label: 'Marge Opérationnelle (R.Exploit. / CA)', val: pct(margeOperationnelle), norme: '≥ 5 %', ok: margeOperationnelle >= 0.05, detail: 'Résultat généré par 100 DA de CA' },
        { label: 'Marge Commerciale Indicative', val: pct(margeCommerciale), norme: 'Sect. variable', ok: null, detail: 'Ecart ventes – achats sur CA' },
        { label: 'Marge Nette sur CA (RN / CA)', val: pct(margeNette), norme: '> 0 %', ok: margeNette > 0, detail: 'Bénéfice final pour 100 DA de CA' },
      ]
    },
    {
      categorie: 'PRODUCTIVITÉ & RENDEMENT HUMAIN',
      rows: [
        { label: 'Productivité apparente du travail (VA / Charges pers.)', val: ratio(productivitePersonnel), norme: '≥ 1.5x', ok: productivitePersonnel >= 1.5, detail: 'VA produite pour 1 DA de charges de personnel' },
        { label: 'Part charges personnel dans la VA', val: pct(chargePersonnelPctVA), norme: '≤ 65 %', ok: chargePersonnelPctVA <= 0.65, detail: 'Poids salarial dans la richesse créée' },
        { label: 'Intégration verticale (VA / Production)', val: pct(integrationVerticale), norme: '> 30 %', ok: integrationVerticale >= 0.30, detail: 'Part de la production maîtrisée en interne' },
        { label: 'Intensité capitalistique (Amort. / VA)', val: pct(intensiteCapital), norme: '< 25 %', ok: intensiteCapital < 0.25, detail: 'Poids des investissements dans la création de valeur' },
      ]
    },
    {
      categorie: 'RENDEMENT FINANCIER',
      rows: [
        { label: 'Couverture charges financières (EBE / Charges fin.)', val: cchfin > 0 ? ratio(safe(ebe, cchfin), 1) + 'x' : 'N/A', norme: '≥ 3x', ok: cchfin === 0 || safe(ebe, cchfin) >= 3, detail: "Capacité à honorer les intérêts depuis l'EBE" },
        { label: 'Poids charges financières (Charges fin. / EBE)', val: ebe > 0 ? pct(poidsChFinancieres) : 'N/A', norme: '< 30 %', ok: ebe <= 0 ? null : poidsChFinancieres < 0.30, detail: 'Part de l\'EBE absorbée par les frais financiers' },
        { label: 'Taux de conversion CA → Résultat net', val: pct(txConvCA), norme: '> 5 %', ok: txConvCA > 0.05, detail: 'Efficience globale de l\'activité commerciale' },
        { label: 'Rendement global des charges (RN / Charges totales)', val: pct(rendementCharges), norme: '> 0 %', ok: rendementCharges > 0, detail: 'Résultat généré pour 1 DA de charge totale' },
      ]
    },
    {
      categorie: 'LEVIER & RISQUE OPÉRATIONNEL',
      rows: [
        { label: 'Degré de levier opérationnel (VA / Résultat opérat.)', val: dol !== null ? ratio(dol, 2) + 'x' : 'N/A', norme: '1 – 5x', ok: dol !== null && dol >= 1 && dol <= 5, detail: 'Amplification du résultat selon la variation du CA' },
        { label: 'Part charges fixes implicites (Dotations / Charges tot.)', val: fluxChargesTotal > 0 ? pct(safe(dotam, fluxChargesTotal)) : 'N/A', norme: 'Analyt.', ok: null, detail: 'Représentation des charges de structure' },
        { label: 'Taux d\'IS effectif (Impôts / RCAI)', val: data.rcai > 0 ? pct(safe(impots, data.rcai)) : 'N/A', norme: '≈ 19 %', ok: data.rcai <= 0 ? null : safe(impots, data.rcai) <= 0.26, detail: 'Pression fiscale effective sur le résultat avant impôt (IBS Algérie 19 %)' },
        { label: 'CAF estimée (EBE ± corrections)', val: fmt(cafBrute), norme: '> 0', ok: cafBrute > 0, detail: 'Ressources générées en interne pour autofinancer investissements et dettes' },
      ]
    },
  ];

  const statusColor = (ok) => ok === true ? '#059669' : ok === false ? '#dc2626' : '#94a3b8';
  const statusIcon  = (ok) => ok === true ? 'check_circle' : ok === false ? 'cancel' : 'radio_button_unchecked';
  const statusBg    = (ok) => ok === true ? '#f0fdf4' : ok === false ? '#fff1f2' : '#f8fafc';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 32 }}>

      {/* ── En-tête ── */}
      <div>
        <div className="section-title">Compte de Résultat (TCR par Nature — SCF)</div>
        <div className="section-sub" style={{ marginBottom: 0 }}>Présentation réglementaire selon le Système Comptable Financier algérien (Loi 07-11) — avec ratios de performance et rendement.</div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="kpi-grid">
        {kpis.map((kpi, i) => (
          <div key={i} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span className="kpi-label">{kpi.title}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>{kpi.icon}</span>
            </div>
            <div className="kpi-value" style={{ fontSize: '1.35rem', color: kpi.positive ? '#059669' : '#dc2626' }}>{fmt(kpi.value)}</div>
            <div style={{ marginTop: 10 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
                padding: '3px 10px', borderRadius: 20,
                background: kpi.positive ? '#d1fae5' : '#fee2e2',
                color: kpi.positive ? '#065f46' : '#991b1b',
                border: `1px solid ${kpi.positive ? '#a7f3d0' : '#fca5a5'}`,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{kpi.positive ? 'trending_up' : 'trending_down'}</span>
                {kpi.sub}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── TCR Officiel ── */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>receipt_long</span>
            Tableau des Comptes de Résultat (TCR Officiel SCF)
          </h3>
          <span className="badge badge-blue">Norme SCF (Loi 07-11)</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>REF</th>
                <th>RUBRIQUE / INTITULÉ DU COMPTE</th>
                <th className="right">MONTANT</th>
              </tr>
            </thead>
            <tbody>
              {tcrRows.map((r, i) => {
                const isGrandTotal = r.type === 'grand-total';
                const isTotal      = r.type === 'total';
                const isSubtotal   = r.type === 'subtotal';
                const isCompte     = r.type === 'compte';
                let rowBg = 'transparent', fontWeight = 400, color = 'inherit';
                if (isGrandTotal)  { rowBg = '#dbeafe'; fontWeight = 800; color = '#1e40af'; }
                else if (isTotal)  { rowBg = '#eff6ff'; fontWeight = 700; color = '#1e3a8a'; }
                else if (isSubtotal){ rowBg = '#f8fafc'; fontWeight = 700; color = '#0f172a'; }
                const displayVal = r.isCharge && r.val > 0 ? -r.val : r.val;
                return (
                  <tr
                    key={i}
                    onClick={() => isCompte && openDrillDownForCode(r.code, r.label)}
                    style={{ background: rowBg, fontWeight, color, cursor: isCompte ? 'pointer' : 'default' }}
                  >
                    <td>
                      <span className="mono" style={{ fontSize: '0.72rem', fontWeight: 700, color: isCompte ? '#2563eb' : '#0f172a' }}>{r.code}</span>
                    </td>
                    <td style={{ paddingLeft: isCompte ? 24 : 12 }}>
                      {isTotal && <span style={{ color: '#2563eb', marginRight: 6 }}>►</span>}
                      {r.label}
                      {isCompte && (
                        <span className="badge badge-blue" style={{ fontSize: '0.6rem', marginLeft: 8, padding: '2px 6px' }}>
                          🔍 Détail
                        </span>
                      )}
                    </td>
                    <td className="right" style={{ fontFamily: 'JetBrains Mono, monospace', color: displayVal < 0 ? '#dc2626' : (isGrandTotal ? '#1e40af' : '#0f172a') }}>
                      {fmt(displayVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Cascade du résultat (chart) ── */}
      <div className="card">
        <div className="card-header">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#2563eb' }}>ssid_chart</span>
            Cascade du Résultat
          </h3>
        </div>
        <div className="card-body">
          <div style={{ height: 280, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="sigGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" angle={-25} textAnchor="end" height={60} fontSize={11} />
                <YAxis tickFormatter={v => `${Math.round(v / 1000)}k`} stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={v => [fmt(v), 'Montant']}
                  contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12 }}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="Valeur" stroke="#2563eb" strokeWidth={2.5} fill="url(#sigGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SECTION : RATIOS DE PERFORMANCE & RENDEMENT
      ══════════════════════════════════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: 22 }}>auto_graph</span>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>Ratios de Performance &amp; Rendement</h2>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
          Indicateurs de productivité, marges, rendement des charges et levier opérationnel dérivés du TCR.
        </p>

        {/* ── Cartes résumé marges ── */}
        <div className="kpi-grid" style={{ marginBottom: 20 }}>
          {[
            { label: 'Marge EBE',          val: pct(margeEBE),           ok: margeEBE >= 0.10, icon: 'show_chart',   sub: 'EBE / CA' },
            { label: 'Marge Opérationnelle',val: pct(margeOperationnelle),ok: margeOperationnelle >= 0.05, icon: 'query_stats', sub: 'R.Exploit. / CA' },
            { label: 'Marge Nette',         val: pct(margeNette),         ok: margeNette > 0,   icon: 'pie_chart',   sub: 'RN / CA' },
            { label: 'Taux de VA',          val: pct(tauxVA),             ok: tauxVA >= 0.20,   icon: 'add_circle',  sub: 'VA / CA' },
          ].map((k, i) => (
            <div key={i} className="kpi-card" style={{ borderTop: `3px solid ${k.ok ? '#059669' : '#dc2626'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="kpi-label" style={{ margin: 0 }}>{k.label}</span>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>{k.icon}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '6px 0 10px' }}>
                <span className="mono" style={{ fontSize: '1.7rem', fontWeight: 900, color: k.ok ? '#059669' : '#dc2626', lineHeight: 1 }}>{k.val}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                <span style={{ color: 'var(--text-muted)' }}>{k.sub}</span>
                <span className="badge" style={{ background: k.ok ? '#d1fae5' : '#fee2e2', color: k.ok ? '#059669' : '#dc2626', borderColor: k.ok ? '#6ee7b7' : '#fca5a5', fontSize: '0.62rem' }}>
                  {k.ok ? 'CONFORME' : 'ATTENTION'}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Charts côte à côte ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Bar chart des marges */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>bar_chart</span>
                Niveaux de Marges (% du CA)
              </h3>
            </div>
            <div className="card-body">
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={margesBarData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} stroke="#94a3b8" />
                    <YAxis tickFormatter={v => `${v}%`} fontSize={10} stroke="#94a3b8" />
                    <Tooltip formatter={v => [`${v} %`, 'Marge']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="val" radius={[4, 4, 0, 0]}>
                      {margesBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Radar performance */}
          <div className="card">
            <div className="card-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#7c3aed' }}>radar</span>
                Radar de Performance Globale
              </h3>
            </div>
            <div className="card-body">
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" fontSize={9} stroke="#94a3b8" />
                    <Radar name="Score" dataKey="A" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tableau complet des ratios ── */}
        {performanceRatios.map((section, si) => (
          <div key={si} className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '12px 18px', background: '#f5f3ff', borderBottom: '1px solid #ddd6fe', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-outlined" style={{ color: '#7c3aed', fontSize: 18 }}>auto_graph</span>
              <span style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5b21b6' }}>{section.categorie}</span>
            </div>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Indicateur</th>
                  <th style={{ textAlign: 'right' }}>Valeur calculée</th>
                  <th style={{ textAlign: 'center' }}>Norme</th>
                  <th style={{ textAlign: 'left' }}>Interprétation</th>
                  <th style={{ textAlign: 'center' }}>Statut</th>
                </tr>
              </thead>
              <tbody>
                {section.rows.map((row, ri) => (
                  <tr key={ri} style={{ background: statusBg(row.ok) }}>
                    <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>{row.label}</td>
                    <td className="right mono" style={{ fontWeight: 800, fontSize: '0.9rem', color: row.ok === true ? '#059669' : row.ok === false ? '#dc2626' : 'var(--text)' }}>{row.val}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--surface-alt)', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>{row.norme}</span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{row.detail}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 18, color: statusColor(row.ok) }}>
                        {statusIcon(row.ok)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {/* ── Bloc CAF & synthèse ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ color: '#059669', fontSize: 18 }}>savings</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#166534' }}>SYNTHÈSE — FLUX & AUTOFINANCEMENT</span>
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total Produits',        val: fmt(fluxProduitsTotal), color: '#2563eb',  icon: 'north' },
              { label: 'Total Charges',         val: fmt(fluxChargesTotal),  color: '#dc2626',  icon: 'south' },
              { label: 'Résultat Net',          val: fmt(rnet),              color: rnet >= 0 ? '#059669' : '#dc2626', icon: rnet >= 0 ? 'trending_up' : 'trending_down' },
              { label: 'CAF Estimée',           val: fmt(cafBrute),          color: cafBrute >= 0 ? '#059669' : '#dc2626', icon: 'savings' },
              { label: 'Amort. & Provisions',  val: fmt(dotam),             color: '#d97706',  icon: 'settings_backup_restore' },
              { label: 'Charges Financières',  val: fmt(cchfin),            color: '#7c3aed',  icon: 'percent' },
            ].map(({ label, val, color, icon }) => (
              <div key={label} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', borderLeft: `3px solid ${color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color }}>{icon}</span>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-sub)' }}>{label}</span>
                </div>
                <div className="mono" style={{ fontWeight: 800, fontSize: '0.92rem', color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Account Detail Drawer */}
      <AccountDetailDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState(prev => ({ ...prev, isOpen: false }))}
        title={drawerState.title}
        accountPrefixes={drawerState.accountPrefixes}
        excludePrefixes={drawerState.excludePrefixes}
        rows={rows}
        formatCurrency={formatCurrency}
      />
    </div>
  );
}
