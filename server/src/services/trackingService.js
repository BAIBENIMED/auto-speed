const axios = require('axios');

class TrackingServiceHTTP {
    constructor() {
        this.apiKey = process.env.AISSTREAM_API_KEY;
        this.activeMmsis = new Set();
        this.lastRefresh = null;
        this.messageCount = 0;
        this.startTime = new Date();
        this.pollingInterval = null;
        this.updateInterval = 5 * 60 * 1000; // 5 minutes
    }

    async start() {
        console.log('[TrackingServiceHTTP] Starting HTTP polling service...');

        // Initial refresh
        await this.refreshMmsis();

        // Periodic MMSI refresh (every 15 minutes)
        setInterval(() => this.refreshMmsis(), 15 * 60 * 1000);

        // Start polling for positions
        this.startPolling();
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
            console.log(`[TrackingServiceHTTP] Tracking ${this.activeMmsis.size} vessels: ${Array.from(this.activeMmsis).join(', ')}`);
        } catch (error) {
            console.error('[TrackingServiceHTTP] Error refreshing MMSIs:', error);
        }
    }

    startPolling() {
        // Poll immediately
        this.pollAllVessels();

        // Then poll every 5 minutes
        this.pollingInterval = setInterval(() => {
            this.pollAllVessels();
        }, this.updateInterval);

        console.log(`[TrackingServiceHTTP] Polling every ${this.updateInterval / 60000} minutes`);
    }

    async pollAllVessels() {
        if (this.activeMmsis.size === 0) {
            console.log('[TrackingServiceHTTP] No vessels to track');
            return;
        }

        console.log(`[TrackingServiceHTTP] Polling ${this.activeMmsis.size} vessels...`);

        for (const mmsi of this.activeMmsis) {
            try {
                await this.fetchVesselPosition(mmsi);
                // Small delay between requests to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error(`[TrackingServiceHTTP] Error fetching vessel ${mmsi}:`, error.message);
            }
        }
    }

    async fetchVesselPosition(mmsi) {
        try {
            // Using VesselFinder API (free tier allows limited requests)
            const url = `https://www.vesselfinder.com/api/pub/vesseltrack?mmsi=${mmsi}`;

            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.data && response.data.length > 0) {
                const vesselData = response.data[0];
                this.messageCount++;
                await this.updateVesselPosition(mmsi, vesselData);
                console.log(`[TrackingServiceHTTP] Updated vessel ${mmsi} - Lat: ${vesselData.LAT}, Lng: ${vesselData.LON}`);
            }
        } catch (error) {
            // If VesselFinder fails, try alternative: AISHub
            try {
                const altUrl = `http://data.aishub.net/ws.php?username=AH_DEMO&format=1&output=json&compress=0&mmsi=${mmsi}`;
                const altResponse = await axios.get(altUrl, { timeout: 10000 });

                if (altResponse.data && altResponse.data[0] && altResponse.data[0].POSITION) {
                    const pos = altResponse.data[0].POSITION;
                    this.messageCount++;
                    await this.updateVesselPosition(mmsi, {
                        LAT: pos.LATITUDE,
                        LON: pos.LONGITUDE,
                        SPEED: pos.SOG,
                        COURSE: pos.COG,
                        SHIPNAME: altResponse.data[0].NAME,
                        DESTINATION: altResponse.data[0].DESTINATION
                    });
                    console.log(`[TrackingServiceHTTP] Updated vessel ${mmsi} via AISHub`);
                }
            } catch (altError) {
                throw new Error(`Both APIs failed for ${mmsi}`);
            }
        }
    }

    async updateVesselPosition(mmsi, data) {
        try {
            const { Shipment } = require('../models');
            const { sequelize } = require('../config/database');

            const updateData = {
                currentLat: parseFloat(data.LAT || data.LATITUDE),
                currentLng: parseFloat(data.LON || data.LONGITUDE),
                lastUpdate: new Date(),
                shipStatus: data.SHIPNAME || data.NAME || 'En route'
            };

            if (data.SPEED !== undefined) updateData.speed = parseFloat(data.SPEED);
            if (data.COURSE !== undefined) updateData.course = parseInt(data.COURSE);
            if (data.DESTINATION && data.DESTINATION !== '@@@@@@@@@@@@@@@@@@@@') {
                updateData.destination = data.DESTINATION.trim();
            }

            await Shipment.update(updateData, {
                where: sequelize.where(sequelize.fn('TRIM', sequelize.col('mmsi')), mmsi)
            });
        } catch (error) {
            console.error('[TrackingServiceHTTP] Database update error:', error);
        }
    }

    getStatus() {
        return {
            connected: this.pollingInterval !== null,
            trackingCount: this.activeMmsis.size,
            activeMmsis: Array.from(this.activeMmsis),
            lastRefresh: this.lastRefresh,
            totalMessagesReceived: this.messageCount,
            uptimeMinutes: Math.floor((new Date() - this.startTime) / 60000),
            mode: 'HTTP_POLLING',
            updateIntervalMinutes: this.updateInterval / 60000
        };
    }

    async injectFakeSignal(mmsi, lat, lng) {
        await this.updateVesselPosition(mmsi, {
            LAT: lat,
            LON: lng,
            SPEED: 12.5,
            COURSE: 180,
            SHIPNAME: 'TEST SIGNAL'
        });
        return true;
    }
}

module.exports = new TrackingServiceHTTP();
