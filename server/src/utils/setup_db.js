const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
    const dbName = process.env.DB_NAME || 'tibouauto_db';
    console.log(`🔌 Connexion à MySQL...`);

    try {
        // Connect creating a connection without a database selected
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 3306
        });

        console.log(`🛠️  Création de la base de données '${dbName}' si elle n'existe pas...`);

        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
        console.log(`✅ Base de données '${dbName}' prête.`);

        await connection.end();
    } catch (error) {
        console.error('❌ Erreur lors de la configuration de la base de données :', error.message);
        console.log('💡 Vérifiez votre mot de passe dans le fichier .env');
    }
}

setupDatabase();
