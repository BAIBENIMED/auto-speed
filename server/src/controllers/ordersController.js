const { Order, Client, Vehicle, CashTransaction, PurchaseOrder } = require('../models');
const mailService = require('../services/mailService');

const ordersController = {
    getAll: async (req, res) => {
        try {
            const { archived } = req.query;
            const where = {};
            if (archived !== undefined) {
                where.isArchived = archived === 'true';
            }

            // Filter by client if not admin or commercial
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                where.clientId = req.user.clientId;
            }
            const orders = await Order.findAll({
                where,
                include: [
                    { model: Client, as: 'client' },
                    { model: Vehicle, as: 'Vehicles' }
                ]
            });

            // Enrich with clientName for frontend compatibility
            const enrichedOrders = orders.map(o => {
                const orderData = o.toJSON();
                if (orderData.client) {
                    orderData.clientName = `${orderData.client.firstName} ${orderData.client.lastName}`;
                }
                if (orderData.Vehicles && orderData.Vehicles.length > 0) {
                    const v = orderData.Vehicles[0];
                    if (!orderData.vehicleName || orderData.vehicleName === 'undefined') {
                        orderData.vehicleName = `${v.brand} ${v.model || ''} (${v.year})`;
                    }
                }
                return orderData;
            });

            res.json({ success: true, data: enrichedOrders });
        } catch (error) {
            console.error('Error fetching orders:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes' });
        }
    },

    getById: async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id, {
                include: ['client', 'Vehicles', 'CashTransactions']
            });
            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId) && order.clientId !== req.user.clientId) {
                return res.status(403).json({ success: false, message: 'Accès non autorisé' });
            }
            const orderData = order.toJSON();
            if (orderData.client) {
                orderData.clientName = `${orderData.client.firstName} ${orderData.client.lastName}`;
            }
            if (orderData.Vehicles && orderData.Vehicles.length > 0) {
                const v = orderData.Vehicles[0];
                if (!orderData.vehicleName || orderData.vehicleName === 'undefined') {
                    orderData.vehicleName = `${v.brand} ${v.model || ''} (${v.year})`;
                }
            }
            res.json({ success: true, data: orderData });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération de la commande' });
        }
    },

    create: async (req, res) => {
        try {
            const orderData = { ...req.body };

            // Force client ID for non-privileged users
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
                orderData.clientId = req.user.clientId;
            }

            const order = await Order.create(orderData, {
                userId: req.user.id,
                userName: req.user.name
            });
            res.status(201).json({ success: true, data: order });
        } catch (error) {
            console.error('Error creating order:', error);
            res.status(400).json({ success: false, message: error.message || 'Erreur lors de la création de la commande' });
        }
    },

    update: async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId) && order.clientId !== req.user.clientId) {
                return res.status(403).json({ success: false, message: 'Accès non autorisé' });
            }

            // If status is ANNULÉE or order is devalidated, release all associated vehicles
            if (req.body.status === 'ANNULÉE' || (req.body.isValidated === false && order.isValidated === true)) {
                await Vehicle.update(
                    { orderId: null, status: 'Available' },
                    {
                        where: { orderId: order.id },
                        userId: req.user.id,
                        userName: req.user.name
                    }
                );
            }

            const oldValidated = order.isValidated;
            await order.update(req.body, {
                userId: req.user.id,
                userName: req.user.name
            });

            // If order just got validated, send email
            if (!oldValidated && order.isValidated) {
                (async () => {
                    try {
                        const fullOrder = await Order.findByPk(order.id, {
                            include: [{ model: Client, as: 'client' }, { model: Vehicle, as: 'Vehicles' }]
                        });
                        if (fullOrder && fullOrder.client) {
                            const vehicle = fullOrder.Vehicles && fullOrder.Vehicles.length > 0 ? fullOrder.Vehicles[0] : null;
                            await mailService.sendOrderConfirmation(fullOrder, fullOrder.client, vehicle);
                        }
                    } catch (emailError) {
                        console.error('Error in post-update validation email trigger:', emailError);
                    }
                })();
            }

            res.json({ success: true, data: order });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour de la commande' });
        }
    },

    delete: async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }

            // Check access rights
            if (req.user && !['admin', 'commercial'].includes(req.user.roleId) && order.clientId !== req.user.clientId) {
                return res.status(403).json({ success: false, message: 'Accès non autorisé' });
            }

            // Release all associated vehicles before deletion
            await Vehicle.update(
                { orderId: null, status: 'Available' },
                {
                    where: { orderId: order.id },
                    userId: req.user.id,
                    userName: req.user.name
                }
            );

            // Delete linked CashTransactions to avoid FK constraints
            await CashTransaction.destroy({
                where: { orderId: order.id },
                userId: req.user.id,
                userName: req.user.name,
                individualHooks: true
            });

            // Delete linked PurchaseOrder if any
            await PurchaseOrder.destroy({
                where: { orderId: order.id },
                userId: req.user.id,
                userName: req.user.name,
                individualHooks: true
            });

            await order.destroy({
                userId: req.user.id,
                userName: req.user.name
            });
            res.json({ success: true, message: 'Commande supprimée' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression de la commande' });
        }
    },

    validate: async (req, res) => {
        try {
            const order = await Order.findByPk(req.params.id);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Commande non trouvée' });
            }
            order.isValidated = true;
            await order.save({
                userId: req.user.id,
                userName: req.user.name
            });

            // Send confirmation email asynchronously (don't block response)
            (async () => {
                try {
                    const fullOrder = await Order.findByPk(order.id, {
                        include: [{ model: Client, as: 'client' }, { model: Vehicle, as: 'Vehicles' }]
                    });
                    if (fullOrder && fullOrder.client) {
                        const vehicle = fullOrder.Vehicles && fullOrder.Vehicles.length > 0 ? fullOrder.Vehicles[0] : null;
                        await mailService.sendOrderConfirmation(fullOrder, fullOrder.client, vehicle);
                    }
                } catch (emailError) {
                    console.error('Error in post-validation email trigger:', emailError);
                }
            })();

            res.json({ success: true, data: order });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la validation' });
        }
    }
};

module.exports = ordersController;
