/**
 * Sauvegarde de la base AUTO SPEED.
 *
 * L'export est un JSON compresse (gzip) contenant toutes les tables metier.
 * Il est volontairement independant de MySQL : il se relit avec n'importe
 * quel outil et se reimporte table par table.
 *
 * Attention : sur un hebergement sans disque persistant (Render gratuit), le
 * dossier est efface a chaque redeploiement. Les sauvegardes doivent donc
 * etre telechargees regulierement, ou envoyees par courriel via BACKUP_EMAIL.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const modeles = require('../models');

const DOSSIER = process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups');
const RETENTION = parseInt(process.env.BACKUP_RETENTION || '14', 10);
const PREFIXE = 'auto-speed-';

// Les cles de models/index qui sont bien des modeles Sequelize
const tables = () => Object.keys(modeles).filter(
    (nom) => modeles[nom] && typeof modeles[nom].findAll === 'function'
);

function assurerDossier() {
    if (!fs.existsSync(DOSSIER)) fs.mkdirSync(DOSSIER, { recursive: true });
    return DOSSIER;
}

function horodatage(date = new Date()) {
    const d = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${d(date.getMonth() + 1)}-${d(date.getDate())}_${d(date.getHours())}${d(date.getMinutes())}`;
}

/** Nom de fichier sans chemin, pour refuser toute traversee de dossier. */
function nomSur(nom) {
    const base = path.basename(String(nom || ''));
    if (!base.startsWith(PREFIXE) || !base.endsWith('.json.gz')) return null;
    return base;
}

/**
 * Cree une sauvegarde complete et renvoie ses metadonnees.
 */
async function creerSauvegarde() {
    assurerDossier();

    const contenu = {
        application: 'AUTO SPEED',
        version: 1,
        creeLe: new Date().toISOString(),
        tables: {}
    };

    let lignes = 0;
    for (const nom of tables()) {
        const enregistrements = await modeles[nom].findAll({ raw: true });
        contenu.tables[nom] = enregistrements;
        lignes += enregistrements.length;
    }

    const fichier = `${PREFIXE}${horodatage()}.json.gz`;
    const chemin = path.join(DOSSIER, fichier);
    await fs.promises.writeFile(chemin, await gzip(Buffer.from(JSON.stringify(contenu), 'utf-8')));

    const infos = await fs.promises.stat(chemin);
    const resume = {
        fichier,
        taille: infos.size,
        creeLe: infos.mtime,
        tables: Object.keys(contenu.tables).length,
        lignes
    };

    console.log(`[Sauvegarde] ${fichier} — ${resume.tables} tables, ${lignes} lignes, ${Math.round(infos.size / 1024)} Ko`);
    return resume;
}

/** Sauvegardes presentes, de la plus recente a la plus ancienne. */
async function listerSauvegardes() {
    assurerDossier();
    const fichiers = await fs.promises.readdir(DOSSIER);

    const liste = [];
    for (const f of fichiers) {
        if (!nomSur(f)) continue;
        const infos = await fs.promises.stat(path.join(DOSSIER, f));
        liste.push({ fichier: f, taille: infos.size, creeLe: infos.mtime });
    }

    return liste.sort((a, b) => b.creeLe - a.creeLe);
}

/** Ne garde que les `retention` sauvegardes les plus recentes. */
async function purger(retention = RETENTION) {
    const liste = await listerSauvegardes();
    const aSupprimer = liste.slice(retention);

    for (const s of aSupprimer) {
        await fs.promises.unlink(path.join(DOSSIER, s.fichier));
        console.log(`[Sauvegarde] purge de ${s.fichier}`);
    }

    return aSupprimer.length;
}

/** Chemin d'une sauvegarde, ou null si le nom est invalide ou absente. */
function cheminSauvegarde(nom) {
    const sur = nomSur(nom);
    if (!sur) return null;
    const chemin = path.join(DOSSIER, sur);
    return fs.existsSync(chemin) ? chemin : null;
}

async function supprimerSauvegarde(nom) {
    const chemin = cheminSauvegarde(nom);
    if (!chemin) return false;
    await fs.promises.unlink(chemin);
    return true;
}

/**
 * Envoie la sauvegarde par courriel quand BACKUP_EMAIL est renseigne : c'est
 * le seul moyen de la sortir de l'hebergement sans intervention humaine.
 */
async function envoyerParCourriel(resume) {
    const destinataire = process.env.BACKUP_EMAIL;
    if (!destinataire) return false;

    try {
        const mailService = require('./mailService');
        const transporter = mailService.getTransporter();
        if (!transporter) return false;

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: destinataire,
            subject: `Sauvegarde AUTO SPEED — ${resume.fichier}`,
            text: `Sauvegarde automatique du ${new Date(resume.creeLe).toLocaleString('fr-FR')}.\n`
                + `${resume.tables} tables, ${resume.lignes} lignes, ${Math.round(resume.taille / 1024)} Ko.\n\n`
                + `Conservez ce fichier : il permet de restaurer la base.`,
            attachments: [{ filename: resume.fichier, path: path.join(DOSSIER, resume.fichier) }]
        });

        console.log(`[Sauvegarde] envoyee a ${destinataire}`);
        return true;
    } catch (e) {
        console.error('[Sauvegarde] echec de l\'envoi par courriel :', e.message);
        return false;
    }
}

/** Sauvegarde quotidienne : creation, purge, puis envoi si configure. */
async function sauvegardeQuotidienne() {
    const resume = await creerSauvegarde();
    await purger();
    await envoyerParCourriel(resume);
    return resume;
}

module.exports = {
    DOSSIER,
    RETENTION,
    creerSauvegarde,
    listerSauvegardes,
    purger,
    cheminSauvegarde,
    supprimerSauvegarde,
    sauvegardeQuotidienne
};
