const { Vehicle, Order } = require('../models');

/**
 * Synchronizes a shipment's status to all its linked orders.
 * @param {string} shipmentId 
 * @param {string} status 
 */
async function syncShipmentStatusToOrders(shipmentId, status) {
    if (!shipmentId || !status) return;

    try {
        console.log(`[StatusSync] 🔄 Syncing status "${status}" to orders for shipment ${shipmentId}`);

        // 1. Find all vehicles linked to this shipment
        const vehicles = await Vehicle.findAll({
            where: { shipmentId },
            attributes: ['id', 'order_id', 'status']
        });

        if (!vehicles || vehicles.length === 0) {
            console.log(`[StatusSync] ⚠️ No vehicles found for shipment ${shipmentId}`);
            return;
        }

        // 2. Extract unique order IDs
        // Support both order_id (DB field) and orderId (Sequelize alias) if necessary
        const orderIds = [...new Set(vehicles.map(v => v.order_id || v.orderId).filter(id => !!id))];

        if (orderIds.length === 0) {
            console.log(`[StatusSync] ⚠️ No orders linked to the ${vehicles.length} vehicles in shipment ${shipmentId}`);
            return;
        }

        // 3. Update all relevant orders
        let orderStatus = status;

        // Map specific shipment statuses to order-friendly names (Case insensitive)
        const normalizedStatus = status.toLowerCase().trim();

        if (normalizedStatus === 'en route' || normalizedStatus === 'en mer' || normalizedStatus === 'en-route') {
            orderStatus = 'A BORD';
        } else if (normalizedStatus === 'arrivé' || normalizedStatus === 'arrive' || normalizedStatus === 'arrivée') {
            orderStatus = 'ARRIVÉE';
        } else if (normalizedStatus === 'livré' || normalizedStatus === 'livre' || normalizedStatus === 'enlevée') {
            orderStatus = 'ENLEVÉE';
        } else if (normalizedStatus === 'préparation') {
            orderStatus = 'A BORD'; // Prep on ship usually means loaded
        }

        console.log(`[StatusSync] 📝 Mapping shipment status "${status}" to order status "${orderStatus}" for Order IDs: ${orderIds.join(', ')}`);

        const [updatedCount] = await Order.update(
            { status: orderStatus },
            {
                where: { id: orderIds },
                individualHooks: true // Ensure hooks trigger if status changes
            }
        );

        console.log(`[StatusSync] ✅ Successfully updated ${updatedCount} orders with status "${orderStatus}" for shipment ${shipmentId}`);
    } catch (error) {
        console.error(`[StatusSync] ❌ Error syncing shipment status:`, error);
    }
}

module.exports = { syncShipmentStatusToOrders };
