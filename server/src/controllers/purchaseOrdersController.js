const { PurchaseOrder, Order, Supplier } = require('../models');

const purchaseOrdersController = {
    getAll: async (req, res) => {
        try {
            const pos = await PurchaseOrder.findAll({
                include: [
                    { model: Order, as: 'order' },
                    { model: Supplier, as: 'supplierDetails' }
                ],
                order: [['createdAt', 'DESC']]
            });
            res.json({ success: true, data: pos });
        } catch (error) {
            console.error('Error fetching purchase orders:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes d\'achat' });
        }
    },

    create: async (req, res) => {
        try {
            const { id, orderId, supplierId, supplierName, status, purchaseDate, notes } = req.body;

            // Check if purchase order already exists for this client order
            const existingPO = await PurchaseOrder.findOne({ where: { orderId } });
            if (existingPO) {
                return res.status(400).json({ success: false, message: 'Une commande d\'achat existe déjà pour cette commande client.' });
            }

            const po = await PurchaseOrder.create({
                id,
                orderId,
                supplierId,
                supplierName,
                status,
                purchaseDate,
                notes
            });

            res.status(201).json({ success: true, data: po });
        } catch (error) {
            console.error('Error creating purchase order:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la création de la commande d\'achat' });
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const po = await PurchaseOrder.findByPk(id);
            if (!po) {
                return res.status(404).json({ success: false, message: 'Commande d\'achat non trouvée' });
            }

            await po.update(req.body);
            res.json({ success: true, data: po });
        } catch (error) {
            console.error('Error updating purchase order:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour de la commande d\'achat' });
        }
    },

    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const po = await PurchaseOrder.findByPk(id);
            if (!po) {
                return res.status(404).json({ success: false, message: 'Commande d\'achat non trouvée' });
            }

            await po.destroy();
            res.json({ success: true, message: 'Commande d\'achat supprimée' });
        } catch (error) {
            console.error('Error deleting purchase order:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la commande d\'achat' });
        }
    }
};

module.exports = purchaseOrdersController;
