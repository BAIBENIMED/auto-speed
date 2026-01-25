const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Shipment = sequelize.define('Shipment', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    containerNumber: {
        type: DataTypes.STRING(100),
        field: 'container_number'
    },
    shipmentDate: {
        type: DataTypes.DATE,
        field: 'shipment_date'
    },
    carrier: {
        type: DataTypes.STRING(100)
    },
    destination: {
        type: DataTypes.STRING(200)
    },
    loadingPort: {
        type: DataTypes.STRING(200),
        field: 'loading_port'
    },
    blNumber: {
        type: DataTypes.STRING(100),
        field: 'bl_number'
    },
    trackingNumber: {
        type: DataTypes.STRING(100),
        field: 'tracking_number'
    },
    etd: {
        type: DataTypes.DATE
    },
    eta: {
        type: DataTypes.DATE
    },
    docReceptionDate: {
        type: DataTypes.DATE,
        field: 'doc_reception_date'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Préparation'
    },
    forwarder: {
        type: DataTypes.STRING(100)
    },
    arrivalDate: {
        type: DataTypes.DATE,
        field: 'arrival_date'
    },
    customsClearanceDate: {
        type: DataTypes.DATE,
        field: 'customs_clearance_date'
    },
    pickupDate: {
        type: DataTypes.DATE,
        field: 'pickup_date'
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_archived'
    }
}, {
    tableName: 'shipments',
    timestamps: true
});

module.exports = Shipment;
