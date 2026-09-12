/**
 * Reparation des noms de client corrompus dans la caisse.
 *
 * showCashModal lisait order.clientName, un champ qui n'existe pas sur la
 * commande : le gabarit inserait alors le mot litteral « undefined » dans un
 * champ en lecture seule, enregistre tel quel. « undefined » est une chaine
 * non vide : t.clientName || 'N/A' ne le rattrapait pas a l'affichage.
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

function bancEssai() {
    const base = {
        transactions: [
            { id: 'TRX-1', clientName: 'undefined', orderId: 'CMD-1' },
            { id: 'TRX-2', clientName: '', orderId: 'CMD-2' },
            { id: 'TRX-3', clientName: null, orderId: 'CMD-3' },
            { id: 'TRX-4', clientName: 'Karim Meziane', orderId: 'CMD-1' }, // deja correct
            { id: 'TRX-5', clientName: 'undefined', orderId: null },       // pas de commande liee
            { id: 'TRX-6', clientName: 'undefined', orderId: 'CMD-INEXISTANTE' }
        ],
        commandes: {
            'CMD-1': { id: 'CMD-1', clientId: 'C1' },
            'CMD-2': { id: 'CMD-2', clientId: 'C2' },
            'CMD-3': { id: 'CMD-3', clientId: null } // commande sans client
        },
        clients: {
            C1: { id: 'C1', firstName: 'Ahmed', lastName: 'Benali' },
            C2: { id: 'C2', firstName: 'Yacine', lastName: 'Boudiaf' }
        }
    };

    const { Op } = require('sequelize');

    const enregistrement = (t) => ({
        ...t,
        update: async (donnees) => Object.assign(t, donnees)
    });

    const modeles = {
        Vehicle: { findAll: async () => [] },
        Order: { findAll: async () => [], findByPk: async (id) => base.commandes[id] || null },
        Client: { findByPk: async (id) => base.clients[id] || null },
        CashTransaction: {
            findAll: async ({ where }) => {
                const valeurs = where[Op.or].map(c => c.clientName);
                return base.transactions
                    .filter(t => valeurs.includes(t.clientName) && t.orderId)
                    .map(enregistrement);
            }
        },
        Shipment: { findAll: async () => [] }
    };

    return { base, route: chargerAvecModeles('src/routes/maintenance.js', modeles) };
}

function extraireGestionnaire(route) {
    // express.Router() expose ses routes via .stack
    const couche = route.stack.find(c => c.route && c.route.path === '/heal-statuses');
    return couche.route.stack[couche.route.stack.length - 1].handle;
}

test('un nom corrompu est repare depuis le client reel de la commande', async () => {
    const { base, route } = bancEssai();
    const gestionnaire = extraireGestionnaire(route);

    let corps = null;
    const req = { user: { roleId: 'admin' } };
    const res = { json: (d) => { corps = d; } };
    await gestionnaire(req, res);

    assert.strictEqual(corps.success, true);
    assert.match(corps.message, /1 nom\(s\)|2 nom\(s\)/);

    const t1 = base.transactions.find(t => t.id === 'TRX-1');
    const t2 = base.transactions.find(t => t.id === 'TRX-2');
    assert.strictEqual(t1.clientName, 'Benali Ahmed');
    assert.strictEqual(t2.clientName, 'Boudiaf Yacine');
});

test('une transaction deja correcte n est pas touchee', async () => {
    const { base, route } = bancEssai();
    const gestionnaire = extraireGestionnaire(route);
    await gestionnaire({ user: { roleId: 'admin' } }, { json: () => {} });

    const t4 = base.transactions.find(t => t.id === 'TRX-4');
    assert.strictEqual(t4.clientName, 'Karim Meziane');
});

test('sans commande liee ou sans client, rien ne casse et rien ne change', async () => {
    const { base, route } = bancEssai();
    const gestionnaire = extraireGestionnaire(route);
    let corps = null;
    await gestionnaire({ user: { roleId: 'admin' } }, { json: (d) => { corps = d; } });

    assert.strictEqual(corps.success, true);
    const t3 = base.transactions.find(t => t.id === 'TRX-3'); // commande sans clientId
    assert.strictEqual(t3.clientName, null);
});
