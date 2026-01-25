const { Brand } = require('./src/models');
const sequelize = require('./src/config/database');

const logos = {
    'Toyota': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Toyota.svg/1200px-Toyota.svg.png',
    'Mercedes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/1024px-Mercedes-Logo.svg.png',
    'Mercedes-Benz': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Mercedes-Logo.svg/1024px-Mercedes-Logo.svg.png',
    'BMW': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/BMW.svg/2048px-BMW.svg.png',
    'Audi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Audi-Logo_2016.svg/2560px-Audi-Logo_2016.svg.png',
    'Hyundai': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Hyundai_Motor_Company_logo.svg/2560px-Hyundai_Motor_Company_logo.svg.png',
    'Kia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Kia_logo.svg/2560px-Kia_logo.svg.png',
    'Peugeot': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Peugeot_Logo.svg/1200px-Peugeot_Logo.svg.png',
    'Volkswagen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/2048px-Volkswagen_logo_2019.svg.png',
    'VW': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Volkswagen_logo_2019.svg/2048px-Volkswagen_logo_2019.svg.png',
    'Nissan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Nissan_logo.png/245px-Nissan_logo.png',
    'Ford': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Ford_logo_flat.svg/2560px-Ford_logo_flat.svg.png',
    'Honda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Honda.svg/2560px-Honda.svg.png',
    'Mazda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f9/Mazda_logo_with_emblem.svg/2560px-Mazda_logo_with_emblem.svg.png',
    'Chevrolet': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Chevrolet-logo.png/2560px-Chevrolet-logo.png',
    'Renault': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Renault_2009_logo.svg/2560px-Renault_2009_logo.svg.png',
    'Citroën': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Citroen_2009_logo.svg/2560px-Citroen_2009_logo.svg.png',
    'Citroen': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Citroen_2009_logo.svg/2560px-Citroen_2009_logo.svg.png',
    'Land Rover': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Land_Rover_logo_black.svg/1200px-Land_Rover_logo_black.svg.png',
    'Range Rover': 'https://upload.wikimedia.org/wikipedia/en/thumb/9/9f/Land_Rover_logo_black.svg/1200px-Land_Rover_logo_black.svg.png',
    'Jeep': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Jeep_logo.svg/2560px-Jeep_logo.svg.png',
    'Fiat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Fiat_2007_logo.svg/2560px-Fiat_2007_logo.svg.png',
    'Tesla': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Tesla_logo.png/2048px-Tesla_logo.png',
    'Volvo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/29/Volvo_Iron_Mark.svg/2560px-Volvo_Iron_Mark.svg.png',
    'Porsche': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Porsche_Wappen.svg/1010px-Porsche_Wappen.svg.png',
    'Lexus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Lexus_logo.svg/2560px-Lexus_logo.svg.png',
    'Suzuki': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Suzuki_logo_2.svg/2560px-Suzuki_logo_2.svg.png',
    'Mitsubishi': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Mitsubishi_logo.svg/2560px-Mitsubishi_logo.svg.png',
    'Subaru': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Subaru_logo.svg/2560px-Subaru_logo.svg.png',
    'Skoda': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Skoda_Austria_Logo.svg/2560px-Skoda_Austria_Logo.svg.png',
    'Seat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Seat_logo.svg/2560px-Seat_logo.svg.png',
    'Mini': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Mini_logo.svg/2560px-Mini_logo.svg.png',
    'Dacia': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Dacia_Logo_2021.svg/2560px-Dacia_Logo_2021.svg.png',
    'BYD': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/BYD_Auto_2022_logo.svg/2560px-BYD_Auto_2022_logo.svg.png',
    'Chery': 'https://upload.wikimedia.org/wikipedia/en/thumb/2/26/Chery_logo.svg/1200px-Chery_logo.svg.png',
    'Geely': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Geely_Logo.svg/1200px-Geely_Logo.svg.png',
    'MG': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/MG_Motor_logo.svg/2560px-MG_Motor_logo.svg.png',
    'Haval': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Haval_logo.svg/2560px-Haval_logo.svg.png',
    'Changan': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8f/Changan_Automobile_logo.svg/1200px-Changan_Automobile_logo.svg.png',
    'Foton': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Foton_Motor_logo.svg/1200px-Foton_Motor_logo.svg.png',
    'JAC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/JAC_Motors_logo.svg/1200px-JAC_Motors_logo.svg.png',
    'Isuzu': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/Isuzu_Logo.svg/2560px-Isuzu_Logo.svg.png',
    'Dongfeng': 'https://upload.wikimedia.org/wikipedia/en/thumb/1/13/Dongfeng_Motor_logo.svg/1200px-Dongfeng_Motor_logo.svg.png'
};

async function updateLogos() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Get all existing brands
        const brands = await Brand.findAll();
        console.log(`Found ${brands.length} brands in database.`);

        let updatedCount = 0;

        for (const brand of brands) {
            // Check if we have a logo for this brand name
            const brandName = brand.name.trim();
            // Try exact match or match contained in buffer
            const logoUrl = logos[brandName] ||
                Object.keys(logos).find(k => brandName.toLowerCase().includes(k.toLowerCase())) ? logos[Object.keys(logos).find(k => brandName.toLowerCase().includes(k.toLowerCase()))] : null;

            if (logoUrl) {
                // Only update if no logo or DIFFERENT
                if (!brand.logo || brand.logo !== logoUrl) {
                    brand.logo = logoUrl;
                    await brand.save();
                    console.log(`✅ Updated logo for ${brandName}`);
                    updatedCount++;
                } else {
                    console.log(`- Logo already set for ${brandName}`);
                }
            } else {
                console.log(`⚠️ No logo found in map for ${brandName}`);
            }
        }

        console.log(`\nSuccess! Updated ${updatedCount} brands.`);

    } catch (error) {
        console.error('Error updating logos:', error);
    } finally {
        await sequelize.close();
    }
}

updateLogos();
