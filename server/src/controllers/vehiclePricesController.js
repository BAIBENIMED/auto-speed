const { VehiclePrice, VehicleTrim, Supplier, VehicleModel, Brand } = require('../models');
const { v4: uuidv4 } = require('uuid');

const vehiclePricesController = {
    getAll: async (req, res) => {
        try {
            const prices = await VehiclePrice.findAll({
                include: [
                    {
                        model: VehicleTrim,
                        as: 'trim',
                        include: [{
                            model: VehicleModel,
                            as: 'model',
                            include: [{ model: Brand, as: 'brand' }]
                        }]
                    },
                    {
                        model: Supplier,
                        as: 'supplier'
                    }
                ],
                order: [['date', 'DESC']]
            });
            res.json({ success: true, data: prices });
        } catch (error) {
            console.error('Error fetching vehicle prices:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des prix' });
        }
    },

    getDashboard: async (req, res) => {
        try {
            // Fetch all trims that have prices or DZD prices set
            const trims = await VehicleTrim.findAll({
                include: [
                    {
                        model: VehicleModel,
                        as: 'model',
                        include: [{ model: Brand, as: 'brand' }]
                    },
                    {
                        model: VehiclePrice,
                        as: 'prices',
                        include: [{ model: Supplier, as: 'supplier' }]
                    }
                ]
            });

            // Map and calculate last/best prices per trim
            const dashboardData = trims.map(trim => {
                let lastPrice = null;
                let bestPrice = null;

                if (trim.prices && trim.prices.length > 0) {
                    // Sort by date DESC for lastPrice
                    const sortedByDate = [...trim.prices].sort((a, b) => new Date(b.date) - new Date(a.date));
                    lastPrice = sortedByDate[0];

                    // Sort by price ASC for bestPrice
                    const sortedByPrice = [...trim.prices].sort((a, b) => Number(a.priceUSD) - Number(b.priceUSD));
                    bestPrice = sortedByPrice[0];
                }

                // Only return trims that have either a purchase history or a selling price set
                if (trim.prices.length === 0 && !trim.priceDzdNeuf && !trim.priceDzd3Ans) {
                    return null;
                }

                return {
                    trimId: trim.id,
                    trimName: `${trim.model.brand.name} ${trim.model.name} - ${trim.name}`,
                    priceDzdNeuf: trim.priceDzdNeuf,
                    priceDzd3Ans: trim.priceDzd3Ans,
                    lastPrice: lastPrice ? {
                        priceUSD: lastPrice.priceUSD,
                        supplierName: lastPrice.supplier?.name,
                        date: lastPrice.date
                    } : null,
                    bestPrice: bestPrice ? {
                        priceUSD: bestPrice.priceUSD,
                        supplierName: bestPrice.supplier?.name,
                        date: bestPrice.date
                    } : null,
                    history: trim.prices.map(p => ({
                        id: p.id,
                        priceUSD: p.priceUSD,
                        date: p.date,
                        notes: p.notes,
                        supplierName: p.supplier?.name
                    }))
                };
            }).filter(item => item !== null);

            res.json({ success: true, data: dashboardData });
        } catch (error) {
            console.error('Error fetching pricing dashboard:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la génération du tableau de bord' });
        }
    },

    create: async (req, res) => {
        try {
            const { trimId, supplierId, date, notes } = req.body;
            const priceUSD = req.body.priceUSD || 0;

            const price = await VehiclePrice.create({
                id: `vp-${Date.now()}`,
                trimId,
                supplierId,
                priceUSD,
                date,
                notes
            });
            res.status(201).json({ success: true, data: price });
        } catch (error) {
            console.error('Error creating vehicle price:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la création du prix' });
        }
    },

    update: async (req, res) => {
        try {
            const price = await VehiclePrice.findByPk(req.params.id);
            if (!price) {
                return res.status(404).json({ success: false, message: 'Prix non trouvé' });
            }

            const updateData = {
                trimId: req.body.trimId,
                supplierId: req.body.supplierId,
                priceUSD: req.body.priceUSD,
                date: req.body.date,
                notes: req.body.notes
            };

            await price.update(updateData);
            res.json({ success: true, data: price });
        } catch (error) {
            console.error('Error updating vehicle price:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour du prix' });
        }
    },

    delete: async (req, res) => {
        try {
            const price = await VehiclePrice.findByPk(req.params.id);
            if (!price) {
                return res.status(404).json({ success: false, message: 'Prix non trouvé' });
            }
            await price.destroy();
            res.json({ success: true, message: 'Prix supprimé' });
        } catch (error) {
            console.error('Error deleting vehicle price:', error);
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression du prix' });
        }
    }
};

module.exports = vehiclePricesController;
