const { User } = require('../models');
const sequelize = require('../config/database');

async function resetAdmin() {
    try {
        await sequelize.authenticate();
        console.log('🔌 Connected to DB');

        const user = await User.findOne({ where: { username: 'admin' } });

        if (!user) {
            console.log('❌ Admin user not found!');
            return;
        }

        console.log('👤 Found admin user. Updating password...');

        // This should trigger the beforeUpdate hook to hash the password
        user.password = 'admin123';
        await user.save();

        console.log('✅ Password reset to: admin123');

    } catch (error) {
        console.error('❌ Error resetting password:', error);
    } finally {
        await sequelize.close();
    }
}

resetAdmin();
