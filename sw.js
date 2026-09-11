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
const CACHE = 'auto-speed-v1';

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

self.addEventListener('fetch', (evenement) => {
    const requete = evenement.request;
    if (requete.method !== 'GET') return;

    const url = new URL(requete.url);

    // Seules les ressources de l'application sont gerees
    if (url.origin !== self.location.origin) return;

    // Donnees : toujours le reseau, jamais de copie
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;

    // Ressource versionnee : son adresse change des qu'elle est modifiee
    if (url.searchParams.has('v')) {
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

    // Pages et autres fichiers : reseau d'abord, cache en secours
    evenement.respondWith(
        fetch(requete)
            .then((reponse) => {
                if (reponse.ok && requete.destination !== 'document') {
                    const copie = reponse.clone();
                    caches.open(CACHE).then((cache) => cache.put(requete, copie));
                }
                if (reponse.ok && requete.mode === 'navigate') {
                    const copie = reponse.clone();
                    caches.open(CACHE).then((cache) => cache.put('/index.html', copie));
                }
                return reponse;
            })
            .catch(() => caches.match(requete).then((enCache) => enCache || caches.match('/index.html')))
    );
});
