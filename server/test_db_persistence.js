const { DynamicAttribute } = require('./src/models');
const sequelize = require('./src/config/database');

async function testAdd() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie');

        const newBrand = {
            id: `brand_test_${Date.now()}`,
            category: 'brands',
            value: 'Test Brand ' + new Date().toLocaleTimeString(),
            metadata: { models: ['Test Model 1'] }
        };

        console.log('➕ Ajout d\'une marque de test...');
        const created = await DynamicAttribute.create(newBrand);
        console.log('✅ Marque créée:', JSON.stringify(created, null, 2));

        const all = await DynamicAttribute.findAll({ where: { category: 'brands' } });
        console.log(`📊 Nombre total de marques: ${all.length}`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

testAdd();
