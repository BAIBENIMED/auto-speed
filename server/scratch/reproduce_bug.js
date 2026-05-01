
const { PurchaseOrder, Vehicle, Supplier, Order } = require('../src/models');
const sequelize = require('../src/config/database');

async function testUpdate() {
    try {
        await sequelize.sync();

        // 1. Create a PO with 1 vehicle
        const supplier = await Supplier.create({ name: 'Test Supplier', code: 'TS' });
        const poId = 'PO-TEST-001';
        await PurchaseOrder.create({
            id: poId,
            supplierId: supplier.id,
            supplierName: supplier.name,
            status: 'En cours',
            purchaseDate: new Date()
        });

        const vId = 'V-TEST-001';
        await Vehicle.create({
            id: vId,
            brand: 'BRAND',
            model: 'MODEL',
            purchaseOrderId: poId
        });

        console.log('--- Initial State ---');
        let vehicles = await Vehicle.findAll({ where: { purchaseOrderId: poId } });
        console.log('Vehicles count:', vehicles.length);

        // 2. Simulate First Update (sending existing vehicle with ID)
        console.log('\n--- First Update (with ID) ---');
        const updateData1 = {
            vehicles: [
                { id: vId, brand: 'BRAND', model: 'MODEL UPDATED' }
            ]
        };
        
        // Mocking the update logic from controller
        for (const v of updateData1.vehicles) {
            if (v.id) {
                const vehicleData = { ...v };
                delete vehicleData.id;
                await Vehicle.update(vehicleData, { where: { id: v.id, purchaseOrderId: poId } });
            } else {
                // ... create logic ...
            }
        }

        vehicles = await Vehicle.findAll({ where: { purchaseOrderId: poId } });
        console.log('Vehicles count after update 1:', vehicles.length);

        // 3. Simulate Second Update (sending same vehicle WITHOUT ID - maybe due to a frontend bug)
        console.log('\n--- Second Update (WITHOUT ID) ---');
        const updateData2 = {
            vehicles: [
                { brand: 'BRAND', model: 'MODEL UPDATED AGAIN' }
            ]
        };

        for (const v of updateData2.vehicles) {
            if (v.id) {
                // ... update logic ...
            } else {
                // Simulate the create logic from controller
                const brand = (v.brand || 'UNKNOWN').toUpperCase().replace(/\s+/g, '');
                // Simplified ID generation for test
                const finalId = `${brand}/NEW-${Date.now()}`; 
                await Vehicle.create({
                    ...v,
                    id: finalId,
                    purchaseOrderId: poId,
                    supplier: supplier.name,
                    purchasePrice: 0,
                    purchaseCurrency: 'EUR',
                    status: 'Available'
                });
            }
        }

        vehicles = await Vehicle.findAll({ where: { purchaseOrderId: poId } });
        console.log('Vehicles count after update 2:', vehicles.length);

        if (vehicles.length > 1) {
            console.log('BUG CONFIRMED: Vehicles doubled (or increased) because ID was missing.');
        }

    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        await sequelize.close();
    }
}

testUpdate();
