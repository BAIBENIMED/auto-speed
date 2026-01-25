require('dotenv').config();
const { Order, PurchaseOrder, Supplier, Vehicle } = require('./src/models');

async function check() {
    try {
        const orders = await Order.findAll();
        const pos = await PurchaseOrder.findAll();
        const suppliers = await Supplier.findAll();

        console.log('--- Orders ---');
        orders.forEach(o => {
            console.log(`ID: ${o.id}, Validated: ${o.isValidated}, Status: ${o.status}, VehicleID: ${o.vehicleId}`);
        });

        console.log('\n--- Existing POs ---');
        pos.forEach(p => {
            console.log(`ID: ${p.id}, OrderID: ${p.orderId}, SupplierID: ${p.supplierId}`);
        });

        console.log('\n--- Suppliers ---');
        suppliers.forEach(s => {
            console.log(`ID: ${s.id}, Code: ${s.code}, Name: ${s.name}`);
        });

        const eligible = orders.filter(o =>
            o.isValidated &&
            !['ANNULÉE', 'ANNULÉ'].includes(o.status) &&
            !o.vehicleId &&
            !pos.find(p => p.orderId === o.id)
        );

        console.log(`\nEligible Orders Count: ${eligible.length}`);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
