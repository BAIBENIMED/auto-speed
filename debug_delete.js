const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'server', '.env') });

const sequelize = require('./server/src/config/database');
const { Order, Vehicle, CashTransaction, PurchaseOrder } = require('./server/src/models');

async function debugDelete() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to database.');

        // Find an order that might be problematic or just the first one
        const order = await Order.findOne();
        if (!order) {
            console.log('No orders found to test deletion.');
            process.exit(0);
        }

        console.log(`Attempting to delete order: ${order.id}`);

        console.log('1. Releasing vehicles...');
        const [vCount] = await Vehicle.update(
            { orderId: null, status: 'Available' },
            { where: { orderId: order.id } }
        );
        console.log(` - ${vCount} vehicles released.`);

        console.log('2. Deleting cash transactions...');
        const cCount = await CashTransaction.destroy({ where: { orderId: order.id } });
        console.log(` - ${cCount} cash transactions deleted.`);

        console.log('3. Deleting purchase orders...');
        const pCount = await PurchaseOrder.destroy({ where: { orderId: order.id } });
        console.log(` - ${pCount} purchase orders deleted.`);

        console.log('4. Destroying order...');
        await order.destroy();
        console.log('✅ Order deleted successfully in debug script!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Deletion failed!');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        if (error.parent) {
            console.error('Parent Error:', error.parent.message);
            console.error('Full Parent Error:', JSON.stringify(error.parent, null, 2));
        }
        process.exit(1);
    }
}

debugDelete();
