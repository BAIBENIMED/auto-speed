const { User, Role } = require('../models');
const bcrypt = require('bcrypt');

async function createAdmin() {
    try {
        // Ensure roles exist
        const [adminRole] = await Role.findOrCreate({
            where: { id: 'admin' },
            defaults: {
                name: 'Administrateur',
                permissions: ['all']
            }
        });

        await Role.findOrCreate({
            where: { id: 'commercial' },
            defaults: {
                name: 'Commercial',
                permissions: ['read', 'write', 'view_all']
            }
        });

        await Role.findOrCreate({
            where: { id: 'user' },
            defaults: {
                name: 'Utilisateur',
                permissions: ['read']
            }
        });

        // Create Admin User
        // Note: Password will be hashed by the model hook
        const [admin, created] = await User.findOrCreate({
            where: { username: 'admin' },
            defaults: {
                id: 'admin-id-' + Date.now(), // Simple unique ID or use UUID
                password: 'admin123',
                name: 'Administrateur',
                roleId: 'admin'
            }
        });

        if (created) {
            console.log('✅ Admin user created:');
            console.log('Username: admin');
            console.log('Password: admin123');
        } else {
            console.log('ℹ️ Admin user already exists.');
            // Optional: Reset password if requested, but for now just notify
            console.log('Username: admin');
            console.log('Password: (unchanged)');
        }

    } catch (error) {
        console.error('❌ Error creating admin:', error);
    }
}

// Need to initialize Sequelize connection first
const sequelize = require('../config/database');
sequelize.sync().then(createAdmin);
