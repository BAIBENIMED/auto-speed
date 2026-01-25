const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleModel = sequelize.define('VehicleModel', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    brandId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'brands',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'vehicle_models'
});

module.exports = VehicleModel;
