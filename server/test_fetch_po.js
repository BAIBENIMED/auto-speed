const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { PurchaseOrder, Order, Supplier, Vehicle } = require('./src/models');

async function testFetch() {
    try {
        console.log('--- Testing PurchaseOrder.findAll ---');
        const pos = await PurchaseOrder.findAll({
            include: [
                { model: Order, as: 'order' },
                { model: Supplier, as: 'supplierDetails' },
                {
                    model: Vehicle,
                    as: 'vehicles',
                    include: [{ model: Order, as: 'order' }]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        console.log(`Success! Found ${pos.length} purchase orders.`);
        if (pos.length > 0) {
            console.log('Ref of first PO:', pos[0].id);
        }
        process.exit(0);
    } catch (error) {
        console.error('FAILED Fetch:', error.message);
        console.error('Details:', error);
        process.exit(1);
    }
}

testFetch();
