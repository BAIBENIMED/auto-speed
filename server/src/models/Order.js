const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    clientId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'client_id'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Processing'
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'total_amount'
    },
    remarks: {
        type: DataTypes.TEXT
    },
    isValidated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_validated'
    },
    vehicleId: {
        type: DataTypes.STRING(50),
        field: 'vehicle_id'
    },
    vehicleName: {
        type: DataTypes.STRING(200),
        field: 'vehicle_name'
    },
    requestedBrand: {
        type: DataTypes.STRING(100),
        field: 'requested_brand'
    },
    requestedModel: {
        type: DataTypes.STRING(100),
        field: 'requested_model'
    },
    requestedColor: {
        type: DataTypes.STRING(100),
        field: 'requested_color'
    },
    requestedTrim: {
        type: DataTypes.STRING(100),
        field: 'requested_trim'
    },
    requestedCategory: {
        type: DataTypes.STRING(50),
        field: 'requested_category'
    },
    showroom: {
        type: DataTypes.STRING(100)
    },
    currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'DZD'
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_archived'
    },
    tasks: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: true
    },
    referenceDrive: {
        type: DataTypes.STRING(100),
        field: 'reference_drive'
    },
    trackingCode: {
        type: DataTypes.STRING(10),
        field: 'tracking_code',
        unique: true,
        allowNull: true
    }
}, {
    tableName: 'orders',
    timestamps: true
});

module.exports = Order;
