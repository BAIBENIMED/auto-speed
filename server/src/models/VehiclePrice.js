const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehiclePrice = sequelize.define('VehiclePrice', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    trimId: {
        type: DataTypes.STRING(255),
        field: 'trim_id',
        allowNull: false,
        references: {
            model: 'vehicle_trims',
            key: 'id'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        field: 'supplier_id',
        allowNull: false,
        references: {
            model: 'suppliers',
            key: 'id'
        }
    },
    priceUSD: {
        type: DataTypes.DECIMAL(15, 2),
        field: 'price_usd',
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'vehicle_prices',
    timestamps: true
});

module.exports = VehiclePrice;
