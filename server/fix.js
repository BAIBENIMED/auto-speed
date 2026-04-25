const fs = require('fs');
const path = require('path');

const vcPath = path.join(__dirname, 'src', 'controllers', 'vehiclesController.js');
let vcContent = fs.readFileSync(vcPath, 'utf8');

vcContent = vcContent.replace(
    'const { toClientId, newClientData, withBL, amendmentRequestSent, newBLReceived, notes, transferOrderAsWell } = req.body;',
    'const { toClientId, newClientData, newClient, withBL, amendmentRequestSent, newBLReceived, notes, transferOrderAsWell } = req.body;\n            const clientData = newClientData || newClient;'
);
vcContent = vcContent.replace(
    'if (newClientData && Object.keys(newClientData).length > 0) {',
    'if (clientData && Object.keys(clientData).length > 0) {'
);
vcContent = vcContent.replace(
    'const newClient = await Client.create(newClientData, {',
    'const createdClient = await Client.create(clientData, {'
);
vcContent = vcContent.replace(
    'assignedClientId = newClient.id;',
    'assignedClientId = createdClient.id;'
);

fs.writeFileSync(vcPath, vcContent, 'utf8');
console.log('vehiclesController.js updated');

const serverPath = path.join(__dirname, 'server.js');
let serverContent = fs.readFileSync(serverPath, 'utf8');

if (!serverContent.includes('await models.VehicleTransfer.sync')) {
    serverContent = serverContent.replace(
        'await models.Notification.sync({ alter: true });',
        'await models.Notification.sync({ alter: true });\n            await models.VehicleTransfer.sync({ alter: true });'
    );
    fs.writeFileSync(serverPath, serverContent, 'utf8');
    console.log('server.js updated');
}

