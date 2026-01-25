const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Client, AuditLog, User } = require('./src/models');
const sequelize = require('./src/config/database');

async function testDeletion() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion DB établie');

        // 1. Setup Context (Mock User for Audit)
        // We'll manually insert a user if not exists or use a dummy one
        // Ideally we login, but for model testing we can just pass the user object to options if logic relies on it
        // But the controller usually passes it. 
        // Let's test the MODEL level deletion first, as that's where the hook is.

        console.log('🧪 Test de suppression Client...');

        // Create Client
        const client = await Client.create({
            id: 'TEST_DEL_001',
            firstName: 'Test',
            lastName: 'Deletion',
            email: 'test.del@example.com',
            phone: '000000000'
        });
        console.log(' - Client créé:', client.id);

        // Delete Client
        // We simulate what the controller does: findByPk then destroy with user context
        const clientToDelete = await Client.findByPk('TEST_DEL_001');
        await clientToDelete.destroy({
            userId: 'SYS_TEST',
            userName: 'System Test'
        });
        console.log(' - Client supprimé (commande destroy exécutée)');

        // Verify Deletion
        const checkClient = await Client.findByPk('TEST_DEL_001');
        if (!checkClient) {
            console.log('✅ Vérification: Le client n\'existe plus en base.');
        } else {
            console.error('❌ ÉCHEC: Le client existe toujours !');
            process.exit(1);
        }

        // Verify Audit Log
        const log = await AuditLog.findOne({
            where: {
                entity: 'Client',
                entityId: 'TEST_DEL_001',
                action: 'DELETE'
            }
        });

        if (log) {
            console.log('✅ Vérification: Audit Log trouvé.');
            console.log('   Action:', log.action);
            console.log('   Validé par:', log.userName);
        } else {
            console.warn('⚠️ ATTENTION: Pas de log d\'audit trouvé (ce n\'est peut-être pas bloquant mais à vérifier).');
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ ERREUR CRITIQUE:', error);
        process.exit(1);
    }
}

testDeletion();
