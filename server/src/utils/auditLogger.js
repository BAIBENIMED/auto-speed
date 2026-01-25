const AuditLog = require('../models/AuditLog');

const attachAuditLog = (model, entityName) => {
    // Helper to log changes
    const logChange = async (action, instance, options) => {
        try {
            const userId = options.userId || null;
            const userName = options.userName || 'System';

            let oldValues = null;
            let newValues = instance.get();

            if (action === 'UPDATE') {
                oldValues = instance._previousDataValues;
                // Filter only changed values for update
                const changedKeys = instance.changed();
                if (!changedKeys) return; // No changes

                const filteredNew = {};
                const filteredOld = {};

                changedKeys.forEach(key => {
                    filteredNew[key] = newValues[key];
                    filteredOld[key] = oldValues[key];
                });

                newValues = filteredNew;
                oldValues = filteredOld;
            } else if (action === 'DELETE') {
                oldValues = instance.get();
                newValues = null;
            }

            await AuditLog.create({
                userId,
                userName,
                action,
                entity: entityName,
                entityId: instance.id?.toString() || instance.uuid?.toString(),
                oldValues,
                newValues,
                endpoint: options.endpoint,
                ipAddress: options.ipAddress
            });
        } catch (error) {
            console.error(`Error creating audit log for ${entityName}:`, error);
        }
    };

    // Attach Hooks
    model.addHook('afterCreate', (instance, options) => logChange('CREATE', instance, options));
    model.addHook('afterUpdate', (instance, options) => logChange('UPDATE', instance, options));
    model.addHook('afterDestroy', (instance, options) => logChange('DELETE', instance, options));
};

module.exports = attachAuditLog;
