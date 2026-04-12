const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'USER PC', 'Documents', 'PLATFORME', 'gestion-commandes-vehicules', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add single PO print button to renderPurchases
const actionsCellPattern = /<div class="actions-cell">\s*<button class="btn-icon" onclick="app\.showPurchaseOrderDetails\('\${p\.id}'\)" title="Détails" style="background: rgba\(var\(--primary-rgb\), 0\.1\); color: var\(--primary\);"><i class="fas fa-eye"><\/i><\/button>/;
const actionWithPrint = `<div class="actions-cell">
                                                <button class="btn-icon" onclick="app.showPurchaseOrderDetails('\${p.id}')" title="Détails" style="background: rgba(var(--primary-rgb), 0.1); color: var(--primary);"><i class="fas fa-eye"></i></button>
                                                <button class="btn-icon" onclick="app.exportSinglePurchaseOrderToPDF('\${p.id}')" title="Imprimer" style="background: rgba(var(--success-rgb), 0.1); color: var(--success);"><i class="fas fa-print"></i></button>`;

if (content.includes("onclick=\"app.exportSinglePurchaseOrderToPDF('\${p.id}')\"")) {
    console.log('Single PO print button already added.');
} else if (actionsCellPattern.test(content)) {
    content = content.replace(actionsCellPattern, actionWithPrint);
    console.log('Single PO print button added to actions cell.');
} else {
    console.log('Error: Could not find actions cell pattern in renderPurchases.');
}

// 2. Add exportSinglePurchaseOrderToPDF function after exportPurchaseOrdersToPDF
const exportBulkEnd = /doc\.save\(\`etat_achats_\${new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]}\.pdf\`\);\s+this\.showToast\('État des achats généré', 'success'\);\s+\},/;
const exportSingleFunction = `doc.save(\`etat_achats_\${new Date().toISOString().split('T')[0]}.pdf\`);
        this.showToast('État des achats généré', 'success');
    },

    exportSinglePurchaseOrderToPDF(poId) {
        if (!window.jspdf || !window.jspdf.jsPDF) return alert("Bibliothèque PDF manquante.");
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'mm', 'a4');

        const purchaseOrders = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS) || [];
        const po = purchaseOrders.find(p => p.id === poId);
        if (!po) return alert("Commande d'achat introuvable.");

        const clients = StorageService.get(STORAGE_KEYS.CLIENTS) || [];
        const orders = StorageService.get(STORAGE_KEYS.ORDERS) || [];

        const columns = [
            "ID Commande", "Nom Client", "Passport", "NIN",
            "Marque", "Modèle", "Couleur", "VIN",
            "Adresse", "C.P."
        ];

        const rows = [];
        const poVehicles = po.vehicles || [];
        poVehicles.forEach(v => {
            let client = null;
            if (v.clientId) {
                client = clients.find(c => c.id === v.clientId);
            } else if (v.orderId) {
                const order = orders.find(o => o.id === v.orderId);
                if (order && order.clientId) {
                    client = clients.find(c => c.id === order.clientId);
                }
            }

            rows.push([
                po.id,
                client ? \`\${client.firstName} \${client.lastName}\` : "EN STOCK",
                client ? (client.passportNumber || "-") : "-",
                client ? (client.nin || "-") : "-",
                v.brand || "-",
                v.model || "-",
                v.color || "-",
                v.chassisNumber || "-",
                client ? (client.address || "-") : "-",
                client ? (client.postalCode || "-") : "-"
            ]);
        });

        // Logo Simulation (Red & Black)
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0); // Black
        doc.text("TIBOU", 14, 20);
        
        const tibouWidth = doc.getTextWidth("TIBOU ");
        doc.setTextColor(213, 0, 0); // Red
        doc.text("AUTO", 14 + tibouWidth, 20);

        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 0, 0); // Red
        doc.text("CHINA CARS", 14, 24);

        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(70, 70, 70);
        doc.text(\`Détails Commande d'Achat #\${po.id}\`, 14, 32);

        doc.setFontSize(10);
        doc.setTextColor(50);
        doc.text(\`Fournisseur: \${po.supplierName || 'N/A'}\`, 14, 38);
        doc.text(\`Date: \${po.purchaseDate ? new Date(po.purchaseDate).toLocaleDateString() : 'N/A'}\`, 80, 38);

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(\`Généré le: \${new Date().toLocaleString()}\`, 14, 44);

        doc.autoTable({
            head: [columns],
            body: rows,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [213, 0, 0] },
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 35 }
            }
        });

        doc.save(\`achat_\${po.id}_\${new Date().toISOString().split('T')[0]}.pdf\`);
        this.showToast('PDF de la commande généré', 'success');
    },`;

if (content.includes('exportSinglePurchaseOrderToPDF(poId)')) {
    console.log('exportSinglePurchaseOrderToPDF function already added.');
} else if (exportBulkEnd.test(content)) {
    content = content.replace(exportBulkEnd, exportSingleFunction);
    console.log('exportSinglePurchaseOrderToPDF function added.');
} else {
    console.log('Error: Could not find exportPurchaseOrdersToPDF end pattern.');
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('app.js updated successfully!');
