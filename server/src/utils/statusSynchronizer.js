const { Vehicle, Order } = require('../models');

/**
 * Synchronizes a shipment's status to all its linked orders.
 * @param {string} shipmentId 
 * @param {string} status 
 */
async function syncShipmentStatusToOrders(shipmentId, status) {
    if (!shipmentId || !status) return;

    try {
        console.log(`[StatusSync] Syncing status "${status}" to orders for shipment ${shipmentId}`);

        // 1. Find all vehicles linked to this shipment
        const vehicles = await Vehicle.findAll({
            where: { shipmentId },
            attributes: ['id', 'orderId']
        });

        if (!vehicles || vehicles.length === 0) {
            console.log(`[StatusSync] No vehicles found for shipment ${shipmentId}`);
            return;
        }

        // 2. Extract unique order IDs
        const orderIds = [...new Set(vehicles.map(v => v.orderId).filter(id => !!id))];

        if (orderIds.length === 0) {
            console.log(`[StatusSync] No orders linked to vehicles in shipment ${shipmentId}`);
            return;
        }

        // 3. Update all relevant orders
        // Use the status mapping if needed, or direct mapping if they share the same status names
        // Most shipment statuses like "En Mer", "Arrivé" are desired for Orders too.
        await Order.update(
            { status: status },
            { where: { id: orderIds } }
        );

        console.log(`[StatusSync] Successfully updated ${orderIds.length} orders for shipment ${shipmentId}`);
    } catch (error) {
        console.error(`[StatusSync] Error syncing shipment status:`, error);
    }
}

module.exports = { syncShipmentStatusToOrders };
