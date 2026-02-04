const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Voyage = sequelize.define('Voyage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    blNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'bl_number'
    },
    vesselName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    carrier: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    loadingPort: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    destination: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    etd: {
        type: DataTypes.DATEONLY, // Date only makes sense for schedule
        allowNull: true
    },
    eta: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    arrivalDate: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'Planifié'
    },
    active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'voyages',
    timestamps: true
});

module.exports = Voyage;
