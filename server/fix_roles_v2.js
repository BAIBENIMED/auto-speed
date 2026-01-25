const { Role } = require('./src/models');
const sequelize = require('./src/config/database');

async function fixRolesV2() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database');

        const roles = await Role.findAll();
        console.log(`Checking ${roles.length} roles for 'alerts' permission.`);

        for (const role of roles) {
            const currentPerms = role.permissions || [];

            if (role.id === 'admin') {
                if (!currentPerms.includes('all')) {
                    role.permissions = ['all'];
                    await role.save();
                    console.log(`- Role admin updated to ['all']`);
                } else {
                    console.log(`- Role admin already has 'all'`);
                }
                continue;
            }

            if (currentPerms.includes('all') || currentPerms.includes('view_all') || currentPerms.includes('dashboard')) {
                if (!currentPerms.includes('alerts')) {
                    const newPerms = [...currentPerms, 'alerts'];
                    role.permissions = newPerms;
                    await role.save();
                    console.log(`- Role ${role.id} granted 'alerts' permission.`);
                } else {
                    console.log(`- Role ${role.id} already has 'alerts'`);
                }
            }
        }

        console.log('\n✅ Role migration V2 complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

fixRolesV2();
