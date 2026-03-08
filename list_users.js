require('dotenv').config({ path: './server/.env' });
const { User } = require('./server/src/models');

async function listUsers() {
    try {
        const users = await User.findAll({ attributes: ['username', 'name', 'roleId'] });
        console.log('--- USERS ---');
        users.forEach(u => console.log(`User: ${u.username} | Name: ${u.name} | Role: ${u.roleId}`));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

listUsers().catch(console.error);
