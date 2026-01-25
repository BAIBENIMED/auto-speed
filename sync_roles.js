/**
 * Manual script to sync roles from API to localStorage
 * Run this in the browser console if roles are not appearing
 */

(async function syncRoles() {
    try {
        console.log('🔄 Fetching roles from API...');

        const response = await fetch('http://localhost:5000/api/roles', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${JSON.parse(localStorage.getItem('gtm_current_user'))?.token}`
            }
        });

        const result = await response.json();

        if (result.success && result.data) {
            localStorage.setItem('gtm_roles', JSON.stringify(result.data));
            console.log('✅ Roles synced successfully:', result.data);
            console.log('📊 Total roles:', result.data.length);

            // Reload the current view if in settings
            if (typeof app !== 'undefined' && app.currentView === 'settings') {
                app.renderView('settings');
                console.log('🔄 Settings view refreshed');
            }
        } else {
            console.error('❌ Failed to fetch roles:', result.message);
        }
    } catch (error) {
        console.error('❌ Error syncing roles:', error);
    }
})();
