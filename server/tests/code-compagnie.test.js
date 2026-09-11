/**
 * Choix du code compagnie transmis a l'API de suivi.
 *
 * Beaucoup de conteneurs appartiennent a des loueurs (TCKU pour Triton,
 * TGHU pour Textainer, GESU pour Genstar...) : leur prefixe ne dit rien du
 * transporteur. Sans indice, l'API interroge toutes les compagnies et
 * depasse le delai d'attente. On se rabat alors sur le transporteur saisi
 * dans la fiche de l'expedition.
 */
const test = require('node:test');
const assert = require('node:assert');

const suivi = require('../src/services/containerTrackingService');

test('le prefixe du conteneur reste prioritaire', () => {
    assert.strictEqual(suivi.codeCompagnie('MSCU1234567', 'CMA CGM'), 'MEDU');
    assert.strictEqual(suivi.codeCompagnie('CMAU7654321', 'MSC'), 'CMDU');
});

test('conteneur de loueur : le transporteur de la fiche prend le relais', () => {
    // TCKU appartient a Triton, un loueur : aucun transporteur deductible
    assert.strictEqual(suivi.detectSealineCode('TCKU7767567'), null);

    assert.strictEqual(suivi.codeCompagnie('TCKU7767567', 'MSC'), 'MEDU');
    assert.strictEqual(suivi.codeCompagnie('TCKU7767567', 'CMA CGM'), 'CMDU');
    assert.strictEqual(suivi.codeCompagnie('TGHU1234567', 'Maersk Line'), 'MAEU');
    assert.strictEqual(suivi.codeCompagnie('GESU1234567', 'Hapag-Lloyd'), 'HLCU');
});

test('les noms de compagnies sont reconnus quelle que soit la casse', () => {
    assert.strictEqual(suivi.codeCompagnieDepuisNom('msc'), 'MEDU');
    assert.strictEqual(suivi.codeCompagnieDepuisNom('Mediterranean Shipping Company'), 'MEDU');
    assert.strictEqual(suivi.codeCompagnieDepuisNom('COSCO SHIPPING'), 'COSU');
    assert.strictEqual(suivi.codeCompagnieDepuisNom('Evergreen Line'), 'EGLV');
    assert.strictEqual(suivi.codeCompagnieDepuisNom('HMM'), 'HDMU');
});

test('OOCL ne doit pas etre confondu avec sa maison mere COSCO', () => {
    assert.strictEqual(suivi.codeCompagnieDepuisNom('OOCL'), 'OOLU');
    assert.strictEqual(suivi.codeCompagnieDepuisNom('COSCO'), 'COSU');
});

test('transporteur absent ou inconnu : aucun code, pas d exception', () => {
    assert.strictEqual(suivi.codeCompagnie('TCKU7767567', null), null);
    assert.strictEqual(suivi.codeCompagnie('TCKU7767567', ''), null);
    assert.strictEqual(suivi.codeCompagnie('TCKU7767567', 'Transitaire local'), null);
});

test('le delai d attente est configurable et depasse largement 30 s', () => {
    assert.ok(suivi.timeout >= 60000, 'un delai trop court expirait sur les recherches sans indice');
});
