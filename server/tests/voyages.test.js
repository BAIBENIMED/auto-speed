/**
 * Le client (storage.js) ecrit l'identifiant attribue par le serveur dans sa
 * copie locale a la seule condition que la reponse ait la forme
 * { success: true, data: ... }. voyagesController renvoyait l'objet brut :
 * le voyage local restait sans id, donc impossible a modifier ensuite.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chargerAvecModeles, RACINE } = require('./aide');

function bancEssai(voyages) {
    // La copie renvoyee doit refleter la mise a jour, comme une instance
    // Sequelize : sinon le test mesure le banc d'essai, pas le controleur.
    const enregistrement = (v) => {
        const copie = { ...v };
        copie.update = async (donnees) => { Object.assign(v, donnees); Object.assign(copie, donnees); };
        copie.destroy = async () => { voyages.splice(voyages.indexOf(v), 1); };
        return copie;
    };

    const modeles = {
        Voyage: {
            findAll: async () => voyages.map(enregistrement),
            findByPk: async (id) => {
                const v = voyages.find(x => String(x.id) === String(id));
                return v ? enregistrement(v) : null;
            },
            findOne: async ({ where }) => {
                const v = voyages.find(x => x.name === where.name);
                return v ? enregistrement(v) : null;
            },
            create: async (donnees) => {
                const cree = { id: voyages.length + 1, ...donnees };
                voyages.push(cree);
                return cree;
            }
        },
        Shipment: { update: async () => [0], findAll: async () => [] }
    };

    return chargerAvecModeles('src/controllers/voyagesController.js', modeles);
}

function reponseFactice() {
    const r = { statusCode: 200, corps: null };
    r.status = (code) => { r.statusCode = code; return r; };
    r.json = (d) => { r.corps = d; return r; };
    return r;
}

test('creation : la reponse porte l enveloppe attendue par le client', async () => {
    const voyages = [];
    const controleur = bancEssai(voyages);

    const res = reponseFactice();
    await controleur.createVoyage({ body: { name: 'NANSHA-ALGER-01', carrier: 'CMA CGM' } }, res);

    assert.strictEqual(res.statusCode, 201);
    // C'est exactement le test que fait storage.js avant de recopier l'id
    assert.strictEqual(res.corps.success, true, 'sans success:true le client ignore la reponse');
    assert.ok(res.corps.data, 'sans data le client ne peut pas recuperer l id');
    assert.strictEqual(res.corps.data.id, 1);
    assert.strictEqual(res.corps.data.name, 'NANSHA-ALGER-01');
});

test('creation : un nom deja pris est refuse proprement', async () => {
    const voyages = [{ id: 1, name: 'NANSHA-ALGER-01' }];
    const controleur = bancEssai(voyages);

    const res = reponseFactice();
    await controleur.createVoyage({ body: { name: 'NANSHA-ALGER-01' } }, res);

    assert.strictEqual(res.statusCode, 400);
    assert.strictEqual(res.corps.success, false);
    assert.strictEqual(voyages.length, 1);
});

test('mise a jour : enveloppe presente et donnees renvoyees', async () => {
    const voyages = [{ id: 7, name: 'V7', status: 'Planifié' }];
    const controleur = bancEssai(voyages);

    const res = reponseFactice();
    await controleur.updateVoyage({ params: { id: '7' }, body: { status: 'En mer' } }, res);

    assert.strictEqual(res.corps.success, true);
    assert.strictEqual(res.corps.data.status, 'En mer');
});

test('voyage introuvable : 404 avec success:false', async () => {
    const controleur = bancEssai([]);
    const res = reponseFactice();
    await controleur.updateVoyage({ params: { id: '99' }, body: {} }, res);

    assert.strictEqual(res.statusCode, 404);
    assert.strictEqual(res.corps.success, false);
});

test('aucun controleur ne renvoie un objet nu sur une creation', () => {
    // Garde-fou general : c'est l'ecart de voyagesController qui a fait
    // perdre le lien entre les voyages locaux et ceux du serveur.
    const dossier = path.join(RACINE, 'src', 'controllers');
    const fautifs = [];

    for (const fichier of fs.readdirSync(dossier).filter(f => f.endsWith('.js'))) {
        const contenu = fs.readFileSync(path.join(dossier, fichier), 'utf8');
        for (const retour of contenu.match(/status\(201\)\.json\([^;]*?\);/gs) || []) {
            if (!retour.includes('success')) fautifs.push(`${fichier} → ${retour.trim()}`);
        }
    }

    assert.deepStrictEqual(fautifs, [], 'reponses de creation sans { success, data }');
});
