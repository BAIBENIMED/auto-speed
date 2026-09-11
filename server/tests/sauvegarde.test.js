/**
 * Sauvegarde de la base : contenu complet, purge, et refus des chemins
 * qui sortiraient du dossier des sauvegardes.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { chargerAvecModeles } = require('./aide');

function bancEssai() {
    const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'sauvegarde-'));
    process.env.BACKUP_DIR = dossier;
    process.env.BACKUP_RETENTION = '3';
    delete process.env.BACKUP_EMAIL;

    const modeles = {
        Client: { findAll: async () => [{ id: 'C001', lastName: 'BAIBEN' }, { id: 'C002', lastName: 'MEZIANE' }] },
        Order: { findAll: async () => [{ id: 'CMD/2026/001', totalAmount: 4500000 }] },
        Vehicle: { findAll: async () => [{ id: 'VEH-001', chassisNumber: 'LB37622Z0SX616849' }] },
        sequelize: {},            // ne doit pas etre pris pour une table
        Sequelize: function () {}
    };

    return { dossier, service: chargerAvecModeles('src/services/backupService.js', modeles) };
}

test('la sauvegarde contient toutes les tables et se relit', async (t) => {
    const { dossier, service } = bancEssai();
    t.after(() => fs.rmSync(dossier, { recursive: true, force: true }));

    const resume = await service.creerSauvegarde();

    assert.ok(fs.existsSync(path.join(dossier, resume.fichier)));
    assert.strictEqual(resume.tables, 3, 'seuls les modeles doivent etre exportes');
    assert.strictEqual(resume.lignes, 4);

    const contenu = JSON.parse(
        zlib.gunzipSync(fs.readFileSync(path.join(dossier, resume.fichier))).toString('utf-8')
    );
    assert.strictEqual(contenu.application, 'AUTO SPEED');
    assert.strictEqual(contenu.tables.Client.length, 2);
    assert.strictEqual(contenu.tables.Vehicle[0].chassisNumber, 'LB37622Z0SX616849');
});

test('la purge ne garde que les plus recentes', async (t) => {
    const { dossier, service } = bancEssai();
    t.after(() => fs.rmSync(dossier, { recursive: true, force: true }));

    const recente = await service.creerSauvegarde();

    for (let i = 0; i < 5; i++) {
        const f = path.join(dossier, `auto-speed-2026-01-0${i + 1}_0900.json.gz`);
        fs.writeFileSync(f, zlib.gzipSync('{}'));
        fs.utimesSync(f, new Date(2026, 0, i + 1), new Date(2026, 0, i + 1));
    }

    await service.purger();
    const restantes = await service.listerSauvegardes();

    assert.strictEqual(restantes.length, 3);
    assert.strictEqual(restantes[0].fichier, recente.fichier, 'la plus recente doit survivre');
});

test('un nom de fichier ne peut pas sortir du dossier des sauvegardes', async (t) => {
    const { dossier, service } = bancEssai();
    t.after(() => fs.rmSync(dossier, { recursive: true, force: true }));

    const resume = await service.creerSauvegarde();

    assert.strictEqual(service.cheminSauvegarde('../../server.js'), null);
    assert.strictEqual(service.cheminSauvegarde('/etc/passwd'), null);
    assert.strictEqual(service.cheminSauvegarde('secret.json.gz'), null);
    assert.ok(service.cheminSauvegarde(resume.fichier));
});

test('suppression par nom', async (t) => {
    const { dossier, service } = bancEssai();
    t.after(() => fs.rmSync(dossier, { recursive: true, force: true }));

    const resume = await service.creerSauvegarde();
    assert.strictEqual(await service.supprimerSauvegarde(resume.fichier), true);
    assert.strictEqual(fs.existsSync(path.join(dossier, resume.fichier)), false);
    assert.strictEqual(await service.supprimerSauvegarde(resume.fichier), false);
});
