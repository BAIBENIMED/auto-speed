const { Vehicle, Order } = require('../models');
const { Op } = require('sequelize');

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
            attributes: ['id', 'orderId', 'status'] // Use model-defined names
        });

        if (!vehicles || vehicles.length === 0) {
            console.log(`[StatusSync] ⚠️ No vehicles found for shipment ${shipmentId}`);
            return;
        }

        const vehicleIds = vehicles.map(v => v.id);
        const orderIdsFromVehicles = vehicles.map(v => v.orderId).filter(id => !!id);

        console.log(`[StatusSync] 📍 Found ${vehicles.length} vehicles. Direct linked order IDs: ${orderIdsFromVehicles.join(', ') || 'none'}`);

        // 2. Find ALL orders linked to these vehicles (bidirectional check)
        const orders = await Order.findAll({
            where: {
                [Op.or]: [
                    { id: { [Op.in]: orderIdsFromVehicles } },
                    { vehicleId: { [Op.in]: vehicleIds } }
                ]
            },
            attributes: ['id']
        });

        const finalOrderIds = [...new Set(orders.map(o => o.id))];

        if (finalOrderIds.length === 0) {
            console.log(`[StatusSync] ⚠️ No orders linked to the ${vehicles.length} vehicles in shipment ${shipmentId} (checked both vehicle.orderId and order.vehicleId)`);
            return;
        }

        // 3. Update all relevant orders
        let orderStatus = status;

        // Map specific shipment statuses to order-friendly names (Case insensitive)
        const normalizedStatus = status.toLowerCase().trim();

        if (normalizedStatus === 'en route' || normalizedStatus === 'en mer' || normalizedStatus === 'en-route' || normalizedStatus === 'in_transit') {
            orderStatus = 'EN MER';
        } else if (normalizedStatus === 'loaded' || normalizedStatus === 'departure') {
            orderStatus = 'A BORD';
        } else if (normalizedStatus === 'arrivé' || normalizedStatus === 'arrive' || normalizedStatus === 'arrivée' || normalizedStatus === 'arrived' || normalizedStatus === 'arrivee' || normalizedStatus === 'arriver') {
            orderStatus = 'ARRIVÉE';
        } else if (normalizedStatus === 'livré' || normalizedStatus === 'livre' || normalizedStatus === 'enlevée' || normalizedStatus === 'delivered' || normalizedStatus === 'livree' || normalizedStatus === 'livrée') {
            orderStatus = 'ENLEVÉE';
        } else if (normalizedStatus === 'préparation') {
            orderStatus = 'A BORD'; // Prep on ship usually means loaded
        }

        console.log(`[StatusSync] 📝 Mapping shipment status "${status}" to order status "${orderStatus}" for Order IDs: ${finalOrderIds.join(', ')}`);

        // If the shipment is arrived, we want to force this status on all linked orders
        const updateData = { status: orderStatus };

        // Let's also enforce it on the Vehicles array we found earlier to ensure complete sync
        if (orderStatus === 'ARRIVÉE') {
            await Vehicle.update(
                { status: 'Arrived' },
                { where: { id: vehicleIds }, individualHooks: true }
            );
            console.log(`[StatusSync] 🚗 Force-updated ${vehicles.length} vehicles to 'Arrived'`);
        } else if (orderStatus === 'ENLEVÉE') {
            await Vehicle.update(
                { status: 'Sold' },
                { where: { id: vehicleIds }, individualHooks: true }
            );
        }

        const [updatedCount] = await Order.update(
            updateData,
            {
                where: { id: finalOrderIds },
                individualHooks: true // Ensure hooks trigger if status changes
            }
        );

        console.log(`[StatusSync] ✅ Successfully updated ${updatedCount} orders to "${orderStatus}" for shipment ${shipmentId}`);
    } catch (error) {
        console.error(`[StatusSync] ❌ Error syncing shipment status:`, error);
    }
}

module.exports = { syncShipmentStatusToOrders };
