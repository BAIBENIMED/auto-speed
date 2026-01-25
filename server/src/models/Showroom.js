const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Showroom = sequelize.define('Showroom', {
    id: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: true
    },
    city: {
        type: DataTypes.STRING,
        allowNull: true
    },
    manager: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'showrooms'
});

module.exports = Showroom;
