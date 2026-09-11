/**
 * Outils partages par les tests : ils remplacent les modeles Sequelize par des
 * objets en memoire, pour que la suite tourne sans MySQL.
 */
const path = require('path');
const Module = require('module');

const RACINE = path.join(__dirname, '..');

/**
 * Charge un module du serveur en lui injectant de faux modeles.
 * @param {string} relatif chemin depuis server/ (ex: 'src/services/x.js')
 * @param {object} modeles objets exposant findAll / findByPk / update...
 */
function chargerAvecModeles(relatif, modeles) {
    const cible = path.join(RACINE, relatif);
    delete require.cache[require.resolve(cible)];

    const origine = Module._load;
    Module._load = function (demande) {
        if (/models($|[\\/]index)/.test(demande) || demande.endsWith('/models')) return modeles;
        if (demande.includes('config/database')) {
            return { define: () => ({}), query: async () => [[]] };
        }
        return origine.apply(this, arguments);
    };

    try {
        return require(cible);
    } finally {
        Module._load = origine;
    }
}

module.exports = { RACINE, chargerAvecModeles };
