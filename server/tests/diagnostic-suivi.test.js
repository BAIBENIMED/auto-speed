/**
 * Diagnostic du suivi maritime. On ne teste ici que ce qui ne demande pas
 * le reseau : la detection de la configuration et la discretion sur la cle.
 */
const test = require('node:test');
const assert = require('node:assert');

function serviceAvecCle(cle) {
    const chemin = require.resolve('../src/services/containerTrackingService');
    delete require.cache[chemin];
    if (cle === null) delete process.env.SAFECUBE_API_KEY;
    else process.env.SAFECUBE_API_KEY = cle;
    return require(chemin);
}

test('sans cle : le diagnostic le dit et n appelle pas l API', async () => {
    const service = serviceAvecCle(null);
    const rapport = await service.diagnostiquer('MSCU1234567');

    assert.strictEqual(rapport.cleConfiguree, false);
    assert.strictEqual(rapport.apiJoignable, null, 'aucun appel ne doit partir sans cle');
    assert.match(rapport.conclusion, /cle d'API/i);
});

test('cle de remplissage : traitee comme absente', async () => {
    const service = serviceAvecCle('your_safecube_key_here');
    const rapport = await service.diagnostiquer('MSCU1234567');

    assert.strictEqual(rapport.cleConfiguree, false);
});

test('la cle n est jamais renvoyee en clair', async () => {
    const secret = 'cle-tres-secrete-1234567890';
    const service = serviceAvecCle(secret);
    const rapport = await service.diagnostiquer('');

    assert.strictEqual(rapport.cleConfiguree, true);
    assert.ok(!JSON.stringify(rapport).includes(secret), 'la cle ne doit pas figurer dans le rapport');
    assert.match(rapport.cleApercu, /caracteres, finit par 7890$/);
});

test('sans numero : on s arrete avant l appel reseau', async () => {
    const service = serviceAvecCle('cle-de-test-abcdefgh');
    const rapport = await service.diagnostiquer('');

    assert.strictEqual(rapport.apiJoignable, null);
    assert.match(rapport.conclusion, /numero/i);
});

test('le rapport annonce le transporteur et le code compagnie attendus', async () => {
    const service = serviceAvecCle('cle-de-test-abcdefgh');

    // detectCarrier et detectSealineCode sont synchrones : on les verifie
    // directement, sans declencher l'appel HTTP du diagnostic complet.
    assert.strictEqual(service.detectCarrier('MSCU1234567').carrier, 'MSC');
    assert.strictEqual(service.detectSealineCode('MSCU1234567'), 'MEDU');
});
