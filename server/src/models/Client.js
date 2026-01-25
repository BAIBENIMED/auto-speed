const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Client = sequelize.define('Client', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'first_name'
    },
    lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'last_name'
    },
    email: {
        type: DataTypes.STRING(200)
    },
    phone: {
        type: DataTypes.STRING(50)
    },
    company: {
        type: DataTypes.STRING(200)
    },
    address: {
        type: DataTypes.TEXT
    },
    passportNumber: {
        type: DataTypes.STRING(100),
        field: 'passport_number'
    },
    showroom: {
        type: DataTypes.STRING(100)
    },
    reference: {
        type: DataTypes.STRING(50)
    }
}, {
    tableName: 'clients',
    timestamps: true
});

module.exports = Client;
