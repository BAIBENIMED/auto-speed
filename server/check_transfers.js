const sequelize = require('./src/config/database');
const { VehicleTransfer, Client } = require('./src/models');

async function check() {
    await sequelize.authenticate();
    const transfers = await VehicleTransfer.findAll({
        include: [
            { model: Client, as: 'fromClient', attributes: ['id', 'firstName', 'lastName'] }
        ]
    });
    console.log(JSON.stringify(transfers, null, 2));
    process.exit(0);
}
check();
