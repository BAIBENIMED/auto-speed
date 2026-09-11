/**
 * Service worker AUTO SPEED.
 *
 * Objectif : ouvrir l'application meme sans reseau (au port, en showroom),
 * sans jamais servir du code perime.
 *
 * - les fichiers demandes avec une empreinte (?v=...) sont immuables :
 *   servis depuis le cache, telecharges une seule fois ;
 * - les pages sont cherchees sur le reseau d'abord, le cache ne sert que
 *   si la connexion manque ;
 * - les appels a l'API ne sont jamais mis en cache : l'application a deja
 *   son propre cache de donnees dans le navigateur.
 */
// Le numero change a chaque evolution : l'activation purge alors l'ancien
// cache, y compris celui laisse par une version precedente du fichier.
const CACHE = 'auto-speed-v2';

const COQUILLE = [
    '/index.html',
    '/assets/logo.png',
    '/assets/icone-192.png',
    '/assets/icone-512.png',
    '/manifest.json'
];

self.addEventListener('install', (evenement) => {
    evenement.waitUntil(
        caches.open(CACHE)
            .then((cache) => cache.addAll(COQUILLE).catch(() => null))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (evenement) => {
    evenement.waitUntil(
        caches.keys()
            .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (evenement) => {
    if (evenement.data === 'vider-cache') {
        caches.delete(CACHE);
    }
});

// Seuls ces fichiers sont geres : tout le reste, a commencer par les appels
// de donnees, passe directement au reseau. Une liste de ce qu'on accepte est
// plus sure qu'une liste de ce qu'on exclut : un nouveau type d'appel ne
// peut pas se retrouver intercepte par megarde.
const EXTENSIONS_GEREES = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico', '.woff', '.woff2'];

function estRessourceStatique(url) {
    const chemin = url.pathname.toLowerCase();
    if (chemin.startsWith('/api/') || chemin.startsWith('/uploads/')) return false;
    return EXTENSIONS_GEREES.some((e) => chemin.endsWith(e)) || chemin === '/manifest.json';
}

self.addEventListener('fetch', (evenement) => {
    const requete = evenement.request;
    if (requete.method !== 'GET') return;

    // Une requete qui porte un jeton ne doit jamais passer par le cache
    if (requete.headers.has('Authorization')) return;

    const url = new URL(requete.url);

    // Seules les ressources de l'application sont gerees
    if (url.origin !== self.location.origin) return;

    const navigation = requete.mode === 'navigate';
    if (!navigation && !estRessourceStatique(url)) return;

    // Ressource versionnee : son adresse change des qu'elle est modifiee
    if (!navigation && url.searchParams.has('v')) {
        evenement.respondWith(
            caches.match(requete).then((enCache) => enCache || fetch(requete).then((reponse) => {
                if (reponse.ok) {
                    const copie = reponse.clone();
                    caches.open(CACHE).then((cache) => cache.put(requete, copie));
                }
                return reponse;
            }))
        );
        return;
    }

    // Pages et fichiers sans empreinte : reseau d'abord, cache en secours.
    // Le cache ne sert que si la requete echoue vraiment, jamais autrement.
    evenement.respondWith(
        fetch(requete)
            .then((reponse) => {
                if (!reponse.ok) return reponse;

                const copie = reponse.clone();
                caches.open(CACHE).then((cache) => cache.put(navigation ? '/index.html' : requete, copie));
                return reponse;
            })
            .catch(() => caches.match(requete)
                .then((enCache) => enCache || (navigation ? caches.match('/index.html') : Response.error())))
    );
});
