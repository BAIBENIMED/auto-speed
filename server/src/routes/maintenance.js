const express = require('express');
const router = express.Router();
const { Shipment, Vehicle, Order, CashTransaction, Client } = require('../models');
const { Op } = require('sequelize');
const { syncShipmentStatusToOrders } = require('../utils/statusSynchronizer');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// Global Status Healing
router.post('/heal-statuses', authMiddleware, isAdmin, async (req, res) => {
    try {
        console.log('💊 Starting Global Status Healing...');

        // 1. Recover broken links: Ensure order.vehicleId and vehicle.orderId match
        const vehiclesWithOrders = await Vehicle.findAll({
            where: { orderId: { [Op.ne]: null } }
        });

        for (const v of vehiclesWithOrders) {
            const order = await Order.findByPk(v.orderId);
            if (order && order.vehicleId !== v.id) {
                console.log(`🔗 Healing link: Order ${order.id} -> Vehicle ${v.id}`);
                await order.update({ vehicleId: v.id });
            }
        }

        const ordersWithVehicles = await Order.findAll({
            where: { vehicleId: { [Op.ne]: null } }
        });

        for (const o of ordersWithVehicles) {
            const vehicle = await Vehicle.findByPk(o.vehicleId);
            if (vehicle && vehicle.orderId !== o.id) {
                console.log(`🔗 Healing link: Vehicle ${vehicle.id} -> Order ${o.id}`);
                await vehicle.update({ orderId: o.id });
            }
        }

        // 2. Sync every active shipment to its orders
        const activeShipments = await Shipment.findAll({
            where: { isArchived: false }
        });

        for (const shipment of activeShipments) {
            console.log(`🔄 Re-syncing shipment ${shipment.id} (${shipment.status})`);
            await syncShipmentStatusToOrders(shipment.id, shipment.status);
        }

        // 3. Nom de client corrompu en caisse : un encaissement enregistre depuis
        //    une commande lisait un champ absent de l'objet Order, ce qui
        //    inserait litteralement le texte « undefined » (pas une valeur
        //    vide, un veritable mot) dans le champ. On le rebranche sur le
        //    client reel de la commande liee quand c'est possible.
        const transactionsACorriger = await CashTransaction.findAll({
            where: {
                [Op.or]: [
                    { clientName: 'undefined' },
                    { clientName: null },
                    { clientName: '' }
                ],
                orderId: { [Op.ne]: null }
            }
        });

        let nomsRepares = 0;
        for (const transaction of transactionsACorriger) {
            const commande = await Order.findByPk(transaction.orderId);
            if (!commande || !commande.clientId) continue;

            const client = await Client.findByPk(commande.clientId);
            const nom = client ? `${client.lastName || ''} ${client.firstName || ''}`.trim() : '';
            if (!nom) continue;

            await transaction.update({ clientName: nom });
            nomsRepares++;
            console.log(`👤 Nom repare en caisse : ${transaction.id} -> ${nom}`);
        }

        res.json({
            success: true,
            message: `La guérison des statuts est terminée avec succès.${nomsRepares > 0 ? ` ${nomsRepares} nom(s) de client réparé(s) en caisse.` : ''}`
        });
    } catch (error) {
        console.error('Failed to heal statuses:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// --- Sauvegardes de la base -------------------------------------------------
// Reservees a l'administrateur : l'export contient toutes les donnees clients.
const backupService = require('../services/backupService');

router.get('/backups', authMiddleware, isAdmin, async (req, res) => {
    try {
        const sauvegardes = await backupService.listerSauvegardes();
        res.json({
            success: true,
            data: sauvegardes,
            retention: backupService.RETENTION,
            envoiCourriel: !!process.env.BACKUP_EMAIL
        });
    } catch (error) {
        console.error('Liste des sauvegardes :', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/backups', authMiddleware, isAdmin, async (req, res) => {
    try {
        const resume = await backupService.creerSauvegarde();
        await backupService.purger();
        res.json({ success: true, data: resume });
    } catch (error) {
        console.error('Creation de sauvegarde :', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/backups/:fichier', authMiddleware, isAdmin, (req, res) => {
    const chemin = backupService.cheminSauvegarde(req.params.fichier);
    if (!chemin) {
        return res.status(404).json({ success: false, message: 'Sauvegarde introuvable' });
    }
    res.download(chemin);
});

router.delete('/backups/:fichier', authMiddleware, isAdmin, async (req, res) => {
    try {
        const supprimee = await backupService.supprimerSauvegarde(req.params.fichier);
        if (!supprimee) {
            return res.status(404).json({ success: false, message: 'Sauvegarde introuvable' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;


