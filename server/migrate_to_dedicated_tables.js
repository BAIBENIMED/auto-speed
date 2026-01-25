const { DynamicAttribute, Brand, VehicleModel, Showroom } = require('./src/models');
const sequelize = require('./src/config/database');

async function migrate() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion établie');

        // Force sync the specific new tables
        console.log('🔄 Synchronisation des nouvelles tables...');
        await Brand.sync({ alter: true });
        await VehicleModel.sync({ alter: true });
        await Showroom.sync({ alter: true });

        // 1. Migrate Brands & Models
        console.log('🚗 Migration des marques et modèles...');
        const brands = await DynamicAttribute.findAll({ where: { category: 'brands' } });
        for (const b of brands) {
            console.log(`   - Marque: ${b.value}`);
            await Brand.findOrCreate({
                where: { id: b.id },
                defaults: { name: b.value }
            });

            if (b.metadata && b.metadata.models && Array.isArray(b.metadata.models)) {
                for (const m of b.metadata.models) {
                    const modelId = `model_${b.id}_${m.toLowerCase().replace(/\s+/g, '_')}`;
                    await VehicleModel.findOrCreate({
                        where: { id: modelId },
                        defaults: {
                            brandId: b.id,
                            name: m
                        }
                    });
                }
            }
        }

        // 2. Migrate Showrooms
        console.log('🏢 Migration des showrooms...');
        const showrooms = await DynamicAttribute.findAll({ where: { category: 'showrooms' } });
        for (const s of showrooms) {
            console.log(`   - Showroom: ${s.value}`);
            await Showroom.findOrCreate({
                where: { id: s.id },
                defaults: { name: s.value }
            });
        }

        console.log('✅ Migration terminée avec succès !');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur de migration:', error);
        process.exit(1);
    }
}

migrate();
