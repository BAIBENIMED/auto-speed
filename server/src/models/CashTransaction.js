const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CashTransaction = sequelize.define('CashTransaction', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    orderId: {
        type: DataTypes.STRING(50),
        field: 'order_id'
    },
    clientName: {
        type: DataTypes.STRING(200),
        field: 'client_name'
    },
    showroom: {
        type: DataTypes.STRING(100)
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'EUR'
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    paymentMethod: {
        type: DataTypes.STRING(100),
        field: 'payment_method'
    },
    description: {
        type: DataTypes.TEXT
    },
    type: {
        type: DataTypes.ENUM('In', 'Out'),
        allowNull: false
    }
}, {
    tableName: 'cash_transactions',
    timestamps: true
});

module.exports = CashTransaction;
