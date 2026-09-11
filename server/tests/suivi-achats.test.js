/**
 * Report des informations du suivi maritime vers les commandes d'achat liees.
 * Une erreur ici ecraserait des dates saisies a la main.
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

function bancEssai() {
    const base = {
        vehicules: [
            { id: 'V1', shipmentId: 'SHIP-1', purchaseOrderId: 'ACH/2026/001' },
            { id: 'V2', shipmentId: 'SHIP-1', purchaseOrderId: 'ACH/2026/001' }, // meme achat
            { id: 'V3', shipmentId: 'SHIP-1', purchaseOrderId: 'ACH/2026/002' },
            { id: 'V4', shipmentId: 'SHIP-1', purchaseOrderId: null },           // sans achat
            { id: 'V5', shipmentId: 'SHIP-2', purchaseOrderId: 'ACH/2026/003' }  // autre expedition
        ],
        achats: {
            'ACH/2026/001': { id: 'ACH/2026/001', etd: null, eta: null, loadingPort: 'Saisie manuelle', situation: 'a preserver' },
            'ACH/2026/002': { id: 'ACH/2026/002', etd: '2026-01-01', eta: null },
            'ACH/2026/003': { id: 'ACH/2026/003', etd: null, eta: null }
        },
        ecritures: []
    };

    const modeles = {
        Vehicle: { findAll: async ({ where }) => base.vehicules.filter(v => v.shipmentId === where.shipmentId) },
        Order: { findAll: async () => [], findByPk: async () => null },
        PurchaseOrder: {
            findByPk: async (id) => {
                const achat = base.achats[id];
                if (!achat) return null;
                return {
                    ...achat,
                    update: async (donnees) => {
                        Object.assign(achat, donnees);
                        base.ecritures.push({ achat: id, champs: Object.keys(donnees) });
                    }
                };
            }
        }
    };

    const module_ = chargerAvecModeles('src/utils/statusSynchronizer.js', modeles);
    return { base, sync: module_.syncShipmentToPurchaseOrders };
}

test('les informations du suivi arrivent sur les achats lies', async () => {
    const { base, sync } = bancEssai();

    await sync('SHIP-1', {
        etd: '2026-09-11T16:30:00+08:00',
        eta: '2026-11-02T20:10:00+01:00',
        loadingPort: 'Nansha Pt',
        destinationPort: 'Skikda',
        carrier: 'CMA CGM'
    });

    const a1 = base.achats['ACH/2026/001'];
    assert.strictEqual(a1.etd, '2026-09-11T16:30:00+08:00');
    assert.strictEqual(a1.eta, '2026-11-02T20:10:00+01:00');
    assert.strictEqual(a1.loadingPort, 'Nansha Pt');
    assert.strictEqual(a1.destinationPort, 'Skikda');
    assert.strictEqual(a1.carrier, 'CMA CGM');

    assert.strictEqual(base.achats['ACH/2026/002'].eta, '2026-11-02T20:10:00+01:00',
        'le second achat de la meme expedition doit suivre');
});

test('un achat rattache a deux vehicules n est ecrit qu une fois', async () => {
    const { base, sync } = bancEssai();
    await sync('SHIP-1', { eta: '2026-11-02' });

    const ecrituresDuPremier = base.ecritures.filter(e => e.achat === 'ACH/2026/001');
    assert.strictEqual(ecrituresDuPremier.length, 1);
});

test('les achats des autres expeditions ne bougent pas', async () => {
    const { base, sync } = bancEssai();
    await sync('SHIP-1', { eta: '2026-11-02' });

    assert.strictEqual(base.achats['ACH/2026/003'].eta, null);
});

test('un suivi sans donnee n ecrase rien', async () => {
    const { base, sync } = bancEssai();
    await sync('SHIP-1', { etd: null, eta: undefined });

    assert.strictEqual(base.ecritures.length, 0);
    assert.strictEqual(base.achats['ACH/2026/001'].loadingPort, 'Saisie manuelle');
});

test('une expedition sans achat lie ne leve pas d erreur', async () => {
    const { sync } = bancEssai();
    await sync('SHIP-INEXISTANTE', { eta: '2026-12-01' });
});
