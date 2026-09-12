/**
 * Le serveur ecoute immediatement (Render coupe un service qui ne repond pas
 * a son controle de sante), mais la base n'est prete que quelques secondes
 * plus tard : verification du schema, colonnes manquantes, tables fail-safe.
 *
 * Entre les deux, les requetes /api tapent sur un schema incomplet. C'est ce
 * qui a produit « Unknown column 'partners' » : la synchronisation du
 * navigateur est arrivee avant que la colonne ne soit creee.
 *
 * Cette porte met ces requetes en attente. Elle ne les refuse jamais : au
 * pire elle les laisse passer apres un delai de securite, pour qu'une
 * initialisation bloquee ne rende pas l'application inutilisable.
 */
function creerPorteInitialisation(options = {}) {
    const attenteMaxMs = options.attenteMaxMs !== undefined ? options.attenteMaxMs : 20000;
    const journaliser = options.journaliser || console.warn;

    let prete = false;
    let liberer;
    const attente = new Promise((resolve) => { liberer = resolve; });

    return {
        estPrete: () => prete,

        /** Appele une fois l'initialisation terminee, reussie ou non. */
        marquerPrete() {
            if (prete) return;
            prete = true;
            liberer();
        },

        async milieu(req, res, next) {
            if (prete) return next();

            let horloge;
            const delaiDeSecurite = new Promise((resolve) => {
                horloge = setTimeout(() => resolve('delai'), attenteMaxMs);
                // Ne pas retenir le processus au moment de s'arreter
                if (horloge.unref) horloge.unref();
            });

            const issue = await Promise.race([attente.then(() => 'prete'), delaiDeSecurite]);
            clearTimeout(horloge);

            if (issue === 'delai') {
                journaliser(`⚠️ ${req.method} ${req.originalUrl} traite avant la fin de l'initialisation (attente de ${attenteMaxMs} ms depassee).`);
            }

            next();
        }
    };
}

module.exports = { creerPorteInitialisation };
