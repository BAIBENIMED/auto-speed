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
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la récupération des commandes d\'achat: ' + error.message,
                details: error.name === 'SequelizeDatabaseError' ? error.parent?.sqlMessage : error.message
            });
        }
    },

    create: async (req, res) => {
        try {
            const {
                supplierId, status, purchaseDate,
                documentStatus, documentsReceived,
                loadingPort, loadingDate, etd, eta, isLoaded, forwarder, carrier, unbundler,
                notes, vehicles, tasks
            } = req.body;

            // Generate PO ID: CMD/ANNEE/FOURNISSEUR/SEQUENCE
            const year = new Date().getFullYear();
            const supplier = await Supplier.findByPk(supplierId);
            const supplierRef = supplier ? supplier.name : 'UNKNOWN';

            // Sequence is per supplier per year
            const { Op } = require('sequelize');
            const count = await PurchaseOrder.count({
                where: {
                    id: {
                        [Op.like]: `CMD/${year}/${supplierRef}/%`
                    }
                }
            });
            const seq = (count + 1).toString().padStart(3, '0');
            const poId = `CMD/${year}/${supplierRef}/${seq}`;

            const po = await PurchaseOrder.create({
                id: poId,
                supplierId,
                supplierName: supplier ? supplier.name : null,
                status: status || 'En cours',
                purchaseDate: purchaseDate || new Date(),
                documentStatus,
                documentsReceived,
                loadingPort,
                loadingDate,
                etd,
                eta,
                isLoaded,
                forwarder,
                carrier,
                unbundler,
                notes,
                tasks: tasks || []
            });

            // If vehicles were passed, create them and link them to the newly created PO
            if (vehicles && Array.isArray(vehicles) && vehicles.length > 0) {
                const vehiclesToCreate = [];
                for (let i = 0; i < vehicles.length; i++) {
                    const v = vehicles[i];
                    const brand = (v.brand || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');

                    // Get next sequence for this brand
                    const { Op } = require('sequelize');
                    const lastVehicle = await Vehicle.findOne({
                        where: {
                            id: { [Op.like]: `${brand}/%` }
                        },
                        order: [['createdAt', 'DESC']]
                    });

                    let nextSeq = 1;
                    if (lastVehicle && lastVehicle.id.includes('/')) {
                        const parts = lastVehicle.id.split('/');
                        const lastNum = parseInt(parts[1]);
                        if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                    }

                    // Ensure uniqueness by checking if ID already exists (in case of gaps/deletions)
                    let finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
                    let exists = await Vehicle.findByPk(finalId);
                    while (exists) {
                        nextSeq++;
                        finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
                        exists = await Vehicle.findByPk(finalId);
                    }

                    // Determine status: Stock (Available) unless order is CONCLUE
                    let vehicleStatus = 'Available';
                    if (v.orderId) {
                        const linkedOrder = await Order.findByPk(v.orderId);
                        if (linkedOrder && linkedOrder.status === 'CONCLUE') {
                            vehicleStatus = 'Livrée';
                        }
                    }

                    vehiclesToCreate.push({
                        ...v,
                        id: finalId,
                        purchaseOrderId: poId,
                        supplier: supplier ? supplier.name : null,
                        purchasePrice: v.purchasePrice || 0,
                        purchaseCurrency: v.purchaseCurrency || 'EUR',
                        status: vehicleStatus
                    });
                }

                await Vehicle.bulkCreate(vehiclesToCreate);

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
            const {
                supplierId, status, purchaseDate,
                documentStatus, documentsReceived,
                loadingPort, loadingDate, etd, eta, isLoaded, forwarder, carrier, unbundler,
                notes, vehicles, tasks
            } = req.body;

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
                documentStatus: documentStatus !== undefined ? documentStatus : po.documentStatus,
                documentsReceived: documentsReceived !== undefined ? documentsReceived : po.documentsReceived,
                loadingPort: loadingPort !== undefined ? loadingPort : po.loadingPort,
                loadingDate: loadingDate !== undefined ? loadingDate : po.loadingDate,
                etd: etd !== undefined ? etd : po.etd,
                eta: eta !== undefined ? eta : po.eta,
                isLoaded: isLoaded !== undefined ? isLoaded : po.isLoaded,
                forwarder: forwarder !== undefined ? forwarder : po.forwarder,
                carrier: carrier !== undefined ? carrier : po.carrier,
                unbundler: unbundler !== undefined ? unbundler : po.unbundler,
                notes: notes !== undefined ? notes : po.notes,
                tasks: tasks !== undefined ? tasks : po.tasks
            });

            // If supplier changed, update it on all vehicles linked to this PO
            if (supplier && supplier.name !== po.supplierName) {
                await Vehicle.update({ supplier: supplier.name }, { where: { purchaseOrderId: id } });
            }

            // Handle updating the list of vehicles with reconciliation
            if (vehicles && Array.isArray(vehicles)) {
                // 1. Get all currently linked vehicles
                const existingVehicles = await Vehicle.findAll({ where: { purchaseOrderId: id } });
                const processedIds = new Set();

                for (const v of vehicles) {
                    let vehicleToUpdate = null;

                    if (v.id) {
                        // Case A: ID is provided, direct update
                        vehicleToUpdate = existingVehicles.find(ev => ev.id === v.id);
                    } else {
                        // Case B: No ID, try to reconcile by chassisNumber or orderId to prevent doubling
                        if (v.chassisNumber) {
                            vehicleToUpdate = existingVehicles.find(ev => 
                                ev.chassisNumber === v.chassisNumber && !processedIds.has(ev.id)
                            );
                        }
                        
                        if (!vehicleToUpdate && v.orderId) {
                            vehicleToUpdate = existingVehicles.find(ev => 
                                ev.orderId === v.orderId && !processedIds.has(ev.id)
                            );
                        }
                    }

                    if (vehicleToUpdate) {
                        // Update existing vehicle
                        const vehicleData = { ...v };
                        delete vehicleData.id;
                        await vehicleToUpdate.update(vehicleData);
                        processedIds.add(vehicleToUpdate.id);
                    } else {
                        // Create new vehicle
                        const brand = (v.brand || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
                        const { Op } = require('sequelize');
                        const lastVehicle = await Vehicle.findOne({
                            where: { id: { [Op.like]: `${brand}/%` } },
                            order: [['createdAt', 'DESC']]
                        });

                        let nextSeq = 1;
                        if (lastVehicle && lastVehicle.id.includes('/')) {
                            const parts = lastVehicle.id.split('/');
                            const lastNum = parseInt(parts[1]);
                            if (!isNaN(lastNum)) nextSeq = lastNum + 1;
                        }

                        let finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
                        let exists = await Vehicle.findByPk(finalId);
                        while (exists) {
                            nextSeq++;
                            finalId = `${brand}/${nextSeq.toString().padStart(5, '0')}`;
                            exists = await Vehicle.findByPk(finalId);
                        }

                        let vehicleStatus = 'Available';
                        if (v.orderId) {
                            const linkedOrder = await Order.findByPk(v.orderId);
                            if (linkedOrder && linkedOrder.status === 'CONCLUE') {
                                vehicleStatus = 'Livrée';
                            }
                        }

                        const newVehicle = await Vehicle.create({
                            ...v,
                            id: finalId,
                            purchaseOrderId: id,
                            supplier: supplier ? supplier.name : po.supplierName,
                            purchasePrice: v.purchasePrice || 0,
                            purchaseCurrency: v.purchaseCurrency || 'EUR',
                            status: vehicleStatus
                        });
                        
                        if (newVehicle.orderId) {
                            await Order.update({ vehicleId: newVehicle.id }, { where: { id: newVehicle.orderId } });
                        }
                        processedIds.add(newVehicle.id);
                    }
                }

                // 2. Optional: Cleanup vehicles that are no longer in the request
                // This ensures that removing a row in the UI actually removes it from the PO
                for (const ev of existingVehicles) {
                    if (!processedIds.has(ev.id)) {
                        // If it's linked to an order, unlink it first
                        if (ev.orderId) {
                            await Order.update({ vehicleId: null }, { where: { id: ev.orderId } });
                        }
                        await ev.destroy();
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
            res.status(500).json({ 
                success: false, 
                message: 'Erreur lors de la mise à jour de la commande d\'achat: ' + error.message,
                details: error.name === 'SequelizeDatabaseError' ? error.parent?.sqlMessage : error.message
            });
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
