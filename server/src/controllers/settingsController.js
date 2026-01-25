const { Settings, DynamicAttribute } = require('../models');

const settingsController = {
    getSettings: async (req, res) => {
        try {
            let settings = await Settings.findOne();
            if (!settings) {
                // Return default settings but don't create them yet to avoid noise
                settings = {
                    companyName: 'TIBOU AUTO',
                    purchaseCurrency: 'EUR',
                    sellingCurrency: 'EUR',
                    customsCurrency: 'XAF',
                    theme: 'dark',
                    trackingProvider: '17track',
                    useAiExtraction: false,
                    geminiModel: 'gemini-1.5-flash',
                    availableGeminiModels: []
                };
            }
            res.json({ success: true, data: settings });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des paramètres' });
        }
    },

    updateSettings: async (req, res) => {
        try {
            let settings = await Settings.findOne();
            if (!settings) {
                settings = await Settings.create(req.body);
            } else {
                await settings.update(req.body);
            }
            res.json({ success: true, data: settings });
        } catch (error) {
            console.error('Error updating settings:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour des paramètres' });
        }
    },

    getAttributes: async (req, res) => {
        try {
            const { category } = req.query;
            const where = category ? { category } : {};
            const attributes = await DynamicAttribute.findAll({ where, order: [['sortOrder', 'ASC']] });
            res.json({ success: true, data: attributes });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la récupération des attributs' });
        }
    },

    addAttribute: async (req, res) => {
        try {
            const data = req.body;
            if (!data.id) {
                // Generate a simple ID if not provided
                data.id = `${data.category}_${Date.now()}`;
            }
            const attribute = await DynamicAttribute.create(data);

            // Sync to Settings table for redundancy/consistency
            await settingsController.syncAttributesToSettings();

            res.status(201).json({ success: true, data: attribute });
        } catch (error) {
            console.error('Error adding attribute:', error);
            res.status(400).json({ success: false, message: 'Erreur lors de la création de l\'attribut' });
        }
    },

    deleteAttribute: async (req, res) => {
        try {
            const attribute = await DynamicAttribute.findByPk(req.params.id);
            if (!attribute) {
                return res.status(404).json({ success: false, message: 'Attribut non trouvé' });
            }
            await attribute.destroy();

            // Sync to Settings table
            await settingsController.syncAttributesToSettings();

            res.json({ success: true, message: 'Attribut supprimé' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Erreur lors de la suppression' });
        }
    },

    updateAttribute: async (req, res) => {
        try {
            const attribute = await DynamicAttribute.findByPk(req.params.id);
            if (!attribute) {
                return res.status(404).json({ success: false, message: 'Attribut non trouvé' });
            }
            await attribute.update(req.body);

            // Sync to Settings table
            await settingsController.syncAttributesToSettings();

            res.json({ success: true, data: attribute });
        } catch (error) {
            res.status(400).json({ success: false, message: 'Erreur lors de la mise à jour' });
        }
    },

    // Helper to keep the Settings model JSON fields in sync with DynamicAttribute lists
    syncAttributesToSettings: async () => {
        try {
            const attributes = await DynamicAttribute.findAll();
            const grouped = {
                brands: [],
                motors: [],
                colors: [],
                categories: [],
                showrooms: [],
                currencies: [],
                carriers: []
            };

            attributes.forEach(attr => {
                if (grouped[attr.category]) {
                    grouped[attr.category].push(attr.value);
                }
            });

            const settings = await Settings.findOne();
            if (settings) {
                await settings.update(grouped);
                console.log('✅ Settings table lists synchronized with DynamicAttributes');
            }
        } catch (error) {
            console.error('❌ Error syncing attributes to settings:', error);
        }
    }
};

module.exports = settingsController;
