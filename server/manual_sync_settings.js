const { Settings, DynamicAttribute } = require('./src/models');
const sequelize = require('./src/config/database');

async function manualSync() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie');

        const attributes = await DynamicAttribute.findAll();
        const grouped = {
            brands: [],
            motors: [],
            colors: [],
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
            console.log('✅ Table Settings synchronisée avec succès !');
        } else {
            console.warn('⚠️ Aucun enregistrement de paramètres trouvé.');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

manualSync();
