const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = require('./server/src/config/database');
const Shipment = require('./server/src/models/Shipment');

async function checkShipments() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const shipments = await Shipment.findAll();
        console.log(`Total shipments: ${shipments.length}`);

        const withCoords = shipments.filter(s => s.currentLat && s.currentLng);
        console.log(`Shipments with coordinates: ${withCoords.length}`);

        const activeWithCoords = withCoords.filter(s =>
            !s.isArchived &&
            ['En mer', 'Préparation', 'Arrivé'].includes(s.status)
        );
        console.log(`Active shipments with coords (En mer, Préparation, Arrivé): ${activeWithCoords.length}`);

        if (activeWithCoords.length > 0) {
            console.log('Sample Active Shipment:', JSON.stringify(activeWithCoords[0], null, 2));
        } else if (withCoords.length > 0) {
            console.log('Sample Shipment with coords (but not active):', JSON.stringify(withCoords[0].toJSON(), null, 2));
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkShipments();
