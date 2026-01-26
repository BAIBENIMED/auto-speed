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
        setInterval(() => this.refreshMmsis(), 1000 * 60 * 5); // Every 5 minutes instead of 1 hour

        this.connect();
    }

    async refreshMmsis() {
        try {
            const shipments = await Shipment.findAll({
                where: {
                    isArchived: false
                    // track any non-archived shipment that has an MMSI
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
                BoundingBoxes: [[[-90, -180], [90, 180]]] // Global tracking - No filters for maximum reliability
            };
            this.ws.send(JSON.stringify(subscriptionMessage));
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                const mmsi = message.MetaData.MMSI.toString();

                if (this.activeMmsis.has(mmsi)) {
                    console.log(`[TrackingService] Signal received for tracked vessel: ${mmsi}`);
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
            let updateData = {
                lastUpdate: new Date(),
                shipStatus: message.MetaData.ShipName || 'En route'
            };

            if (message.MessageType === 'PositionReport') {
                updateData.currentLat = Latitude;
                updateData.currentLng = Longitude;
                updateData.speed = message.Message.PositionReport.Sog;
                updateData.course = message.Message.PositionReport.Cog;
            } else if (message.MessageType === 'ShipStaticData') {
                const staticData = message.Message.ShipStaticData;
                if (staticData.Destination && staticData.Destination !== '@@@@@@@@@@@@@@@@@@@@') {
                    updateData.destination = staticData.Destination.trim();
                }

                // Parse ETA (Month, Day, Hour, Minute)
                if (staticData.Eta) {
                    const { Month, Day, Hour, Minute } = staticData.Eta;
                    if (Month > 0 && Day > 0) {
                        const now = new Date();
                        let year = now.getFullYear();
                        // If ETA month is smaller than now and we are at year end, it might be next year
                        if (Month < (now.getMonth() + 1) && (now.getMonth() + 1) >= 10 && Month <= 3) {
                            year++;
                        }
                        const etaDate = new Date(year, Month - 1, Day, Hour < 24 ? Hour : 0, Minute < 60 ? Minute : 0);
                        updateData.eta = etaDate;
                    }
                }
            }

            await Shipment.update(updateData, {
                where: { mmsi: mmsi }
            });

            // console.log(`[TrackingService] Updated vessel ${mmsi} to ${Latitude}, ${Longitude}`);
        } catch (error) {
            console.error('[TrackingService] Error updating position:', error);
        }
    }
}

module.exports = new TrackingService();
