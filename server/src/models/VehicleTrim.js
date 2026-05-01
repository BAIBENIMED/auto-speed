const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleTrim = sequelize.define('VehicleTrim', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    modelId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'vehicle_models',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    characteristics: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'vehicle_trims',
    timestamps: true
});

module.exports = VehicleTrim;
