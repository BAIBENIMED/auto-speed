const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixKeys() {
    const dbConfig = {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    };

    console.log(`🔌 Connexion à la base de données ${dbConfig.database}...`);

    try {
        const connection = await mysql.createConnection(dbConfig);

        // 1. Get all indexes for 'users' table
        const [rows] = await connection.query(`SHOW INDEX FROM users`);

        // 2. Identify unique indexes on 'username'
        const indexesToDrop = rows
            .filter(row => row.Column_name === 'username' && row.Key_name !== 'PRIMARY' && row.Non_unique === 0)
            .map(row => row.Key_name);

        console.log(`🔎 Trouvé ${indexesToDrop.length} index uniques redondants sur 'username'.`);

        if (indexesToDrop.length === 0) {
            console.log('✅ Aucun index redondant à supprimer.');
        } else {
            // 3. Drop them
            for (const keyName of indexesToDrop) {
                console.log(`🗑️  Suppression de l'index: ${keyName}...`);
                try {
                    await connection.query(`ALTER TABLE users DROP INDEX \`${keyName}\``);
                } catch (err) {
                    console.error(`❌ Échec de suppression de ${keyName}:`, err.message);
                }
            }
            console.log('✨ Nettoyage terminé.');
        }

        await connection.end();
        console.log('👋 Connexion fermée.');
    } catch (error) {
        console.error('❌ Erreur:', error.message);
    }
}

fixKeys();
