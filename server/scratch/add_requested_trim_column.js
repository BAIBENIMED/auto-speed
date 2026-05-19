const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        dialect: 'mysql',
        logging: console.log
    }
);

async function addColumn() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        console.log('Adding requested_trim column to orders table...');
        
        await queryInterface.addColumn('orders', 'requested_trim', {
            type: Sequelize.STRING(100),
            allowNull: true
        });
        
        console.log('Column added successfully!');
        process.exit(0);
    } catch (error) {
        if (error.original && error.original.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
            process.exit(0);
        }
        console.error('Error adding column:', error);
        process.exit(1);
    }
}

addColumn();
