const WebSocket = require('ws');

class TrackingService {
    constructor() {
        this.apiKey = process.env.AISSTREAM_API_KEY;
        this.ws = null;
        this.reconnectTimer = null;
        this.activeMmsis = new Set();
        this.lastRefresh = null;
    }

    async start() {
        if (!this.apiKey) {
            console.error('[TrackingService] No AISSTREAM_API_KEY found in .env');
            return;
        }

        // Initial refresh
        await this.refreshMmsis();
        // Periodically refresh (as fallback)
        setInterval(() => this.refreshMmsis(), 1000 * 60 * 15);

        this.connect();
    }

    async refreshMmsis() {
        try {
            const { Shipment } = require('../models');
            const shipments = await Shipment.findAll({
                where: { isArchived: false }
            });

            const newMmsis = new Set();
            shipments.forEach(s => {
                if (s.mmsi && s.mmsi.toString().trim() !== '') {
                    newMmsis.add(s.mmsi.toString().trim());
                }
            });

            this.activeMmsis = newMmsis;
            this.lastRefresh = new Date();
            console.log(`[TrackingService] Refresh complete. Tracking ${this.activeMmsis.size} vessels: ${Array.from(this.activeMmsis).join(', ')}`);
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
                BoundingBoxes: [[[-90, -180], [90, 180]]]
            };
            this.ws.send(JSON.stringify(subscriptionMessage));
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (!message.MetaData || !message.MetaData.MMSI) return;

                const mmsi = message.MetaData.MMSI.toString().trim();

                if (this.activeMmsis.has(mmsi)) {
                    console.log(`[TrackingService] Signal CAPTURED for vessel: ${mmsi}`);
                    this.updateVesselPosition(message);
                }
            } catch (e) {
                // Ignore errors
            }
        });

        this.ws.on('error', (err) => {
            console.error('[TrackingService] WebSocket error:', err.message);
        });

        this.ws.on('close', () => {
            console.log('[TrackingService] WebSocket closed. Reconnecting in 30s...');
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 30000);
        });
    }

    async updateVesselPosition(message) {
        try {
            const mmsi = message.MetaData.MMSI.toString().trim();
            const { Latitude, Longitude, ShipName } = message.MetaData;

            if (Latitude === undefined || Longitude === undefined) return;

            let updateData = {
                currentLat: Latitude,
                currentLng: Longitude,
                lastUpdate: new Date(),
                shipStatus: ShipName || 'En route'
            };

            // Parse specific message info
            if (message.MessageType === 'PositionReport' && message.Message.PositionReport) {
                updateData.speed = message.Message.PositionReport.Sog;
                updateData.course = message.Message.PositionReport.Cog;
            } else if (message.MessageType === 'ShipStaticData' && message.Message.ShipStaticData) {
                const staticData = message.Message.ShipStaticData;
                if (staticData.Destination && staticData.Destination !== '@@@@@@@@@@@@@@@@@@@@') {
                    updateData.destination = staticData.Destination.trim();
                }
                if (staticData.Eta) {
                    const { Month, Day, Hour, Minute } = staticData.Eta;
                    if (Month > 0 && Day > 0) {
                        const now = new Date();
                        let year = now.getFullYear();
                        if (Month < (now.getMonth() + 1) && (now.getMonth() + 1) >= 10 && Month <= 3) year++;
                        updateData.eta = new Date(year, Month - 1, Day, Hour < 24 ? Hour : 0, Minute < 60 ? Minute : 0);
                    }
                }
            }

            // Database update with trim aware query
            const { Shipment } = require('../models');
            const { sequelize } = require('../config/database');

            await Shipment.update(updateData, {
                where: sequelize.where(sequelize.fn('TRIM', sequelize.col('mmsi')), mmsi)
            });

        } catch (error) {
            console.error('[TrackingService] Database update error:', error);
        }
    }

    getStatus() {
        return {
            connected: this.ws && this.ws.readyState === WebSocket.OPEN,
            trackingCount: this.activeMmsis.size,
            activeMmsis: Array.from(this.activeMmsis),
            lastRefresh: this.lastRefresh
        };
    }
}

module.exports = new TrackingService();
