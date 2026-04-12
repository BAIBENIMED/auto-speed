const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleTransfer = sequelize.define('VehicleTransfer', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    vehicleId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'vehicle_id'
    },
    fromClientId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'from_client_id'
    },
    toClientId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'to_client_id'
    },
    transferDate: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'transfer_date'
    },
    withBL: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'with_bl'
    },
    notes: {
        type: DataTypes.TEXT
    }
}, {
    tableName: 'vehicle_transfers',
    timestamps: true
});

module.exports = VehicleTransfer;
