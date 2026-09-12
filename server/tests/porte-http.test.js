/**
 * Verification du montage reel : la porte doit retenir /api sans jamais
 * retenir /health, sinon Render considere le service comme mort pendant
 * l'initialisation et le redemarre en boucle.
 */
const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { creerPorteInitialisation } = require('../src/middleware/initialisation');

function serveur(porte) {
    const app = express();

    // Meme ordre que server.js
    app.get('/api/test-public', (req, res) => res.json({ ok: true })); // avant la porte
    app.use('/api', porte.milieu);
    app.use('/api/sync', (req, res) => res.json({ synchro: true }));
    app.get('/health', (req, res) => res.json({ statut: 'vivant' }));

    return new Promise((resolve) => {
        const s = app.listen(0, '127.0.0.1', () => resolve({
            port: s.address().port,
            fermer: () => new Promise(r => s.close(r))
        }));
    });
}

const appel = (port, chemin) => fetch(`http://127.0.0.1:${port}${chemin}`).then(async r => ({
    statut: r.status, corps: await r.json()
}));

test('le controle de sante repond pendant l initialisation', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });
    const s = await serveur(porte);

    try {
        const debut = Date.now();
        const reponse = await appel(s.port, '/health');

        assert.strictEqual(reponse.statut, 200);
        assert.strictEqual(reponse.corps.statut, 'vivant');
        assert.ok(Date.now() - debut < 500, 'le controle de sante ne doit pas attendre');
    } finally {
        porte.marquerPrete();
        await s.fermer();
    }
});

test('une requete /api attend la fin de l initialisation puis aboutit', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });
    const s = await serveur(porte);

    try {
        let terminee = false;
        const enCours = appel(s.port, '/api/sync/sync-all').then(r => { terminee = true; return r; });

        await new Promise(r => setTimeout(r, 120));
        assert.strictEqual(terminee, false, 'la requete ne doit pas aboutir avant l ouverture');

        porte.marquerPrete();
        const reponse = await enCours;

        assert.strictEqual(reponse.statut, 200);
        assert.strictEqual(reponse.corps.synchro, true);
    } finally {
        await s.fermer();
    }
});

test('la sonde publique montee avant la porte reste accessible', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });
    const s = await serveur(porte);

    try {
        const reponse = await appel(s.port, '/api/test-public');
        assert.strictEqual(reponse.statut, 200);
    } finally {
        porte.marquerPrete();
        await s.fermer();
    }
});

test('initialisation bloquee : /api finit par repondre au lieu d expirer', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 60, journaliser: () => {} });
    const s = await serveur(porte);

    try {
        const reponse = await appel(s.port, '/api/sync/sync-all');
        assert.strictEqual(reponse.statut, 200, 'le delai de securite doit laisser passer');
    } finally {
        await s.fermer();
    }
});
