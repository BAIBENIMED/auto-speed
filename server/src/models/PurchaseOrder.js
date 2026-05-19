const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
    id: {
        type: DataTypes.STRING(50),
        primaryKey: true
    },
    orderId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        references: {
            model: 'orders',
            key: 'id'
        }
    },
    supplierId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'suppliers',
            key: 'id'
        }
    },
    supplierName: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'En cours' // En cours, Commandé, Payé, Livré
    },
    purchaseDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    documentStatus: {
        type: DataTypes.STRING(50),
        defaultValue: 'Rien',
        field: 'document_status'
    },
    documentsReceived: {
        type: DataTypes.STRING(10),
        defaultValue: 'Non',
        field: 'documents_received'
    },
    mblStatus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'mbl_status'
    },
    hblStatus: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'hbl_status'
    },
    mblReceived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'mbl_received'
    },
    hblReceived: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'hbl_received'
    },
    loadingPort: {
        type: DataTypes.STRING(100),
        field: 'loading_port'
    },
    loadingDate: {
        type: DataTypes.DATE,
        field: 'loading_date'
    },
    etd: {
        type: DataTypes.DATE,
        field: 'etd'
    },
    eta: {
        type: DataTypes.DATE,
        field: 'eta'
    },
    isLoaded: {
        type: DataTypes.STRING(10),
        defaultValue: 'Non',
        field: 'is_loaded'
    },
    tasks: {
        type: DataTypes.JSON,
        allowNull: true
    },
    forwarder: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    carrier: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    unbundler: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    piNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'pi_number'
    }
}, {
    tableName: 'purchase_orders',
    timestamps: true
});

module.exports = PurchaseOrder;
