const { sequelize } = require('./src/config/database');
const models = require('./src/models');

async function checkDatabaseContent() {
    try {
        console.log('🔍 Vérification du contenu de la base de données...\n');

        // Check Roles
        const roles = await models.Role.findAll();
        console.log(`📋 ROLES (${roles.length}):`);
        roles.forEach(r => console.log(`   - ${r.id}: ${r.name}`));
        console.log('');

        // Check Users
        const users = await models.User.findAll();
        console.log(`👥 USERS (${users.length}):`);
        users.forEach(u => console.log(`   - ${u.username} (${u.name}) - Role: ${u.roleId}`));
        console.log('');

        // Check Clients
        const clients = await models.Client.findAll();
        console.log(`👤 CLIENTS (${clients.length}):`);
        clients.forEach(c => console.log(`   - ${c.firstName} ${c.lastName} (${c.id})`));
        console.log('');

        // Check Orders
        const orders = await models.Order.findAll();
        console.log(`📦 ORDERS (${orders.length}):`);
        orders.forEach(o => console.log(`   - ${o.id}: Client ${o.clientId} - ${o.status}`));
        console.log('');

        // Check Vehicles
        const vehicles = await models.Vehicle.findAll();
        console.log(`🚗 VEHICLES (${vehicles.length}):`);
        vehicles.forEach(v => console.log(`   - ${v.id}: ${v.brand} ${v.model || ''} (${v.year})`));
        console.log('');

        // Check Shipments
        const shipments = await models.Shipment.findAll();
        console.log(`🚢 SHIPMENTS (${shipments.length}):`);
        shipments.forEach(s => console.log(`   - ${s.id}: ${s.carrier || 'N/A'} - ${s.status}`));
        console.log('');

        // Check Brands
        const brands = await models.Brand.findAll();
        console.log(`🏷️ BRANDS (${brands.length}):`);
        brands.forEach(b => console.log(`   - ${b.name}`));
        console.log('');

        // Check Showrooms
        const showrooms = await models.Showroom.findAll();
        console.log(`🏢 SHOWROOMS (${showrooms.length}):`);
        showrooms.forEach(s => console.log(`   - ${s.name}`));
        console.log('');

        console.log('✅ Vérification terminée');
        process.exit(0);
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

checkDatabaseContent();
