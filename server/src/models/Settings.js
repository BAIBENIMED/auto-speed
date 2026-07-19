const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Settings = sequelize.define('Settings', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    companyName: {
        type: DataTypes.STRING(200),
        field: 'company_name',
        defaultValue: 'AUTO SPEED'
    },
    purchaseCurrency: {
        type: DataTypes.STRING(10),
        field: 'purchase_currency',
        defaultValue: 'EUR'
    },
    sellingCurrency: {
        type: DataTypes.STRING(10),
        field: 'selling_currency',
        defaultValue: 'EUR'
    },
    theme: {
        type: DataTypes.STRING(50),
        defaultValue: 'dark'
    },
    brands: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    motors: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    colors: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    categories: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    showrooms: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    currencies: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    carriers: {
        type: DataTypes.JSON,
        defaultValue: []
    },
    customsCurrency: {
        type: DataTypes.STRING(10),
        field: 'customs_currency',
        defaultValue: 'XAF'
    },
    geminiApiKey: {
        type: DataTypes.STRING(200),
        field: 'gemini_api_key'
    },
    useAiExtraction: {
        type: DataTypes.BOOLEAN,
        field: 'use_ai_extraction',
        defaultValue: false
    },
    geminiModel: {
        type: DataTypes.STRING(100),
        field: 'gemini_model',
        defaultValue: 'gemini-1.5-flash'
    },
    availableGeminiModels: {
        type: DataTypes.JSON,
        field: 'available_gemini_models',
        defaultValue: []
    }
}, {
    tableName: 'settings',
    timestamps: true
});

module.exports = Settings;
