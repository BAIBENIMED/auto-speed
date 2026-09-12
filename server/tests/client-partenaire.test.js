/**
 * Le showroom ne concerne que les clients AUTO SPEED. Un client rattache a un
 * partenaire (CARVEX AUTO...) n'appartient a aucun de nos points de vente :
 * ses papiers nous servent pour le dedouanement, pas pour le rattacher a une
 * boutique.
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

function bancEssai(clients) {
    const enregistrement = (c) => ({
        ...c,
        update: async (donnees) => Object.assign(c, donnees)
    });

    const modeles = {
        Client: {
            findByPk: async (id) => {
                const c = clients.find(x => x.id === id);
                return c ? enregistrement(c) : null;
            },
            findOne: async () => null,
            findAll: async () => [],
            create: async (donnees) => {
                const cree = { id: 'C-NEW', ...donnees };
                clients.push(cree);
                return cree;
            }
        },
        Order: { findAll: async () => [], findByPk: async () => null },
        Vehicle: { findAll: async () => [] }
    };

    return chargerAvecModeles('src/controllers/clientController.js', modeles);
}

function reponseFactice() {
    const r = { statusCode: 200, corps: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (d) => { r.corps = d; return r; };
    return r;
}

test('creation : le showroom est efface pour un client de partenaire', async () => {
    const clients = [];
    const controleur = bancEssai(clients);

    const req = { body: { firstName: 'Ali', lastName: 'Benyoucef', partner: 'CARVEX AUTO', showroom: 'EULMA' } };
    const res = reponseFactice();
    await controleur.create(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(clients[0].showroom, null);
    assert.strictEqual(clients[0].partner, 'CARVEX AUTO');
});

test('creation : un client AUTO SPEED garde son showroom', async () => {
    const clients = [];
    const controleur = bancEssai(clients);

    const req = { body: { firstName: 'Sofiane', lastName: 'Haddad', showroom: 'SETIF' } };
    const res = reponseFactice();
    await controleur.create(req, res);

    assert.strictEqual(clients[0].showroom, 'SETIF');
});

test('modification : passer un client en partenaire retire son showroom', async () => {
    const clients = [{ id: 'C1', partner: null, showroom: 'MSILA' }];
    const controleur = bancEssai(clients);

    const req = { params: { id: 'C1' }, body: { partner: 'CARVEX AUTO' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(clients[0].showroom, null);
});

test('modification : un client deja partenaire ne peut pas recuperer un showroom', async () => {
    const clients = [{ id: 'C2', partner: 'CARVEX AUTO', showroom: null }];
    const controleur = bancEssai(clients);

    // Le formulaire ne renvoie pas partner, mais la fiche est deja partenaire
    const req = { params: { id: 'C2' }, body: { showroom: 'EULMA' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(clients[0].showroom, null);
});

test('modification : retirer le partenaire rend le showroom possible', async () => {
    const clients = [{ id: 'C3', partner: 'CARVEX AUTO', showroom: null }];
    const controleur = bancEssai(clients);

    const req = { params: { id: 'C3' }, body: { partner: '', showroom: 'EULMA' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(clients[0].showroom, 'EULMA');
});
