function mapStatus(status) {
    let orderStatus = status;
    const normalizedStatus = status.toLowerCase().trim();

    if (normalizedStatus === 'en route' || normalizedStatus === 'en mer' || normalizedStatus === 'en-route' || normalizedStatus === 'in_transit') {
        orderStatus = 'EN MER';
    } else if (normalizedStatus === 'loaded' || normalizedStatus === 'departure') {
        orderStatus = 'A BORD';
    } else if (normalizedStatus === 'arrivé' || normalizedStatus === 'arrive' || normalizedStatus === 'arrivée' || normalizedStatus === 'arrived' || normalizedStatus === 'arrivee' || normalizedStatus === 'arriver' || normalizedStatus.includes('discharge')) {
        orderStatus = 'ARRIVÉE';
    } else if (normalizedStatus === 'livré' || normalizedStatus === 'livre' || normalizedStatus === 'enlevée' || normalizedStatus === 'delivered' || normalizedStatus === 'livree' || normalizedStatus === 'livrée') {
        orderStatus = 'ENLEVÉE';
    } else if (normalizedStatus === 'préparation') {
        orderStatus = 'A BORD';
    }
    return orderStatus;
}

console.log('Testing "discharge":', mapStatus('discharge'));
console.log('Testing "Discharged":', mapStatus('Discharged'));
console.log('Testing "Arrivé":', mapStatus('Arrivé'));
