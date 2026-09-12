/**
 * Un vehicule appartenant a un partenaire (chargement de conteneur partage,
 * ex : CARVEX AUTO) ne doit jamais pouvoir etre affecte a une commande
 * AUTO SPEED. Le garde-fou vit dans vehiclesController, point de passage
 * oblige quel que soit le chemin emprunte cote client.
 */
const test = require('node:test');
const assert = require('node:assert');
const { chargerAvecModeles } = require('./aide');

function bancEssai(vehicules) {
    const enregistrement = (v) => ({
        ...v,
        update: async (donnees) => Object.assign(v, donnees)
    });

    const modeles = {
        Vehicle: {
            findByPk: async (id) => {
                const v = vehicules.find(x => x.id === id);
                return v ? enregistrement(v) : null;
            },
            findOne: async () => null,
            findAll: async () => []
        },
        Order: { findByPk: async () => null }
    };

    return chargerAvecModeles('src/controllers/vehiclesController.js', modeles);
}

function reponseFactice() {
    const r = { statusCode: 200, corps: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (d) => { r.corps = d; return r; };
    return r;
}

test('modification : impossible d affecter une commande a un vehicule deja partenaire', async () => {
    const vehicules = [{ id: 'V1', partner: 'CARVEX AUTO', orderId: null }];
    const controleur = bancEssai(vehicules);

    const req = { params: { id: 'V1' }, body: { orderId: 'CMD/2026/001' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.match(res.corps.message, /CARVEX AUTO/);
    assert.strictEqual(vehicules[0].orderId, null, 'la commande ne doit pas avoir ete ecrite');
});

test('modification : impossible de rendre partenaire un vehicule deja affecte', async () => {
    const vehicules = [{ id: 'V2', partner: null, orderId: 'CMD/2026/002' }];
    const controleur = bancEssai(vehicules);

    const req = { params: { id: 'V2' }, body: { partner: 'CARVEX AUTO' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(res.statusCode, 409);
    assert.strictEqual(vehicules[0].partner, null);
});

test('modification : un vehicule sans partenaire s affecte normalement', async () => {
    const vehicules = [{ id: 'V3', partner: null, orderId: null }];
    const controleur = bancEssai(vehicules);

    const req = { params: { id: 'V3' }, body: { orderId: 'CMD/2026/003' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(vehicules[0].orderId, 'CMD/2026/003');
});

test('modification : retirer le partenaire en meme temps qu on affecte est accepte', async () => {
    // Cas volontaire : l'utilisateur reprend un vehicule partenaire dans le
    // stock AUTO SPEED en videant le champ partenaire dans la meme requete.
    const vehicules = [{ id: 'V4', partner: 'CARVEX AUTO', orderId: null }];
    const controleur = bancEssai(vehicules);

    const req = { params: { id: 'V4' }, body: { partner: '', orderId: 'CMD/2026/004' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(vehicules[0].orderId, 'CMD/2026/004');
});

test('creation : refusee si partenaire et commande sont fournis ensemble', async () => {
    const controleur = bancEssai([]);
    const req = { body: { brand: 'Geely', partner: 'CARVEX AUTO', orderId: 'CMD/2026/005' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.create(req, res);

    assert.strictEqual(res.statusCode, 409);
});

test('un vehicule partenaire accepte un client : ses papiers restent necessaires', async () => {
    // Le blocage porte sur la commande AUTO SPEED, pas sur le client : il faut
    // pouvoir enregistrer le proprietaire (passeport, NIN) pour le dedouanement.
    const vehicules = [{ id: 'V5', partner: 'CARVEX AUTO', orderId: null, clientId: null }];
    const controleur = bancEssai(vehicules);

    const req = { params: { id: 'V5' }, body: { clientId: 'C001' }, user: { id: 'u1', name: 'Admin', roleId: 'admin' } };
    const res = reponseFactice();
    await controleur.update(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(vehicules[0].clientId, 'C001');
    assert.strictEqual(vehicules[0].partner, 'CARVEX AUTO', 'le partenaire reste en place');
});
