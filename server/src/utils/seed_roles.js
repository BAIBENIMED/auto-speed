const { Role } = require('../models');
const sequelize = require('../config/database');

async function seedRoles() {
    try {
        console.log('🌱 Seeding roles...');

        const roles = [
            {
                id: 'admin',
                name: 'Administrateur',
                permissions: ['all']
            },
            {
                id: 'seller',
                name: 'Vendeur',
                permissions: ['read', 'create_order', 'view_vehicles', 'create_client']
            },
            {
                id: 'user',
                name: 'Utilisateur',
                permissions: ['read']
            }
        ];

        for (const role of roles) {
            const [r, created] = await Role.findOrCreate({
                where: { id: role.id },
                defaults: role
            });

            if (created) {
                console.log(`✅ Role created: ${role.name} (${role.id})`);
            } else {
                console.log(`ℹ️ Role already exists: ${role.name} (${role.id})`);
                // Optional: Update permissions if they changed
                if (JSON.stringify(r.permissions) !== JSON.stringify(role.permissions)) {
                    await r.update({ permissions: role.permissions });
                    console.log(`   Updated permissions for ${role.name}`);
                }
            }
        }

        console.log('✨ Roles seeding completed.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error seeding roles:', error);
        process.exit(1);
    }
}

// Connect and run
sequelize.sync().then(seedRoles);
