// Import all models
const User = require('./User');
const Role = require('./Role');
const Client = require('./Client');
const Order = require('./Order');
const Vehicle = require('./Vehicle');
const Shipment = require('./Shipment');
const CashTransaction = require('./CashTransaction');
const Settings = require('./Settings');
const ExchangeRate = require('./ExchangeRate');
const DynamicAttribute = require('./DynamicAttribute');
const Brand = require('./Brand');
const VehicleModel = require('./VehicleModel');
const Showroom = require('./Showroom');
const AuditLog = require('./AuditLog');
const PurchaseOrder = require('./PurchaseOrder');
const Supplier = require('./Supplier');
const Notification = require('./Notification');
const Voyage = require('./Voyage');
const VehicleTransfer = require('./VehicleTransfer');
const attachAuditLog = require('../utils/auditLogger');

// Define relationships
User.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });
Role.hasMany(User, { foreignKey: 'roleId' });

User.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
Client.hasMany(User, { foreignKey: 'clientId' });

Order.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });
Client.hasMany(Order, { foreignKey: 'clientId' });

Vehicle.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasMany(Vehicle, { foreignKey: 'orderId' });

PurchaseOrder.belongsTo(Order, { foreignKey: 'orderId', as: 'order' }); // Kept for legacy
Order.hasMany(PurchaseOrder, { foreignKey: 'orderId', as: 'purchaseOrders' }); // Kept for legacy

PurchaseOrder.belongsTo(Supplier, { foreignKey: 'supplierId', as: 'supplierDetails' });
Supplier.hasMany(PurchaseOrder, { foreignKey: 'supplierId' });

PurchaseOrder.hasMany(Vehicle, { foreignKey: 'purchaseOrderId', as: 'vehicles' });
Vehicle.belongsTo(PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });

Vehicle.belongsTo(Shipment, { foreignKey: 'shipmentId', as: 'shipment' });
Shipment.hasMany(Vehicle, { foreignKey: 'shipmentId' });

Vehicle.hasMany(VehicleTransfer, { foreignKey: 'vehicleId', as: 'transfers' });
VehicleTransfer.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

VehicleTransfer.belongsTo(Client, { foreignKey: 'fromClientId', as: 'fromClient' });
VehicleTransfer.belongsTo(Client, { foreignKey: 'toClientId', as: 'toClient' });

CashTransaction.belongsTo(Order, { foreignKey: 'orderId', as: 'order' });
Order.hasMany(CashTransaction, { foreignKey: 'orderId' });

// Brand & Model relationships
Brand.hasMany(VehicleModel, { foreignKey: 'brandId', as: 'models', onDelete: 'CASCADE' });
VehicleModel.belongsTo(Brand, { foreignKey: 'brandId', as: 'brand' });

// Voyage relationships
Voyage.hasMany(Shipment, { foreignKey: 'voyageId', as: 'shipments' });
Shipment.belongsTo(Voyage, { foreignKey: 'voyageId', as: 'voyageDetails' });

// Attach Audit Logs
attachAuditLog(Order, 'Commande');
attachAuditLog(Vehicle, 'Véhicule');
attachAuditLog(Client, 'Client');
attachAuditLog(CashTransaction, 'Transaction Caisse');
attachAuditLog(User, 'Utilisateur');
attachAuditLog(Settings, 'Paramètres');
attachAuditLog(PurchaseOrder, 'Commande Achat');
attachAuditLog(Supplier, 'Fournisseur');
attachAuditLog(Shipment, 'Expedition');
attachAuditLog(Voyage, 'Voyage');

module.exports = {
    User,
    Role,
    Client,
    Order,
    Vehicle,
    Shipment,
    CashTransaction,
    Settings,
    ExchangeRate,
    DynamicAttribute,
    Brand,
    VehicleModel,
    Showroom,
    AuditLog,
    PurchaseOrder,
    Supplier,
    Notification,
    Voyage,
    VehicleTransfer
};

// Audit Log associations
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user', onDelete: 'SET NULL', hooks: true });
User.hasMany(AuditLog, { foreignKey: 'userId', onDelete: 'SET NULL', hooks: true });
