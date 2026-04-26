const nodemailer = require('nodemailer');

const mailService = {
    /**
     * Create a transporter using SMTP
     */
    getTransporter: () => {
        // Use SMTP settings from environment variables
        // For Brevo/Sendinblue: SMTP_HOST=smtp-relay.brevo.com, SMTP_PORT=587
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    },

    /**
     * Send an email to confirm a new order
     */
    sendOrderConfirmation: async (order, client, vehicle = null) => {
        try {
            if (!process.env.SMTP_USER || !client.email) {
                console.log('Email service not configured or client has no email');
                return false;
            }

            const transporter = mailService.getTransporter();
            const brand = vehicle ? vehicle.brand : (order.requestedBrand || '');
            const model = vehicle ? (vehicle.model || '') : (order.requestedModel || '');
            const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

            const mailOptions = {
                from: `"TIBOU AUTO" <${senderEmail}>`,
                to: client.email,
                subject: `Confirmation de votre commande #${order.id} - TIBOU AUTO`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                        <div style="background: #1e293b; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: #ffffff; margin: 0;">TIBOU AUTO</h1>
                        </div>
                        <div style="padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 10px 10px; background: #ffffff;">
                            <h2 style="color: #2563eb;">Bonjour ${client.firstName},</h2>
                            <p>Nous avons le plaisir de vous confirmer la validation de votre commande <strong>#${order.id}</strong>.</p>
                            
                            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                                <h3 style="margin-top: 0; font-size: 1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Récapitulatif du Véhicule</h3>
                                <p><strong>Modèle :</strong> ${brand} ${model}</p>
                                <p><strong>Prix Total :</strong> ${order.totalAmount.toLocaleString()} ${order.currency || 'EUR'}</p>
                                <p><strong>Statut :</strong> ${order.status}</p>
                            </div>

                            <p>Nos équipes s'occupent dès maintenant de la préparation et de l'expédition de votre véhicule. Vous recevrez des notifications automatiques à chaque étape clé de son acheminement.</p>
                            
                            <p style="margin-top: 30px;">Pour toute question, n'hésitez pas à nous contacter.</p>
                            <p>L'équipe TIBOU AUTO</p>
                        </div>
                        <div style="text-align: center; font-size: 0.8rem; color: #64748b; margin-top: 20px;">
                            Ceci est un message automatique, merci de ne pas y répondre directement.
                        </div>
                    </div>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log('Order confirmation email sent: ' + info.messageId);
            return true;
        } catch (error) {
            console.error('Error sending order confirmation email:', error);
            return false;
        }
    },

    /**
     * Send notification for shipment ETD (Departure)
     */
    sendShipmentDeparture: async (order, client, vehicle, shipment) => {
        try {
            if (!process.env.SMTP_USER || !client.email) return false;

            const transporter = mailService.getTransporter();
            const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;
            
            const mailOptions = {
                from: `"TIBOU AUTO" <${senderEmail}>`,
                to: client.email,
                subject: `Bonne nouvelle ! Votre véhicule est en mer - #${order.id}`,
                html: `
                    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #2563eb; padding: 20px; text-align: center;">
                            <h1 style="color: white; margin: 0;">TIBOU AUTO</h1>
                        </div>
                        <div style="padding: 20px; border: 1px solid #ddd;">
                            <h2>Votre véhicule est parti !</h2>
                            <p>Bonjour ${client.firstName},</p>
                            <p>Nous vous informons que votre véhicule <strong>${vehicle.brand} ${vehicle.model || ''}</strong> a été chargé sur le navire.</p>
                            <ul>
                                <li><strong>Date de départ (ETD) :</strong> ${new Date(shipment.etd).toLocaleDateString()}</li>
                                <li><strong>Date d'arrivée estimée (ETA) :</strong> ${new Date(shipment.eta).toLocaleDateString()}</li>
                                <li><strong>Port de chargement :</strong> ${shipment.loadingPort || 'N/A'}</li>
                            </ul>
                            <p>Vous pouvez suivre l'évolution du transport en direct sur votre espace client.</p>
                        </div>
                    </div>
                `
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending shipment departure email:', error);
            return false;
        }
    }
};

module.exports = mailService;
