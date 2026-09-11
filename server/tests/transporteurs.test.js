/**
 * Reconnaissance du transporteur a partir du numero de conteneur ou de BL.
 * C'est ce qui declenche le bon suivi automatique : une erreur ici et
 * l'expedition n'est jamais actualisee.
 */
const test = require('node:test');
const assert = require('node:assert');

const suivi = require('../src/services/containerTrackingService');

test('conteneurs : chaque prefixe connu designe son transporteur', () => {
    const attendus = {
        MSCU1234567: 'MSC',
        MEDU1234567: 'MSC',
        MAEU1234567: 'Maersk',
        MSKU1234567: 'Maersk',
        CMAU7654321: 'CMA CGM',
        CGMU7654321: 'CMA CGM',
        GCNU1112223: 'Grimaldi',
        COSU1112223: 'COSCO',
        HLCU1112223: 'Hapag-Lloyd',
        EISU1112223: 'Evergreen',
        EGHU1112223: 'Evergreen',
        HDMU1112223: 'HMM',
        ONEU1112223: 'ONE',
        OOLU1112223: 'OOCL'
    };

    for (const [numero, transporteur] of Object.entries(attendus)) {
        const detecte = suivi.detectCarrier(numero);
        assert.strictEqual(detecte.carrier, transporteur, `${numero} devrait etre ${transporteur}`);
        assert.strictEqual(detecte.type, 'container', `${numero} devrait etre reconnu comme conteneur`);
    }
});

test('conteneurs : le format est normalise (espaces et minuscules)', () => {
    assert.strictEqual(suivi.detectCarrier('  mscu1234567 ').carrier, 'MSC');
});

test('code compagnie transmis a l API de suivi', () => {
    // Evergreen declare ses conteneurs sous EGLV, pas sous le prefixe EISU
    assert.strictEqual(suivi.detectSealineCode('EISU1112223'), 'EGLV');
    assert.strictEqual(suivi.detectSealineCode('HMMU1112223'), 'HDMU');
    assert.strictEqual(suivi.detectSealineCode('ONEU1112223'), 'ONEY');
    assert.strictEqual(suivi.detectSealineCode('OOCU1112223'), 'OOLU');
});

test('code compagnie absent quand le prefixe est inconnu : l API detecte seule', () => {
    assert.ok(!suivi.detectSealineCode('ZZZU1112223'));
});

test('BL : les prefixes connus sont reconnus, les autres proposent des liens', () => {
    assert.strictEqual(suivi.detectCarrier('MEDUQ1234567').carrier, 'MSC');
    assert.strictEqual(suivi.detectCarrier('MAEU9876543210').carrier, 'Maersk');

    const inconnu = suivi.detectCarrier('ABCD9876543210');
    assert.strictEqual(inconnu.carrier, 'Inconnu');
    assert.ok(Array.isArray(inconnu.trackingUrls) && inconnu.trackingUrls.length >= 3,
        'un BL non reconnu doit proposer plusieurs pistes de suivi');
});

test('BL entierement numerique : oriente vers Grimaldi et Maersk', () => {
    const neuf = suivi.detectCarrier('123456789');
    assert.strictEqual(neuf.carrier, 'Grimaldi / Maersk');
    assert.strictEqual(neuf.type, 'bl');
});

test('numero absent : aucune detection, pas d exception', () => {
    assert.strictEqual(suivi.detectCarrier(''), null);
    assert.strictEqual(suivi.detectCarrier(null), null);
});
