const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS'),
        defaultValue: 'INFO'
    },
    title: {
        type: DataTypes.STRING(150),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    entityType: {
        type: DataTypes.STRING(50), // 'Shipment', 'Order', etc.
        allowNull: true
    },
    entityId: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    isRead: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'notifications',
    timestamps: true,
    updatedAt: false // We generally don't update notifications, just create them
});

module.exports = Notification;
