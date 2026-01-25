require('dotenv').config({ path: './server/.env' });
const { User } = require('./server/src/models');
const sequelize = require('./server/src/config/database');

async function checkAdmin() {
    try {
        await sequelize.authenticate();
        const admin = await User.findOne({ where: { username: 'admin' } });
        if (admin) {
            console.log('Admin User Found:');
            console.log('ID:', admin.id);
            console.log('Username:', admin.username);
            console.log('RoleId:', admin.roleId);
            console.log('ClientId:', admin.clientId);
        } else {
            console.log('Admin user NOT found!');
        }
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await sequelize.close();
    }
}

checkAdmin();
