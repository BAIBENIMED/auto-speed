require('dotenv').config({ path: './server/.env' });
const { syncShipmentStatusToOrders } = require('./server/src/utils/statusSynchronizer');
const { Order, Vehicle, Shipment, Client } = require('./server/src/models');

async function testSync() {
    console.log("Starting debug sync...");
    let testClient, testShipment, testOrder, testVehicle;

    try {
        // Create test data
        testClient = await Client.create({ firstName: 'Debug', lastName: 'Client', email: 'debug@test.com' });
        testShipment = await Shipment.create({ id: 'DEBUG-SHIP-1', containerNumber: 'DEBUG123' });
        testOrder = await Order.create({ clientId: testClient.id, status: 'NOUVELLE', totalAmount: 10000 });
        testVehicle = await Vehicle.create({ brand: 'DebugCar', orderId: testOrder.id, shipmentId: testShipment.id });

        console.log(`Created test suite: Client ${testClient.id}, Shipment ${testShipment.id}, Order ${testOrder.id}, Vehicle ${testVehicle.id}`);
        console.log(`Initial Order Status: ${testOrder.status}`);

        // Let's manually trigger the sync with "discharge"
        await syncShipmentStatusToOrders(testShipment.id, "discharge");

        // Refetch to see if they updated
        await testVehicle.reload();
        await testOrder.reload();

        console.log("Final Vehicle Status:", testVehicle.status);
        console.log("Final Order Status:", testOrder.status);

    } catch (e) {
        console.error("Error during debug:", e);
    } finally {
        // Cleanup
        if (testVehicle) await testVehicle.destroy({ force: true });
        if (testOrder) await testOrder.destroy({ force: true });
        if (testShipment) await testShipment.destroy({ force: true });
        if (testClient) await testClient.destroy({ force: true });
        console.log("Cleanup complete.");
    }
}

testSync().then(() => process.exit(0));
