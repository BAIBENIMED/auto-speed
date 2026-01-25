const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DynamicAttribute = sequelize.define('DynamicAttribute', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    category: {
        type: DataTypes.STRING(50),
        allowNull: false
        // 'brands', 'colors', 'carriers', 'showrooms', 'motors', 'currencies'
    },
    value: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    metadata: {
        type: DataTypes.JSON,
        // For storing additional data like models per brand
        defaultValue: null
    },
    sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        field: 'sort_order'
    }
}, {
    tableName: 'dynamic_attributes',
    timestamps: true,
    indexes: [
        {
            fields: ['category']
        }
    ]
});

module.exports = DynamicAttribute;
