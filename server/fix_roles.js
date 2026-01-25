const { Role } = require('./src/models');
const sequelize = require('./src/config/database');

async function fixRoles() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        const roles = await Role.findAll();
        console.log(`Found ${roles.length} roles to check.`);

        const permissionMap = {
            'dashboard': ['read', 'dashboard'],
            'orders': ['read', 'write', 'view_all', 'orders'],
            'clients': ['read', 'write', 'view_all', 'clients'],
            'vehicles': ['read', 'write', 'view_all', 'vehicles'],
            'shipments': ['read', 'write', 'view_all', 'shipments'],
            'cash': ['read', 'write', 'view_all', 'cash'],
            'exchange-rates': ['read', 'write', 'view_all', 'exchange-rates'],
            'settings': ['all', 'view_all', 'settings'],
            'verification': ['read', 'write', 'view_all', 'verification']
        };

        for (const role of roles) {
            if (role.id === 'admin') {
                role.permissions = ['all'];
                await role.save();
                console.log(`- Role admin updated to ['all']`);
                continue;
            }

            const currentPerms = role.permissions || [];
            const newPerms = new Set(currentPerms);

            // Add corresponding view IDs based on keyword permissions
            if (currentPerms.includes('all') || currentPerms.includes('view_all')) {
                Object.keys(permissionMap).forEach(view => newPerms.add(view));
            } else {
                // If they have 'read', give them basic dashboard access at least
                if (currentPerms.includes('read')) {
                    newPerms.add('dashboard');
                }

                // Map other specific keyword permissions to view IDs if not already there
                if (currentPerms.includes('create_order')) newPerms.add('orders');
                if (currentPerms.includes('view_vehicles')) newPerms.add('vehicles');
                if (currentPerms.includes('create_client')) newPerms.add('clients');
            }

            // Always add dashboard as fallback if they have any permissions
            if (newPerms.size > 0) newPerms.add('dashboard');

            role.permissions = Array.from(newPerms);
            await role.save();
            console.log(`- Role ${role.id} updated to: ${JSON.stringify(role.permissions)}`);
        }

        console.log('\n✅ Role migration complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

fixRoles();
