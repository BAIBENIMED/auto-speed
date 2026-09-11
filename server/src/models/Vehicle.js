const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    brand: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    model: {
        type: DataTypes.STRING(100)
    },
    year: {
        type: DataTypes.INTEGER
    },
    month: {
        type: DataTypes.STRING(50)
    },
    supplier: {
        type: DataTypes.STRING(200)
    },
    mileage: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    category: {
        type: DataTypes.STRING(100)
    },
    chassisNumber: {
        type: DataTypes.STRING(100),
        field: 'chassis_number'
    },
    color: {
        type: DataTypes.STRING(100)
    },
    motorization: {
        type: DataTypes.STRING(200)
    },
    trim: {
        type: DataTypes.STRING(200)
    },
    trimId: {
        type: DataTypes.STRING(255),
        field: 'trim_id',
        allowNull: true
    },
    remarks: {
        type: DataTypes.TEXT
    },
    condition: {
        type: DataTypes.STRING(50)
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Available'
    },
    purchasePrice: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'purchase_price'
    },
    purchaseCurrency: {
        type: DataTypes.STRING(10),
        field: 'purchase_currency'
    },
    sellingPrice: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'selling_price'
    },
    sellingCurrency: {
        type: DataTypes.STRING(10),
        field: 'selling_currency'
    },
    estimatedCustomsDuty: {
        type: DataTypes.DECIMAL(10, 2),
        field: 'estimated_customs_duty'
    },
    orderId: {
        type: DataTypes.STRING(50),
        field: 'order_id'
    },
    shipmentId: {
        type: DataTypes.STRING(50),
        field: 'shipment_id'
    },
    purchaseOrderId: {
        type: DataTypes.STRING(50),
        field: 'purchase_order_id'
    },
    clientId: {
        type: DataTypes.STRING(50),
        field: 'client_id'
    },
    options: {
        type: DataTypes.TEXT
    },
    soldRegistration: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'sold_registration'
    },
    isArchived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_archived'
    },
    soldRegistrationOwner: {
        type: DataTypes.TEXT,
        field: 'sold_registration_owner'
    },
    showroom: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    videoLink: {
        type: DataTypes.STRING(500),
        field: 'video_link'
    },
    blLink: {
        type: DataTypes.STRING(500),
        field: 'bl_link'
    },
    originalClientId: {
        type: DataTypes.STRING(50),
        field: 'original_client_id'
    },
    originalOwnerName: {
        type: DataTypes.STRING(200),
        field: 'original_owner_name'
    },
    // Saisie libre : adresse, ville, showroom ou point de retrait convenu
    deliveryLocation: {
        type: DataTypes.STRING(200),
        field: 'delivery_location'
    }
}, {
    tableName: 'vehicles',
    timestamps: true
});

module.exports = Vehicle;
