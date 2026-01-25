const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExchangeRate = sequelize.define('ExchangeRate', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    fromCurrency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: 'from_currency'
    },
    toCurrency: {
        type: DataTypes.STRING(10),
        allowNull: false,
        field: 'to_currency'
    },
    rate: {
        type: DataTypes.DECIMAL(15, 6),
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    }
}, {
    tableName: 'exchange_rates',
    timestamps: true,
    indexes: [
        {
            unique: true,
            fields: ['from_currency', 'to_currency', 'date']
        },
        {
            fields: ['date']
        }
    ]
});

module.exports = ExchangeRate;
