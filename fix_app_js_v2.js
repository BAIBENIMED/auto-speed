const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'USER PC', 'Documents', 'PLATFORME', 'gestion-commandes-vehicules', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Fix the IMPRIMER button in renderPurchases
const oldButton = `onclick="app.exportPurchaseOrdersToPDF()" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5; border-color: rgba(79, 70, 229, 0.2);" title="Imprimer l'état des achats">`;
const newButton = `onclick="app.showPurchaseOrderPrintFiltersModal()" style="background: rgba(79, 70, 229, 0.1); color: #4f46e5; border-color: rgba(79, 70, 229, 0.2);" title="Imprimer l'état des achats avec filtres">`;

if (content.includes(oldButton)) {
    content = content.replace(oldButton, newButton);
    console.log('Button updated successfully.');
} else if (content.includes(newButton)) {
    console.log('Button was already updated.');
} else {
    console.log('Error: Could not find the button pattern.');
}

// 2. Double check client search presence
if (content.includes('id="client-search-input"')) {
    console.log('Client search input is present.');
} else {
    console.log('Error: Client search input is missing.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Script execution finished.');
