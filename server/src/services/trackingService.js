const WebSocket = require('ws');
const { Shipment } = require('../models');

class TrackingService {
    constructor() {
        this.apiKey = process.env.AISSTREAM_API_KEY;
        this.ws = null;
        this.reconnectTimer = null;
        this.activeMmsis = new Set();
    }

    async start() {
        if (!this.apiKey) {
            console.error('[TrackingService] No AISSTREAM_API_KEY found in .env');
            return;
        }

        // Periodically refresh active MMSIs from database
        await this.refreshMmsis();
        setInterval(() => this.refreshMmsis(), 1000 * 60 * 60); // Every hour

        this.connect();
    }

    async refreshMmsis() {
        try {
            const shipments = await Shipment.findAll({
                where: {
                    isArchived: false,
                    status: ['En mer', 'Transit Cape', 'En route'] // Only track active shipments
                }
            });

            const newMmsis = new Set();
            shipments.forEach(s => {
                if (s.mmsi && s.mmsi.trim() !== '') {
                    newMmsis.add(s.mmsi);
                }
            });

            this.activeMmsis = newMmsis;
            console.log(`[TrackingService] Tracking ${this.activeMmsis.size} vessels.`);

            // If connection is already open, we might need to re-subscribe if the list changed
            // But AISStream usually filter by bounding box or we filter messages in onMessage
        } catch (error) {
            console.error('[TrackingService] Error refreshing MMSIs:', error);
        }
    }

    connect() {
        console.log('[TrackingService] Connecting to AISStream...');
        this.ws = new WebSocket('wss://stream.aisstream.io/v1/stream');

        this.ws.on('open', () => {
            console.log('[TrackingService] WebSocket connected.');
            const subscriptionMessage = {
                APIKey: this.apiKey,
                BoundingBoxes: [[[-90, -180], [90, 180]]], // Global tracking
                FiltersShipType: [70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80] // Cargo & Tankers
            };
            this.ws.send(JSON.stringify(subscriptionMessage));
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                const mmsi = message.MetaData.MMSI.toString();

                if (this.activeMmsis.has(mmsi)) {
                    this.updateVesselPosition(message);
                }
            } catch (e) {
                // Ignore parse errors or unrelated messages
            }
        });

        this.ws.on('error', (err) => {
            console.error('[TrackingService] WebSocket error:', err);
        });

        this.ws.on('close', () => {
            console.log('[TrackingService] WebSocket closed. Reconnecting in 30s...');
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 30000);
        });
    }

    async updateVesselPosition(message) {
        try {
            const mmsi = message.MetaData.MMSI.toString();
            const { Latitude, Longitude } = message.MetaData;

            // AIS messages have different formats based on MessageID
            let speed = null;
            let course = null;
            let status = message.MetaData.ShipName || 'En route';

            if (message.MessageType === 'PositionReport') {
                speed = message.Message.PositionReport.Sog;
                course = message.Message.PositionReport.Cog;
            }

            await Shipment.update({
                currentLat: Latitude,
                currentLng: Longitude,
                speed: speed,
                course: course,
                lastUpdate: new Date(),
                shipStatus: status
            }, {
                where: { mmsi: mmsi }
            });

            // console.log(`[TrackingService] Updated vessel ${mmsi} to ${Latitude}, ${Longitude}`);
        } catch (error) {
            console.error('[TrackingService] Error updating position:', error);
        }
    }
}

module.exports = new TrackingService();
