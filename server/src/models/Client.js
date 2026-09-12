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
    nin: {
        type: DataTypes.STRING(100),
        field: 'nin'
    },
    // Client d'un partenaire (ex : CARVEX AUTO). Ses papiers restent
    // necessaires pour le dedouanement, meme si la vente n'est pas AUTO SPEED.
    partner: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    showroom: {
        type: DataTypes.STRING(100)
    },
    reference: {
        type: DataTypes.STRING(50)
    },
    passportDriveLink: {
        type: DataTypes.STRING(500),
        field: 'passport_drive_link'
    },
    postalCode: {
        type: DataTypes.STRING(20),
        field: 'postal_code'
    },
    isValidated: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_validated'
    },
    validatedBy: {
        type: DataTypes.STRING(100),
        field: 'validated_by'
    }
}, {
    tableName: 'clients',
    timestamps: true
});

module.exports = Client;
