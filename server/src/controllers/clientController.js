const { Client } = require('../models');

exports.getAll = async (req, res) => {
    try {
        let clients;
        if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
            // Non-privileged users only see their own client profile
            clients = await Client.findAll({
                where: { id: req.user.clientId }
            });
        } else {
            clients = await Client.findAll({ order: [['createdAt', 'DESC']] });
        }
        res.json({ success: true, data: clients });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

exports.create = async (req, res) => {
    try {
        if (req.user && !['admin', 'commercial'].includes(req.user.roleId)) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const { reference, firstName, lastName, passportNumber, nin } = req.body;

        // Check for duplicate Reference
        if (reference) {
            const existingRef = await Client.findOne({ where: { reference } });
            if (existingRef) {
                return res.status(400).json({
                    success: false,
                    message: `Un client avec la référence "${reference}" existe déjà.`
                });
            }
        }

        // Check for duplicate Name + FirstName
        const existingName = await Client.findOne({ where: { firstName, lastName } });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `Un client nommé "${firstName} ${lastName}" existe déjà dans la base.`
            });
        }

        // Check for duplicate Passport
        if (passportNumber) {
            const existingPassport = await Client.findOne({ where: { passportNumber } });
            if (existingPassport) {
                return res.status(400).json({
                    success: false,
                    message: `Un client avec le numéro de passeport "${passportNumber}" existe déjà.`
                });
            }
        }

        // Check for duplicate NIN
        if (nin) {
            const existingNin = await Client.findOne({ where: { nin } });
            if (existingNin) {
                return res.status(400).json({
                    success: false,
                    message: `Un client avec le NIN "${nin}" existe déjà.`
                });
            }
        }

        const client = await Client.create(req.body);
        res.status(201).json({ success: true, data: client });
    } catch (error) {
        console.error("Client Create Error:", error);
        res.status(500).json({ success: false, message: error.message || 'Erreur serveur.' });
    }
};

exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await Client.findByPk(id);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client non trouvé.' });
        }

        if (req.user && !['admin', 'commercial'].includes(req.user.roleId) && req.user.clientId !== client.id) {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }

        const { passportNumber, nin } = req.body;

        // Check for duplicate Passport
        if (passportNumber) {
            const existingPassport = await Client.findOne({ where: { passportNumber } });
            if (existingPassport && existingPassport.id !== id) {
                return res.status(400).json({
                    success: false,
                    message: `Un autre client avec le numéro de passeport "${passportNumber}" existe déjà.`
                });
            }
        }

        // Check for duplicate NIN
        if (nin) {
            const existingNin = await Client.findOne({ where: { nin } });
            if (existingNin && existingNin.id !== id) {
                return res.status(400).json({
                    success: false,
                    message: `Un autre client avec le NIN "${nin}" existe déjà.`
                });
            }
        }

        await client.update(req.body);
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};

exports.delete = async (req, res) => {
    try {
        if (req.user && req.user.roleId !== 'admin') {
            return res.status(403).json({ success: false, message: 'Accès non autorisé.' });
        }
        const { id } = req.params;
        const client = await Client.findByPk(id);
        if (!client) {
            return res.status(404).json({ success: false, message: 'Client non trouvé.' });
        }
        await client.destroy();
        res.json({ success: true, message: 'Client supprimé.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
};
