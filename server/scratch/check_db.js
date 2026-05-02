const sequelize = require('../src/config/database');
const { Brand, VehicleModel, VehicleTrim } = require('../src/models');

async function check() {
    try {
        await sequelize.authenticate();
        console.log('Connection has been established successfully.');

        const [tables] = await sequelize.query("SHOW TABLES");
        console.log('Tables in database:', tables.map(t => Object.values(t)[0]));

        if (tables.some(t => Object.values(t)[0] === 'vehicle_trims')) {
            console.log('VehicleTrim table exists.');
            const columns = await sequelize.query("DESCRIBE vehicle_trims");
            console.log('VehicleTrim columns:', columns[0]);
        } else {
            console.log('VehicleTrim table does NOT exist.');
        }
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    } finally {
        await sequelize.close();
    }
}

check();
