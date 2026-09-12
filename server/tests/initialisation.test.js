/**
 * La porte d'initialisation doit retenir les requetes /api le temps que le
 * schema soit verifie, sans jamais pouvoir bloquer l'application : une
 * initialisation qui echoue ou traine laisse passer apres un delai.
 */
const test = require('node:test');
const assert = require('node:assert');
const { creerPorteInitialisation } = require('../src/middleware/initialisation');

const requeteFactice = () => ({ method: 'GET', originalUrl: '/api/sync/sync-all' });

test('une fois prete, la porte laisse passer sans attendre', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });
    porte.marquerPrete();

    let passe = false;
    const debut = Date.now();
    await porte.milieu(requeteFactice(), {}, () => { passe = true; });

    assert.strictEqual(passe, true);
    assert.ok(Date.now() - debut < 50, 'aucune attente ne doit etre introduite');
});

test('pendant l initialisation, la requete attend puis passe', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });

    let passe = false;
    const enCours = porte.milieu(requeteFactice(), {}, () => { passe = true; });

    // Rien ne doit passer tant que l'initialisation n'est pas signalee
    await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(passe, false, 'la requete ne doit pas passer avant la fin de l initialisation');

    porte.marquerPrete();
    await enCours;
    assert.strictEqual(passe, true);
});

test('une initialisation qui n arrive jamais ne bloque pas l application', async () => {
    const avertissements = [];
    const porte = creerPorteInitialisation({ attenteMaxMs: 40, journaliser: (m) => avertissements.push(m) });

    let passe = false;
    await porte.milieu(requeteFactice(), {}, () => { passe = true; });

    assert.strictEqual(passe, true, 'le delai de securite doit laisser passer la requete');
    assert.strictEqual(avertissements.length, 1, 'le depassement doit etre signale');
    assert.match(avertissements[0], /initialisation/i);
});

test('toutes les requetes en attente sont liberees ensemble', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });

    let passes = 0;
    const attentes = [1, 2, 3, 4, 5].map(() =>
        porte.milieu(requeteFactice(), {}, () => { passes++; })
    );

    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(passes, 0);

    porte.marquerPrete();
    await Promise.all(attentes);
    assert.strictEqual(passes, 5);
});

test('marquerPrete est sans effet si appele plusieurs fois', async () => {
    const porte = creerPorteInitialisation({ attenteMaxMs: 5000 });
    porte.marquerPrete();
    porte.marquerPrete();

    assert.strictEqual(porte.estPrete(), true);

    let passe = false;
    await porte.milieu(requeteFactice(), {}, () => { passe = true; });
    assert.strictEqual(passe, true);
});

test('la minuterie de securite est annulee une fois la requete passee', async (t) => {
    if (!process.getActiveResourcesInfo) return t.skip('getActiveResourcesInfo indisponible');

    const compter = () => process.getActiveResourcesInfo().filter(r => r === 'Timeout').length;
    // Le lanceur de tests a ses propres minuteries : on mesure l'ecart.
    const avant = compter();

    const porte = creerPorteInitialisation({ attenteMaxMs: 60000 });
    const enCours = porte.milieu(requeteFactice(), {}, () => {});
    porte.marquerPrete();
    await enCours;

    assert.strictEqual(compter(), avant, 'la minuterie de 60 s doit avoir ete annulee');
});
