const sequelize = require('./src/config/database');
const { Vehicle, Client, Order, VehicleTransfer, User } = require('./src/models');
const vehiclesController = require('./src/controllers/vehiclesController');

async function test() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        // Create a mock req and res
        const req = {
            params: { id: 'test_veh_1' },
            body: {
                toClientId: 'test_client_2',
                transferOrderAsWell: true
            },
            user: {
                id: 'admin',
                name: 'Admin'
            }
        };

        const res = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log('Response:', this.statusCode, data);
            }
        };

        // ensure a test vehicle and client exist
        await Client.findOrCreate({ where: { id: 'test_client_1' }, defaults: { firstName: 'T', lastName: '1' } });
        await Client.findOrCreate({ where: { id: 'test_client_2' }, defaults: { firstName: 'T', lastName: '2' } });
        await Order.findOrCreate({ where: { id: 'test_ord_1' }, defaults: { clientId: 'test_client_1' } });
        await Vehicle.findOrCreate({ where: { id: 'test_veh_1' }, defaults: { brand: 'TEST', clientId: 'test_client_1', orderId: 'test_ord_1' } });

        await vehiclesController.transfer(req, res);
    } catch (e) {
        console.error('Test error:', e);
    } finally {
        process.exit();
    }
}

test();
