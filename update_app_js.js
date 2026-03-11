const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'USER PC', 'Documents', 'PLATFORME', 'gestion-commandes-vehicules', 'js', 'app.js');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update showPurchaseOrderDetails UI
const logisticsEndPattern = /<\/div>\s+<\/div>\s+<\/div>\s+<div class="modal-footer">/;
const tasksUI = `                                </div>

                                <!-- Actions à faire (To-Do List) -->
                                <div class="details-section" style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;">
                                    <h3 style="display: flex; justify-content: space-between; align-items: center; font-size: 1rem;">
                                        <span><i class="fas fa-clipboard-list"></i> Actions à faire</span>
                                        <button class="btn-action success-alt" onclick="app.addPurchaseOrderTask('\${p.id}')" title="Ajouter une action"><i class="fas fa-plus"></i></button>
                                    </h3>
                                    <div id="po-tasks-container-\${p.id}" class="tasks-list" style="margin-top: 15px;">
                                        \${this.renderPurchaseOrderTasks(p)}
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">`;

if (content.includes('po-tasks-container-')) {
    console.log('UI already updated or partially updated.');
} else {
    content = content.replace(logisticsEndPattern, tasksUI);
}

// 2. Add helper functions
const detailsEndPattern = /document\.body\.insertAdjacentHTML\('beforeend', modalHtml\);\s+},/;
const helperFunctions = `        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },

    renderPurchaseOrderTasks(po) {
        if (!po.tasks || po.tasks.length === 0) {
            return '<p style="color: var(--text-dim); font-size: 0.85rem; font-style: italic;">Aucune action enregistrée.</p>';
        }

        return po.tasks.map((task, index) => \`
            <div class="task-item" style="display: flex; align-items: center; gap: 10px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px; margin-bottom: 5px; border: 1px solid rgba(255,255,255,0.05);">
                <input type="checkbox" \${task.completed ? 'checked' : ''} onchange="app.togglePurchaseOrderTask('\${po.id}', \${index})" style="width: 18px; height: 18px; cursor: pointer;">
                <span style="flex: 1; \${task.completed ? 'text-decoration: line-through; color: var(--text-dim);' : ''} font-size: 0.9rem;">
                    \${task.text}
                </span>
                <button class="btn-icon danger" onclick="app.deletePurchaseOrderTask('\${po.id}', \${index})" style="padding: 4px 8px; font-size: 0.75rem;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        \`).join('');
    },

    async addPurchaseOrderTask(poId) {
        const text = prompt("Quelle action souhaitez-vous ajouter à cet achat ?");
        if (!text || !text.trim()) return;

        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po) return;

        if (!po.tasks) po.tasks = [];
        po.tasks.push({ text: text.trim(), completed: false, createdAt: new Date().toISOString() });

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(\`po-tasks-container-\${poId}\`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de l'ajout de la tâche", "error");
        }
    },

    async togglePurchaseOrderTask(poId, taskIndex) {
        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po || !po.tasks || !po.tasks[taskIndex]) return;

        po.tasks[taskIndex].completed = !po.tasks[taskIndex].completed;

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(\`po-tasks-container-\${poId}\`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de la mise à jour de la tâche", "error");
        }
    },

    async deletePurchaseOrderTask(poId, taskIndex) {
        if (!confirm("Supprimer cette action ?")) return;

        const pos = StorageService.get(STORAGE_KEYS.PURCHASE_ORDERS);
        const po = pos.find(p => p.id === poId);
        if (!po || !po.tasks) return;

        po.tasks.splice(taskIndex, 1);

        try {
            await StorageService.update(STORAGE_KEYS.PURCHASE_ORDERS, poId, po);
            const container = document.getElementById(\`po-tasks-container-\${poId}\`);
            if (container) container.innerHTML = this.renderPurchaseOrderTasks(po);
        } catch (err) {
            this.showToast("Erreur lors de la suppression de la tâche", "error");
        }
    },`;

if (content.includes('renderPurchaseOrderTasks(po)')) {
    console.log('Helper functions already added.');
} else {
    content = content.replace(detailsEndPattern, helperFunctions);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('app.js updated successfully!');
