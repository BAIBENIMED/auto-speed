/**
 * Suivi automatique des expeditions qui ne dependent d'aucun voyage.
 * C'est le cas le plus courant chez AUTO SPEED : une expedition creee avec
 * un numero de conteneur, sans voyage enregistre. Elle n'etait jamais
 * actualisee par la tache automatique.
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

function bancEssai(options = {}) {
    const expeditions = options.expeditions || [];
    const voyages = options.voyages || [];
    const journal = { misesAJour: [], notifications: [] };

    const enregistrement = (e) => ({
        ...e,
        update: async (donnees) => {
            Object.assign(e, donnees);
            journal.misesAJour.push({ expedition: e.id, champs: Object.keys(donnees) });
        }
    });

    const modeles = {
        Shipment: {
            findAll: async () => expeditions.map(enregistrement),
            findByPk: async (id) => {
                const e = expeditions.find(x => x.id === id);
                return e ? enregistrement(e) : null;
            },
            update: async () => [0]
        },
        Voyage: { findAll: async () => voyages, findOne: async () => null, findByPk: async () => null },
        Notification: {
            create: async (n) => { journal.notifications.push(n); }
        },
        Order: { findAll: async () => [], update: async () => [0] },
        Vehicle: { findAll: async () => [], update: async () => [0] },
        PurchaseOrder: { findByPk: async () => null }
    };

    const service = chargerAvecModeles('src/services/voyageTrackingService.js', modeles);

    // On remplace l'appel reseau par une reponse maitrisee
    const suivi = require('../src/services/containerTrackingService');
    suivi.trackContainer = async (numero) => options.reponse || {
        status: 'En mer',
        vesselName: 'MSC AURORA',
        etd: '2026-02-01',
        eta: '2026-03-05',
        loadingPort: 'Shanghai',
        unloadingPort: 'Bejaia',
        location: { lat: 12.5, lng: 45.3 },
        events: [{ date: '2026-02-05', description: 'Depart', location: 'Shanghai' }],
        carrierInfo: { carrier: 'MSC' },
        identifier: numero
    };

    return { service, journal, expeditions };
}

test('une expedition sans voyage est actualisee par la tache automatique', async () => {
    const { service, journal } = bancEssai({
        expeditions: [{ id: 'SHIP-1', containerNumber: 'MSCU1234567', isArchived: false, voyage: null, voyageId: null, status: 'En transit', isTrackingActive: true }]
    });

    await service.refreshAllActive();

    assert.strictEqual(journal.misesAJour.length, 1, 'l\'expedition isolee doit etre mise a jour');
    assert.ok(journal.misesAJour[0].champs.includes('eta'));
    assert.ok(journal.misesAJour[0].champs.includes('currentLat'));
});

test('le rafraichissement d une expedition reporte les donnees du suivi', async () => {
    const { service, expeditions } = bancEssai({
        expeditions: [{ id: 'SHIP-1', containerNumber: 'MSCU1234567', isArchived: false, status: 'En transit' }]
    });

    const resultat = await service.refreshShipment(await (async () => {
        const e = expeditions[0];
        return { ...e, update: async (d) => Object.assign(e, d) };
    })());

    assert.strictEqual(resultat.success, true);
    assert.strictEqual(expeditions[0].eta, '2026-03-05');
    assert.strictEqual(expeditions[0].shipStatus, 'MSC AURORA');
    assert.strictEqual(expeditions[0].currentLat, 12.5);
});

test('une expedition sans conteneur ni BL est refusee proprement', async () => {
    const { service } = bancEssai();
    const resultat = await service.refreshShipment({ id: 'SHIP-X', update: async () => {} });

    assert.strictEqual(resultat.success, false);
    assert.match(resultat.message, /BL|conteneur/i);
});

test('un suivi indisponible ne touche pas aux donnees existantes', async () => {
    const { service, expeditions } = bancEssai({
        expeditions: [{ id: 'SHIP-1', containerNumber: 'MSCU1234567', isArchived: false, eta: '2026-03-05' }],
        reponse: { status: 'Tracking Non Disponible', message: 'Suivi indisponible', carrierInfo: { carrier: 'MSC' } }
    });

    const e = expeditions[0];
    const resultat = await service.refreshShipment({ ...e, update: async (d) => Object.assign(e, d) });

    assert.strictEqual(resultat.success, false);
    assert.strictEqual(e.eta, '2026-03-05', 'les dates saisies doivent etre conservees');
});

test('une expedition deja arrivee n est plus interrogee', async () => {
    const { service, journal } = bancEssai({
        expeditions: [{ id: 'SHIP-1', containerNumber: 'MSCU1234567', isArchived: false, status: 'Arrivé' }]
    });

    await service.refreshAllActive();
    assert.strictEqual(journal.misesAJour.length, 0);
});

test('le suivi desactive a la main est respecte', async () => {
    const { service, journal } = bancEssai({
        expeditions: [{ id: 'SHIP-1', containerNumber: 'MSCU1234567', isArchived: false, status: 'En mer', isTrackingActive: false }]
    });

    await service.refreshAllActive();
    assert.strictEqual(journal.misesAJour.length, 0);
});
