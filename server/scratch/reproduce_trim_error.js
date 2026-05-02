const sequelize = require('../src/config/database');
const { VehicleTrim, VehicleModel, Brand } = require('../src/models');

async function testCreate() {
    try {
        await sequelize.authenticate();
        console.log('Connected.');

        // 1. Create a dummy brand
        const brand = await Brand.create({ id: 'test_brand', name: 'Test Brand' });
        console.log('Brand created.');

        // 2. Create a dummy model
        const model = await VehicleModel.create({ id: 'test_model', brandId: 'test_brand', name: 'Test Model' });
        console.log('Model created.');

        // 3. Create a trim
        console.log('Creating trim...');
        const trim = await VehicleTrim.create({ 
            id: 'test_trim_' + Date.now(), 
            modelId: 'test_model', 
            name: 'Test Trim',
            characteristics: { turbo: 'Oui' }
        });
        console.log('Trim created successfully:', trim.toJSON());

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        // Cleanup
        try {
            await VehicleTrim.destroy({ where: { modelId: 'test_model' } });
            await VehicleModel.destroy({ where: { id: 'test_model' } });
            await Brand.destroy({ where: { id: 'test_brand' } });
        } catch (e) {}
        await sequelize.close();
    }
}

testCreate();
