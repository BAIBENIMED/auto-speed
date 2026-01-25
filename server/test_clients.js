const { getAll } = require('./src/controllers/clientController');
const { User, Role } = require('./src/models');

async function test() {
    const adminUser = await User.findOne({ where: { roleId: 'admin' }, include: [{ model: Role, as: 'role' }] });

    const req = {
        user: adminUser
    };

    const res = {
        json: (data) => {
            console.log('API Response:', JSON.stringify(data, null, 2));
        },
        status: (code) => ({
            json: (data) => {
                console.log('API Error Response (' + code + '):', JSON.stringify(data, null, 2));
            }
        })
    };

    await getAll(req, res);
}

test().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
