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
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const rawValue = this.getDataValue('characteristics');
            try {
                return rawValue ? JSON.parse(rawValue) : {};
            } catch (e) {
                return {};
            }
        },
        set(value) {
            this.setDataValue('characteristics', value ? JSON.stringify(value) : null);
        }
    }
}, {
    tableName: 'vehicle_trims',
    timestamps: true
});

module.exports = VehicleTrim;
