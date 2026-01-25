const sequelize = require('./src/config/database');

async function fixSchema() {
    try {
        console.log('🛠️  Adding missing columns manually...');

        // Add gemini_model
        try {
            await sequelize.query('ALTER TABLE settings ADD COLUMN gemini_model VARCHAR(100) DEFAULT "gemini-1.5-flash" AFTER tracking_provider');
            console.log('✅ Column gemini_model added');
        } catch (e) {
            console.log('ℹ️ Column gemini_model might already exist or error:', e.message);
        }

        // Add available_gemini_models
        try {
            await sequelize.query('ALTER TABLE settings ADD COLUMN available_gemini_models JSON AFTER gemini_model');
            console.log('✅ Column available_gemini_models added');
        } catch (e) {
            console.log('ℹ️ Column available_gemini_models might already exist or error:', e.message);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixSchema();
