const { Voyage, Shipment } = require('../models');

exports.getAllVoyages = async (req, res) => {
    try {
        const voyages = await Voyage.findAll({
            include: [{ model: Shipment, as: 'shipments' }],
            order: [['createdAt', 'DESC']]
        });
        res.json(voyages);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la récupération des voyages' });
    }
};

exports.createVoyage = async (req, res) => {
    try {
        const voyage = await Voyage.create(req.body);
        res.status(201).json(voyage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la création du voyage' });
    }
};

exports.updateVoyage = async (req, res) => {
    try {
        const voyage = await Voyage.findByPk(req.params.id);
        if (!voyage) return res.status(404).json({ message: 'Voyage non trouvé' });

        await voyage.update(req.body);

        // Propagate changes to linked shipments (Active Sync Logic)
        if (req.body.propagateToShipments) {
            const updates = {};
            if (req.body.etd) updates.etd = req.body.etd;
            if (req.body.eta) updates.eta = req.body.eta;
            if (req.body.arrivalDate) updates.arrivalDate = req.body.arrivalDate;
            if (req.body.loadingPort) updates.loadingPort = req.body.loadingPort;
            if (req.body.destination) updates.destination = req.body.destination;
            if (req.body.carrier) updates.carrier = req.body.carrier;
            if (req.body.blNumber) updates.blNumber = req.body.blNumber;
            // Also update legacy voyage string field
            if (req.body.name) updates.voyage = req.body.name;

            if (Object.keys(updates).length > 0) {
                await Shipment.update(updates, { where: { voyageId: voyage.id } });
            }
        }

        res.json(voyage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la mise à jour du voyage' });
    }
};

exports.deleteVoyage = async (req, res) => {
    try {
        const voyage = await Voyage.findByPk(req.params.id);
        if (!voyage) return res.status(404).json({ message: 'Voyage non trouvé' });

        // Unlink shipments
        await Shipment.update({ voyageId: null }, { where: { voyageId: voyage.id } });

        await voyage.destroy();
        res.json({ message: 'Voyage supprimé' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erreur lors de la suppression du voyage' });
    }
};
