const express = require('express');
const router = express.Router();
const { Shipment } = require('../models');
const { Op } = require('sequelize');
const voyageTrackingService = require('../services/voyageTrackingService');
const containerTrackingService = require('../services/containerTrackingService');

const { authMiddleware, isAdmin } = require('../middleware/auth');

router.use(authMiddleware);

// Get tracking info for a Voyage (finds first valid BL or container in voyage)
router.get('/voyage/:voyageName', async (req, res) => {
    try {
        const { voyageName } = req.params;
        const result = await voyageTrackingService.refreshVoyage(voyageName);

        if (result.success) {
            res.json({ success: true, data: { ...result.data, voyageName } });
        } else {
            res.status(404).json({ success: false, message: result.message });
        }
    } catch (error) {
        console.error('Voyage tracking route error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors du suivi du voyage' });
    }
});

// Refresh and sync tracking for a specific shipment ID
router.post('/:id/refresh', async (req, res) => {
    try {
        const { id } = req.params;
        const shipment = await Shipment.findByPk(id);

        if (!shipment) {
            return res.status(404).json({ success: false, message: 'Expédition non trouvée' });
        }

        const identifier = shipment.blNumber || shipment.containerNumber;
        if (!identifier) {
            return res.status(400).json({ success: false, message: 'Aucun BL ou numéro de conteneur' });
        }

        // --- NEW LOGIC: Delegate to VoyageTrackingService if part of a Voyage ---
        let voyageIdentifier = shipment.voyage;
        let isRefByVoyageId = false;

        if (shipment.voyageId) {
            voyageIdentifier = shipment.voyageId;
            isRefByVoyageId = true;
        } else if (!voyageIdentifier && shipment.voyageId) {
            // Fallback (redundant safeguard)
            voyageIdentifier = shipment.voyageId;
            isRefByVoyageId = true;
        }

        if (voyageIdentifier) {
            console.log(`[Tracking] Shipment ${id} belongs to Voyage '${voyageIdentifier}'. Refreshing entire voyage instead.`);
            const result = await voyageTrackingService.refreshVoyage(voyageIdentifier, isRefByVoyageId);
            if (!result.success) {
                return res.json(result); // Return the detailed error (e.g. from Siney API)
            }
            // Add identifier so the frontend modal can display it
            return res.json({ success: true, data: { ...result.data, identifier } });
        }
        // ------------------------------------------------------------------------

        console.log(`[Tracking] Syncing shipment ${id} via ${identifier} (Individual)`);

        const resultat = await voyageTrackingService.refreshShipment(shipment);
        if (!resultat.success) {
            return res.json({
                success: false,
                message: resultat.message,
                carrierInfo: resultat.carrierInfo,
                identifier
            });
        }

        res.json({ success: true, data: resultat.data });
    } catch (error) {
        console.error('Shipment refresh error:', error);
        res.status(500).json({ success: false, message: 'Erreur: ' + error.message });
    }
});


// Toggle tracking activation for a voyage
router.post('/voyage/:voyageName/toggle', async (req, res) => {
    try {
        const { voyageName } = req.params;
        const { active } = req.body;

        await Shipment.update(
            { isTrackingActive: !!active },
            { where: { voyage: voyageName } }
        );

        res.json({ success: true, message: `Tracking ${active ? 'activé' : 'désactivé'} pour le voyage ${voyageName}` });
    } catch (error) {
        console.error('Voyage toggle error:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la modification du statut de suivi' });
    }
});

// Diagnostic du suivi maritime : dit pourquoi le tracking ne remonte rien
// (cle absente, cle refusee, quota, numero inconnu, API injoignable).
router.get('/diagnostic', isAdmin, async (req, res) => {
    try {
        let numero = (req.query.numero || '').trim();
        let choisiAutomatiquement = false;

        // Sans numero fourni, on prend celui de l'expedition en cours la plus
        // recente : un clic suffit alors pour obtenir un vrai diagnostic.
        if (!numero) {
            const expedition = await Shipment.findOne({
                where: {
                    isArchived: false,
                    [Op.or]: [
                        { containerNumber: { [Op.ne]: null } },
                        { blNumber: { [Op.ne]: null } }
                    ]
                },
                order: [['updatedAt', 'DESC']]
            });

            if (expedition) {
                numero = expedition.containerNumber || expedition.blNumber;
                choisiAutomatiquement = true;
            }
        }

        const rapport = await containerTrackingService.diagnostiquer(numero);
        rapport.numeroChoisiAutomatiquement = choisiAutomatiquement;
        res.json({ success: true, data: rapport });
    } catch (error) {
        console.error('Diagnostic du suivi :', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
