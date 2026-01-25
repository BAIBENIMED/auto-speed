const { CashTransaction, Order } = require('../models');

const cashController = {
    getAll: async (req, res) => {
        try {
            const includeWhere = (req.user && !['admin', 'commercial'].includes(req.user.roleId)) ? { clientId: req.user.clientId } : {};
            const transactions = await CashTransaction.findAll({
                include: [{
                    model: Order,
                    as: 'order',
                    where: includeWhere
                }]
            });
            res.json({ success: true, data: transactions });
        } catch (error) {
            console.error('Error fetching cash transactions:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des transactions' });
        }
    },

    create: async (req, res) => {
        try {
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                if (!req.body.orderId) {
                    return res.status(400).json({ success: false, message: 'OrderId requis' });
                }
                const order = await Order.findByPk(req.body.orderId);
                if (!order || order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé à cette commande' });
                }
            }
            const transaction = await CashTransaction.create(req.body);
            res.status(201).json({ success: true, data: transaction });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la création de la transaction' });
        }
    },

    update: async (req, res) => {
        try {
            const transaction = await CashTransaction.findByPk(req.params.id);
            if (!transaction) {
                return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
            }

            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                const order = await Order.findByPk(transaction.orderId);
                if (order && order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }

            await transaction.update(req.body);
            res.json({ success: true, data: transaction });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour de la transaction' });
        }
    },

    delete: async (req, res) => {
        try {
            const transaction = await CashTransaction.findByPk(req.params.id);
            if (!transaction) {
                return res.status(404).json({ success: false, message: 'Transaction non trouvée' });
            }

            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                const order = await Order.findByPk(transaction.orderId);
                if (order && order.clientId !== req.user.clientId) {
                    return res.status(403).json({ success: false, message: 'Accès non autorisé' });
                }
            }

            await transaction.destroy();
            res.json({ success: true, message: 'Transaction supprimée' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la transaction' });
        }
    }
};

module.exports = cashController;
