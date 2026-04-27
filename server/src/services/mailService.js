const nodemailer = require('nodemailer');
const path = require('path');

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
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                        <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                            <img src="cid:logo" alt="TIBOU AUTO" style="max-height: 80px; margin-bottom: 10px;">
                        </div>
                        <div style="padding: 40px 30px; background: #ffffff;">
                            <h2 style="color: #2563eb; font-size: 24px; margin-top: 0;">Bonjour ${client.firstName},</h2>
                            <p style="font-size: 16px;">Nous avons le plaisir de vous confirmer la validation de votre commande <strong>#${order.id}</strong>.</p>
                            
                            <div style="background: #f8fafc; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #e2e8f0;">
                                <h3 style="margin-top: 0; font-size: 1.1rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 15px; color: #1e293b;">Récapitulatif du Véhicule</h3>
                                <div style="margin-top: 15px;">
                                    <p style="margin: 8px 0;"><strong>Modèle :</strong> <span style="color: #2563eb;">${brand} ${model}</span></p>
                                    <p style="margin: 8px 0;"><strong>Prix Total :</strong> ${order.totalAmount.toLocaleString()} ${order.currency || 'EUR'}</p>
                                    <p style="margin: 8px 0;"><strong>Statut :</strong> <span style="display: inline-block; padding: 4px 12px; background: #dcfce7; color: #166534; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">${order.status}</span></p>
                                </div>
                            </div>

                            <p style="font-size: 16px;">Nos équipes s'occupent dès maintenant de la préparation et de l'expédition de votre véhicule. Vous recevrez des notifications automatiques à chaque étape clé de son acheminement.</p>
                            
                            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f1f5f9; text-align: center;">
                                <p style="font-size: 18px; color: #1e293b; margin-bottom: 5px;">L'équipe TIBOU AUTO</p>
                                <p style="font-size: 22px; color: #3b82f6; font-weight: bold; margin-top: 10px; font-family: 'Amiri', serif;" dir="rtl">نشكركم على ثقتكم</p>
                            </div>
                        </div>
                        <div style="text-align: center; font-size: 0.8rem; color: #94a3b8; padding: 20px;">
                            <p style="margin: 5px 0;">TIBOU AUTO - Votre partenaire automobile de confiance</p>
                            <p style="margin: 5px 0;">Ceci est un message automatique, merci de ne pas y répondre directement.</p>
                        </div>
                    </div>
                `,
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../../assets/logo.png'),
                    cid: 'logo'
                }]
            };
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
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                        <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                            <img src="cid:logo" alt="TIBOU AUTO" style="max-height: 80px; margin-bottom: 10px;">
                        </div>
                        <div style="padding: 40px 30px; background: #ffffff;">
                            <h2 style="color: #2563eb; font-size: 24px; margin-top: 0;">Votre véhicule est parti !</h2>
                            <p style="font-size: 16px;">Bonjour ${client.firstName},</p>
                            <p style="font-size: 16px;">Nous vous informons que votre véhicule <strong>${vehicle.brand} ${vehicle.model || ''}</strong> a été chargé sur le navire.</p>
                            
                            <div style="background: #f0f9ff; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #bae6fd;">
                                <ul style="list-style: none; padding: 0; margin: 0;">
                                    <li style="margin-bottom: 12px;"><strong>📅 Date de départ (ETD) :</strong> ${new Date(shipment.etd).toLocaleDateString()}</li>
                                    <li style="margin-bottom: 12px;"><strong>🚢 Date d'arrivée estimée (ETA) :</strong> ${new Date(shipment.eta).toLocaleDateString()}</li>
                                    <li style="margin-bottom: 0;"><strong>📍 Port de chargement :</strong> ${shipment.loadingPort || 'N/A'}</li>
                                </ul>
                            </div>
                            
                            <p style="font-size: 16px;">Vous pouvez suivre l'évolution du transport en direct sur votre espace client.</p>
                            
                            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f1f5f9; text-align: center;">
                                <p style="font-size: 18px; color: #1e293b; margin-bottom: 5px;">L'équipe TIBOU AUTO</p>
                                <p style="font-size: 22px; color: #3b82f6; font-weight: bold; margin-top: 10px; font-family: 'Amiri', serif;" dir="rtl">نشكركم على ثقتكم</p>
                            </div>
                        </div>
                    </div>
                `,
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../../assets/logo.png'),
                    cid: 'logo'
                }]
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending shipment departure email:', error);
            return false;
        }
    },

    /**
     * Send notification for vehicle arrival at port (ETA reached/Arrived status)
     */
    sendVehicleArrival: async (order, client, vehicle, shipment) => {
        try {
            if (!process.env.SMTP_USER || !client.email) return false;

            const transporter = mailService.getTransporter();
            const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

            const mailOptions = {
                from: `"TIBOU AUTO" <${senderEmail}>`,
                to: client.email,
                subject: `Votre véhicule est arrivé au port ! - #${order.id}`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                        <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                            <img src="cid:logo" alt="TIBOU AUTO" style="max-height: 80px; margin-bottom: 10px;">
                        </div>
                        <div style="padding: 40px 30px; background: #ffffff;">
                            <h2 style="color: #10b981; font-size: 24px; margin-top: 0;">Bonne nouvelle !</h2>
                            <p style="font-size: 16px;">Bonjour ${client.firstName},</p>
                            <p style="font-size: 16px;">Nous avons le plaisir de vous informer que votre véhicule <strong>${vehicle.brand} ${vehicle.model || ''}</strong> est arrivé au port de destination.</p>
                            
                            <div style="background: #ecfdf5; padding: 25px; border-radius: 12px; margin: 30px 0; border: 1px solid #a7f3d0;">
                                <p style="margin: 8px 0;"><strong>Statut :</strong> <span style="color: #059669; font-weight: 600;">Arrivé au port</span></p>
                                <p style="margin: 8px 0;"><strong>Port :</strong> ${shipment.destination || 'Destination'}</p>
                            </div>

                            <p style="font-size: 16px;">Nos équipes vont maintenant procéder aux formalités de dédouanement. Nous vous contacterons très prochainement pour organiser la livraison finale.</p>
                            
                            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f1f5f9; text-align: center;">
                                <p style="font-size: 18px; color: #1e293b; margin-bottom: 5px;">L'équipe TIBOU AUTO</p>
                                <p style="font-size: 22px; color: #3b82f6; font-weight: bold; margin-top: 10px; font-family: 'Amiri', serif;" dir="rtl">نشكركم على ثقتكم</p>
                            </div>
                        </div>
                    </div>
                `,
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../../assets/logo.png'),
                    cid: 'logo'
                }]
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending vehicle arrival email:', error);
            return false;
        }
    },

    /**
     * Send a quick test email to verify client email address
     */
    sendTestEmail: async (client) => {
        try {
            if (!process.env.SMTP_USER || !client.email) return false;

            const transporter = mailService.getTransporter();
            const senderEmail = process.env.SMTP_FROM || process.env.SMTP_USER;

            const mailOptions = {
                from: `"TIBOU AUTO" <${senderEmail}>`,
                to: client.email,
                subject: `Test de communication - TIBOU AUTO`,
                html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; line-height: 1.6;">
                        <div style="background: #ffffff; padding: 20px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                            <img src="cid:logo" alt="TIBOU AUTO" style="max-height: 80px; margin-bottom: 10px;">
                        </div>
                        <div style="padding: 40px 30px; background: #ffffff;">
                            <h2 style="color: #3b82f6; font-size: 24px; margin-top: 0;">Message de test</h2>
                            <p style="font-size: 16px;">Bonjour ${client.firstName},</p>
                            <p style="font-size: 16px;">Ce message est un email de test envoyé depuis le système TIBOU AUTO pour s'assurer que nous pouvons bien communiquer avec vous.</p>
                            
                            <div style="background: #eff6ff; padding: 20px; border-radius: 12px; margin: 30px 0; border: 1px solid #dbeafe; text-align: center;">
                                <p style="margin: 0; color: #1e40af; font-weight: 600; font-size: 16px;">✓ Votre adresse email est bien configurée.</p>
                            </div>

                            <p style="font-size: 16px;">Si vous avez reçu ce message, vous n'avez rien de plus à faire.</p>
                            
                            <div style="margin-top: 40px; padding-top: 30px; border-top: 1px solid #f1f5f9; text-align: center;">
                                <p style="font-size: 18px; color: #1e293b; margin-bottom: 5px;">L'équipe TIBOU AUTO</p>
                                <p style="font-size: 22px; color: #3b82f6; font-weight: bold; margin-top: 10px; font-family: 'Amiri', serif;" dir="rtl">نشكركم على ثقتكم</p>
                            </div>
                        </div>
                    </div>
                `,
                attachments: [{
                    filename: 'logo.png',
                    path: path.join(__dirname, '../../../assets/logo.png'),
                    cid: 'logo'
                }]
            };

            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Error sending test email:', error);
            return false;
        }
    }
};

module.exports = mailService;
