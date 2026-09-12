/**
 * La route /sync-all doit survivre a une table indisponible : elle renvoie
 * null pour cette entite (le client garde alors son cache local) et repond
 * malgre tout 200. Une seule table en panne ne doit jamais provoquer le
 * message « Impossible de synchroniser avec le serveur ».
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

const ENTITES = [
    'Role', 'User', 'Client', 'Order', 'Vehicle', 'Shipment', 'Brand', 'Showroom',
    'ExchangeRate', 'CashTransaction', 'DynamicAttribute', 'PurchaseOrder',
    'Supplier', 'Notification', 'Voyage', 'VehicleTransfer', 'VehicleModel', 'VehicleTrim'
];

/**
 * @param {string|null} enPanne nom du modele dont la lecture echoue
 */
function bancEssai(enPanne) {
    const modeles = {};
    for (const nom of ENTITES) {
        modeles[nom] = {
            findAll: async () => {
                if (nom === enPanne) throw new Error(`Unknown column 'x' in 'field list'`);
                return [{ id: `${nom}-1` }];
            },
            findOne: async () => {
                if (nom === enPanne) throw new Error(`Unknown column 'x' in 'field list'`);
                return { id: `${nom}-1` };
            }
        };
    }
    modeles.Settings = {
        findOne: async () => {
            if (enPanne === 'Settings') throw new Error(`Unknown column 'partners' in 'field list'`);
            return { id: 1, partners: ['CARVEX AUTO'] };
        }
    };

    const routeur = chargerAvecModeles('src/routes/sync.js', modeles, {
        'middleware/auth': { authMiddleware: (req, res, next) => next() }
    });

    // Le gestionnaire final de GET /sync-all, sorti de la pile express
    const couche = routeur.stack.find(c => c.route && c.route.path === '/sync-all');
    const pile = couche.route.stack;
    return pile[pile.length - 1].handle;
}

function reponseFactice() {
    const r = { statusCode: 200, corps: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (d) => { r.corps = d; return r; };
    return r;
}

test('synchronisation complete : toutes les entites sont renvoyees', async () => {
    const handler = bancEssai(null);
    const res = reponseFactice();
    await handler({ user: { username: 'admin' } }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.corps.success, true);
    assert.strictEqual(res.corps.data.echecs, undefined);
    assert.strictEqual(res.corps.data.clients.length, 1);
    assert.deepStrictEqual(res.corps.data.settings.partners, ['CARVEX AUTO']);
});

test('parametres illisibles : la synchronisation repond quand meme 200', async () => {
    // Cas reellement survenu en production : colonne settings.partners absente.
    const handler = bancEssai('Settings');
    const res = reponseFactice();
    await handler({ user: { username: 'admin' } }, res);

    assert.strictEqual(res.statusCode, 200, 'une table en panne ne doit pas casser la synchro');
    assert.strictEqual(res.corps.success, true);
    assert.ok(res.corps.data.echecs.some(e => e.entite === 'parametres'));
    assert.strictEqual(res.corps.data.clients.length, 1, 'les autres entites restent servies');
});

test('voyages illisibles : la valeur est null, jamais un tableau vide', async () => {
    // null = « garde ton cache » cote client ; [] effacerait les voyages locaux.
    const handler = bancEssai('Voyage');
    const res = reponseFactice();
    await handler({ user: { username: 'admin' } }, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.corps.data.voyages, null);
});

test('chaque table peut tomber isolement sans provoquer de 500', async () => {
    // Le resume de journal lisait .length sans garde : une seule lecture en
    // echec faisait planter la route entiere.
    for (const nom of ENTITES) {
        const handler = bancEssai(nom);
        const res = reponseFactice();
        await handler({ user: { username: 'admin' } }, res);
        assert.strictEqual(res.statusCode, 200, `${nom} en panne renvoie ${res.statusCode}`);
    }
});
