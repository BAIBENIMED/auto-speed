/**
 * Le rattrapage des colonnes tourne pendant que les requetes /api attendent :
 * son cout en allers-retours vers la base est une contrainte, pas un detail.
 * Ces tests verifient a la fois ce qu'il ecrit et combien il interroge.
 */
const test = require('node:test');
const assert = require('node:assert');
const {
    creerLecteurStructure,
    appliquerListeExplicite,
    appliquerModeles
} = require('../src/utils/verificationSchema');

const silence = { log: () => {}, error: () => {} };

/** Fausse base : retient chaque requete pour pouvoir les compter. */
function fausseBase(colonnesParTable) {
    const requetes = [];

    return {
        requetes,
        lectures: () => requetes.filter(q => q.startsWith('SHOW COLUMNS')).length,
        ecritures: () => requetes.filter(q => q.includes('ADD COLUMN')).length,
        query: async (sql) => {
            requetes.push(sql);

            const lecture = /SHOW COLUMNS FROM `(\w+)`/.exec(sql);
            if (lecture) {
                const table = lecture[1];
                if (!colonnesParTable[table]) throw new Error(`Table '${table}' doesn't exist`);
                return [colonnesParTable[table].map(f => ({ Field: f }))];
            }

            const ecriture = /ALTER TABLE `?(\w+)`? ADD COLUMN `?(\w+)`?/.exec(sql);
            if (ecriture) colonnesParTable[ecriture[1]].push(ecriture[2]);
            return [[]];
        }
    };
}

const faireModele = (tableName, attributs) => ({
    getTableName: () => tableName,
    rawAttributes: attributs
});

const champ = (fieldName, sql, field) => ({
    fieldName, field, type: { toSql: () => sql }
});

test('schema deja a jour : aucune ecriture, une seule lecture par table', async () => {
    const base = fausseBase({
        shipments: ['id', 'current_lat', 'voyage'],
        settings: ['id', 'partners']
    });
    const colonnesDe = creerLecteurStructure(base);

    const liste = [
        { table: 'shipments', name: 'current_lat', def: 'DECIMAL(10,8)' },
        { table: 'shipments', name: 'voyage', def: 'VARCHAR(100)' },
        { table: 'settings', name: 'partners', def: 'JSON' }
    ];
    const bilan = await appliquerListeExplicite(base, colonnesDe, liste, silence);

    assert.deepStrictEqual(bilan, { ajoutees: 0, echecs: 0 });
    assert.strictEqual(base.ecritures(), 0, 'aucun ALTER ne doit partir quand tout est en place');
    assert.strictEqual(base.lectures(), 2, 'une lecture par table distincte, pas par colonne');
});

test('colonne manquante : elle est ajoutee, les autres sont laissees', async () => {
    const base = fausseBase({ settings: ['id', 'carriers'] });
    const colonnesDe = creerLecteurStructure(base);

    const bilan = await appliquerListeExplicite(base, colonnesDe, [
        { table: 'settings', name: 'carriers', def: 'JSON' },
        { table: 'settings', name: 'partners', def: 'JSON' }
    ], silence);

    assert.strictEqual(bilan.ajoutees, 1);
    assert.strictEqual(base.ecritures(), 1);
    assert.ok(base.requetes.some(q => q.includes('ADD COLUMN partners JSON')));
});

test('le cache est partage entre la liste et les modeles', async () => {
    const base = fausseBase({ vehicles: ['id'] });
    const colonnesDe = creerLecteurStructure(base);

    await appliquerListeExplicite(base, colonnesDe, [
        { table: 'vehicles', name: 'partner', def: 'VARCHAR(100)' }
    ], silence);

    // Le modele declare partner (deja ajoute) et delivery_location (manquant)
    const models = {
        Vehicle: faireModele('vehicles', {
            partner: champ('partner', 'VARCHAR(100)'),
            deliveryLocation: champ('deliveryLocation', 'VARCHAR(200)', 'delivery_location')
        })
    };
    await appliquerModeles(base, colonnesDe, models, silence);

    assert.strictEqual(base.lectures(), 1, 'la table ne doit etre lue qu une fois pour les deux filets');
    assert.strictEqual(base.ecritures(), 2, 'partner puis delivery_location');
    assert.ok(!base.requetes.filter(q => q.includes('ADD COLUMN')).some((q, i, t) =>
        t.indexOf(q) !== i), 'aucune colonne ne doit etre ajoutee deux fois');
});

test('le nom de colonne physique prime sur le nom d attribut', async () => {
    const base = fausseBase({ voyages: ['id', 'bl_number'] });
    const colonnesDe = creerLecteurStructure(base);

    const models = {
        Voyage: faireModele('voyages', { blNumber: champ('blNumber', 'VARCHAR(100)', 'bl_number') })
    };
    const bilan = await appliquerModeles(base, colonnesDe, models, silence);

    assert.deepStrictEqual(bilan, { ajoutees: 0, echecs: 0 });
    assert.strictEqual(base.ecritures(), 0);
});

test('une table absente n empeche pas de verifier les suivantes', async () => {
    const base = fausseBase({ clients: ['id'] });
    const colonnesDe = creerLecteurStructure(base);
    const erreurs = [];

    const models = {
        Fantome: faireModele('table_inexistante', { x: champ('x', 'INT') }),
        Client: faireModele('clients', { partner: champ('partner', 'VARCHAR(100)') })
    };
    const bilan = await appliquerModeles(base, colonnesDe, models,
        { log: () => {}, error: (m) => erreurs.push(m) });

    assert.strictEqual(bilan.ajoutees, 1, 'clients.partner doit malgre tout etre ajoutee');
    assert.strictEqual(bilan.echecs, 1, 'la table absente doit etre comptee comme un echec');
    assert.strictEqual(erreurs.length, 1);
});

test('les entrees non-modeles de l index sont ignorees', async () => {
    const base = fausseBase({ clients: ['id'] });
    const colonnesDe = creerLecteurStructure(base);

    // models exporte aussi sequelize et Sequelize, qui ne sont pas des tables
    const models = {
        sequelize: { query: async () => [[]] },
        Sequelize: function () {},
        Client: faireModele('clients', { id: champ('id', 'VARCHAR(50)') })
    };
    await appliquerModeles(base, colonnesDe, models, silence);

    assert.strictEqual(base.lectures(), 1, 'seule la table du modele Client doit etre lue');
});

test('aucune colonne n est jamais modifiee ni supprimee', async () => {
    const base = fausseBase({ settings: ['id'] });
    const colonnesDe = creerLecteurStructure(base);

    await appliquerListeExplicite(base, colonnesDe, [
        { table: 'settings', name: 'partners', def: 'JSON' }
    ], silence);
    await appliquerModeles(base, colonnesDe, {
        Settings: faireModele('settings', { coef: champ('coef', 'DECIMAL(8,4)') })
    }, silence);

    const dangereuses = base.requetes.filter(q => /DROP|MODIFY|CHANGE|TRUNCATE|DELETE/i.test(q));
    assert.deepStrictEqual(dangereuses, []);
});

test('le cout total reste proportionnel au nombre de tables, pas de colonnes', async () => {
    // Reproduit la situation reelle : 75 colonnes attendues sur 9 tables,
    // toutes deja presentes. L'ancienne version envoyait 75 ALTER.
    const tables = {};
    const liste = [];
    for (let t = 0; t < 9; t++) {
        const nom = `table_${t}`;
        tables[nom] = ['id'];
        for (let c = 0; c < 8; c++) {
            tables[nom].push(`col_${c}`);
            liste.push({ table: nom, name: `col_${c}`, def: 'INT' });
        }
    }

    const base = fausseBase(tables);
    const colonnesDe = creerLecteurStructure(base);
    await appliquerListeExplicite(base, colonnesDe, liste, silence);

    assert.strictEqual(liste.length, 72);
    assert.strictEqual(base.requetes.length, 9, `${base.requetes.length} requetes au lieu de 9`);
});

test('base injoignable : les echecs sont comptes, aucun succes annonce', async () => {
    // Sans ce comptage, un demarrage sans base affichait « Schema a jour ».
    const base = fausseBase({});
    const colonnesDe = creerLecteurStructure(base);

    const liste = await appliquerListeExplicite(base, colonnesDe, [
        { table: 'settings', name: 'partners', def: 'JSON' }
    ], silence);
    const modeles = await appliquerModeles(base, colonnesDe, {
        Client: faireModele('clients', { partner: champ('partner', 'VARCHAR(100)') })
    }, silence);

    assert.strictEqual(liste.ajoutees + modeles.ajoutees, 0);
    assert.ok(liste.echecs + modeles.echecs > 0, 'l impossibilite de lire doit etre signalee');
});
