const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    orderId: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true, // One purchase per order
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'suppliers',
            key: 'id'
        }
    },
    supplierName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'En cours' // En cours, Commandé, Payé, Livré
    },
    purchaseDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'purchase_orders',
    timestamps: true
});

module.exports = PurchaseOrder;
