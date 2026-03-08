const { PurchaseOrder, Order, Supplier, Vehicle } = require('../models');

const purchaseOrdersController = {
    getAll: async (req, res) => {
        try {
            const pos = await PurchaseOrder.findAll({
                include: [
                    { model: Order, as: 'order' }, // Kept for legacy
                    { model: Supplier, as: 'supplierDetails' },
                    {
                        model: Vehicle,
                        as: 'vehicles',
                        include: [{ model: Order, as: 'order' }]
                    }
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
            const { supplierId, status, purchaseDate, notes, vehicles } = req.body;

            // Generate PO ID: CMD/ANNEE/FOURNISSEUR/SEQUENCE
            const year = new Date().getFullYear();
            const supplier = await Supplier.findByPk(supplierId);
            const supplierCode = supplier ? supplier.code : 'UNKNOWN';

            // Assuming sequence is global per year
            const { Op } = require('sequelize');
            const count = await PurchaseOrder.count({
                where: {
                    id: {
                        [Op.like]: `CMD/${year}/%`
                    }
                }
            });
            const seq = (count + 1).toString().padStart(3, '0');
            const poId = `CMD/${year}/${supplierCode}/${seq}`;

            const po = await PurchaseOrder.create({
                id: poId,
                supplierId,
                supplierName: supplier ? supplier.name : null,
                status: status || 'En cours',
                purchaseDate: purchaseDate || new Date(),
                notes
            });

            // If vehicles were passed, create them and link them to the newly created PO
            if (vehicles && Array.isArray(vehicles) && vehicles.length > 0) {
                const vehiclesToCreate = vehicles.map((v, index) => {
                    return {
                        ...v,
                        id: `VH-${Date.now()}-${index}`,
                        purchaseOrderId: poId,
                        supplier: supplier ? supplier.name : null,
                        purchasePrice: v.purchasePrice || 0,
                        purchaseCurrency: v.purchaseCurrency || 'EUR',
                        status: 'Available' // Or something else if in PO
                    };
                });

                await Vehicle.bulkCreate(vehiclesToCreate);

                // For each vehicle, if it's linked to an Order, we might want to update the Order's vehicleId 
                // but the old logic didn't do this directly. We'll link Vehicle -> Order, wait, Order.vehicleId is used?
                // Actually the Vehicle has orderId.
                for (const v of vehiclesToCreate) {
                    if (v.orderId) {
                        await Order.update({ vehicleId: v.id }, { where: { id: v.orderId } });
                    }
                }
            }

            // Refetch to include relationships
            const newPO = await PurchaseOrder.findByPk(poId, {
                include: [
                    { model: Supplier, as: 'supplierDetails' },
                    { model: Vehicle, as: 'vehicles', include: [{ model: Order, as: 'order' }] }
                ]
            });

            res.status(201).json({ success: true, data: newPO });
        } catch (error) {
            console.error('Error creating purchase order:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la création de la commande d\'achat' });
        }
    },

    update: async (req, res) => {
        try {
            const { id } = req.params;
            const { supplierId, status, purchaseDate, notes, vehicles } = req.body;

            const po = await PurchaseOrder.findByPk(id);
            if (!po) {
                return res.status(404).json({ success: false, message: 'Commande d\'achat non trouvée' });
            }

            const supplier = await Supplier.findByPk(supplierId);

            await po.update({
                supplierId: supplierId !== undefined ? supplierId : po.supplierId,
                supplierName: supplier ? supplier.name : po.supplierName,
                status: status !== undefined ? status : po.status,
                purchaseDate: purchaseDate !== undefined ? purchaseDate : po.purchaseDate,
                notes: notes !== undefined ? notes : po.notes
            });

            // Optionally, handle updating the list of vehicles here if necessary.
            // For now, updating existing vehicles' details via the vehicles array if they have IDs.
            if (vehicles && Array.isArray(vehicles)) {
                for (const v of vehicles) {
                    if (v.id) {
                        await Vehicle.update(v, { where: { id: v.id, purchaseOrderId: id } });
                    } else {
                        // Create new vehicle appended to this PO
                        const newVehicle = await Vehicle.create({
                            ...v,
                            id: `VH-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                            purchaseOrderId: id,
                            supplier: supplier ? supplier.name : po.supplierName,
                            purchasePrice: v.purchasePrice || 0,
                            purchaseCurrency: v.purchaseCurrency || 'EUR',
                            status: 'Available'
                        });
                        if (newVehicle.orderId) {
                            await Order.update({ vehicleId: newVehicle.id }, { where: { id: newVehicle.orderId } });
                        }
                    }
                }
            }

            const updatedPO = await PurchaseOrder.findByPk(id, {
                include: [
                    { model: Supplier, as: 'supplierDetails' },
                    { model: Vehicle, as: 'vehicles', include: [{ model: Order, as: 'order' }] }
                ]
            });

            res.json({ success: true, data: updatedPO });
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

            // Cleanup associated vehicles
            const vehicles = await Vehicle.findAll({ where: { purchaseOrderId: id } });
            for (const v of vehicles) {
                if (v.orderId) {
                    await Order.update({ vehicleId: null }, { where: { id: v.orderId } });
                }
                await v.destroy();
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
