const sequelize = require('./src/config/database');

async function checkUsers() {
    try {
        console.log('Checking Users and Roles...');

        const [users] = await sequelize.query('SELECT username, role_id FROM users');
        console.log('Users:', users);

        const [roles] = await sequelize.query('SELECT id, name, permissions FROM roles');
        console.log('Roles:', roles);

        process.exit(0);
    } catch (error) {
        console.error('Error checking DB:', error);
        process.exit(1);
    }
}

checkUsers();
