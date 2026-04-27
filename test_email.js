require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const mailOptions = {
    from: `"TEST TIBOU AUTO" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: 'BAIB.IMED@GMAIL.COM', // Sending to yourself
    subject: 'Test Email Automation',
    text: 'Ceci est un test pour vérifier la configuration SMTP.'
};

console.log('Tentative d\'envoi d\'email de test...');
console.log('Host:', process.env.SMTP_HOST);
console.log('User:', process.env.SMTP_USER);

transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        console.error('Erreur lors de l\'envoi:', error);
    } else {
        console.log('Email envoyé avec succès !');
        console.log('Message ID:', info.messageId);
    }
});
