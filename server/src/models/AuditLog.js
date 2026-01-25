const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.STRING(50),
        allowNull: true, // System actions or unknown users
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    action: {
        type: DataTypes.ENUM('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'),
        allowNull: false
    },
    entity: {
        type: DataTypes.STRING,
        allowNull: false // e.g., 'Order', 'Vehicle', 'Client'
    },
    entityId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    oldValues: {
        type: DataTypes.JSON,
        allowNull: true
    },
    newValues: {
        type: DataTypes.JSON,
        allowNull: true
    },
    endpoint: {
        type: DataTypes.STRING,
        allowNull: true
    },
    ipAddress: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false // Logs are immutable
});

module.exports = AuditLog;
