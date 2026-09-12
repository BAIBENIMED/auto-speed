/**
 * Rattrapage des colonnes manquantes au demarrage.
 *
 * Pourquoi ce fichier existe : sequelize.sync({ alter: true }) est abandonne
 * sur cette base (la table vehicles depasse la limite d'index de MySQL), donc
 * aucune colonne nouvelle n'y est jamais creee automatiquement. Deux filets
 * prennent le relais — une liste explicite, heritee, et une comparaison
 * generique entre chaque modele et sa table.
 *
 * Contrainte de performance : le serveur ecoute deja quand ce code tourne, et
 * les requetes /api l'attendent. Chaque aller-retour vers une base distante
 * coute environ 200 ms. Tenter les ALTER a l'aveugle en se fiant a l'erreur
 * « Duplicate column » revenait a 75 allers-retours, soit plus de 20 secondes.
 * On lit donc la structure une seule fois par table, et on n'ecrit que ce qui
 * manque reellement : en regime etabli, aucune ecriture.
 */

/**
 * Lecteur de structure memoise : une requete SHOW COLUMNS par table, au plus.
 */
function creerLecteurStructure(sequelize) {
    const cache = new Map();

    return async function colonnesDe(table) {
        if (!cache.has(table)) {
            const [colonnes] = await sequelize.query(`SHOW COLUMNS FROM \`${table}\``);
            cache.set(table, new Set(colonnes.map(c => c.Field)));
        }
        return cache.get(table);
    };
}

/**
 * Ajoute les colonnes d'une liste ecrite a la main (colonnes historiques, ou
 * absentes des modeles).
 * @returns {{ajoutees: number, echecs: number}}
 */
async function appliquerListeExplicite(sequelize, colonnesDe, liste, journal = console) {
    let ajoutees = 0;
    let echecs = 0;

    for (const col of liste) {
        try {
            const presentes = await colonnesDe(col.table);
            if (presentes.has(col.name)) continue;

            await sequelize.query(`ALTER TABLE ${col.table} ADD COLUMN ${col.name} ${col.def}`);
            presentes.add(col.name);
            ajoutees++;
            journal.log(`🔧 Column checked/added: ${col.table}.${col.name}`);
        } catch (erreur) {
            // Une colonne deja presente reste acceptable : la structure a pu
            // changer entre la lecture et l'ecriture.
            const dejaLa = erreur.message.includes('Duplicate column')
                || (erreur.original && erreur.original.code === 'ER_DUP_FIELDNAME');
            if (!dejaLa) {
                echecs++;
                journal.error(`⚠️ Could not verify/add column ${col.name} to ${col.table}:`, erreur.message);
            }
        }
    }

    return { ajoutees, echecs };
}

/**
 * Compare chaque modele a sa table et ajoute ce qui manque. N'ajoute jamais
 * rien d'autre : aucune colonne n'est modifiee ni supprimee.
 * @returns {{ajoutees: number, echecs: number}}
 */
async function appliquerModeles(sequelize, colonnesDe, models, journal = console) {
    let ajoutees = 0;
    let echecs = 0;

    for (const [nomModele, modele] of Object.entries(models)) {
        if (!modele || typeof modele.getTableName !== 'function' || !modele.rawAttributes) continue;

        try {
            const table = modele.getTableName();
            const presentes = await colonnesDe(table);

            for (const attribut of Object.values(modele.rawAttributes)) {
                const champ = attribut.field || attribut.fieldName;
                if (!champ || presentes.has(champ)) continue;

                const type = attribut.type && typeof attribut.type.toSql === 'function'
                    ? attribut.type.toSql()
                    : null;
                if (!type) continue;

                await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${champ}\` ${type} NULL`);
                presentes.add(champ);
                ajoutees++;
                journal.log(`🔧 Colonne manquante ajoutee : ${table}.${champ} (${type})`);
            }
        } catch (erreur) {
            // Une table absente ne doit pas empecher de verifier les suivantes
            echecs++;
            journal.error(`⚠️ Verification du schema impossible pour ${nomModele} :`, erreur.message);
        }
    }

    return { ajoutees, echecs };
}

module.exports = { creerLecteurStructure, appliquerListeExplicite, appliquerModeles };
