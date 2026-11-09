import nodemailer from 'nodemailer';
import { generateICS, generateGoogleCalendarUrl, parseAppointmentDateTime } from './calendarHelper.js';

// Create reusable transporter
// Supports real SMTP (Gmail, SendGrid, Brevo, AWS SES) or Ethereal sandbox fallback
let transporter = null;

const getFromAddress = (name = 'VitalSync Telemedicine') => {
    if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
    if (process.env.SMTP_USER) return `"${name}" <${process.env.SMTP_USER}>`;
    return `"${name}" <appointments@vitalsync.com>`;
};

const getTransporter = async () => {
    if (transporter) return transporter;

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpHost = process.env.SMTP_HOST;
    const smtpService = process.env.SMTP_SERVICE;

    if (smtpService === 'gmail' || (!smtpHost && smtpUser && smtpUser.endsWith('@gmail.com') && smtpPass)) {
        // Direct Gmail SMTP service (requires Gmail App Password)
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        console.log(`📧 Connected to Gmail SMTP via ${smtpUser}`);
    } else if (smtpHost && smtpUser && smtpPass) {
        // Custom SMTP (Brevo, SendGrid, Mailgun, Amazon SES, Postmark, etc.)
        const port = parseInt(process.env.SMTP_PORT || '587');
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port,
            secure: process.env.SMTP_SECURE === 'true' || port === 465,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        console.log(`📧 Connected to custom SMTP host: ${smtpHost}:${port}`);
    } else {
        // Dev Fallback: Ethereal sandbox fake SMTP
        // Emails are captured by Ethereal and NOT sent to real user inboxes
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log(`📧 VitalSync dev email sandbox initialized (Ethereal test account: ${testAccount.user})`);
        console.log(`⚠️ NOTE: Emails sent in sandbox mode do NOT deliver to real Gmail/Outlook mailboxes. To receive real emails with auto calendar sync, add SMTP_USER and SMTP_PASS in backend/.env`);
    }

    return transporter;
};

const getFrontendBaseUrl = () => {
    return process.env.FRONTEND_URL || 'http://localhost:5173';
};

/**
 * Send appointment confirmation email with native iCalendar (.ics) invite & Google Calendar link
 */
const sendAppointmentConfirmation = async (paramsOrEmail, patientName, doctorName, slotDate, slotTime, options = {}) => {
    try {
        let opts = {};
        if (typeof paramsOrEmail === 'object' && paramsOrEmail !== null) {
            opts = paramsOrEmail;
        } else {
            opts = {
                patientEmail: paramsOrEmail,
                patientName,
                doctorName,
                slotDate,
                slotTime,
                ...options
            };
        }

        const {
            patientEmail,
            patientName: pName = 'Patient',
            doctorName: dName = 'Doctor',
            doctorSpeciality = 'Specialist',
            slotDate: sDate = '',
            slotTime: sTime = '',
            appointmentId = '',
            amount = 0
        } = opts;

        if (!patientEmail) return false;

        const frontendUrl = getFrontendBaseUrl();
        const videoUrl = appointmentId ? `${frontendUrl}/video-call/${appointmentId}` : `${frontendUrl}/my-appointments`;
        const cleanDoc = dName.startsWith('Dr.') ? dName : `Dr. ${dName}`;
        const formattedDate = sDate.replace(/_/g, '/');

        // Generate RFC 5545 iCalendar data
        const icsContent = generateICS({
            appointmentId,
            doctorName: cleanDoc,
            doctorSpeciality,
            patientName: pName,
            patientEmail,
            slotDate: sDate,
            slotTime: sTime,
            amount,
            videoUrl,
            organizerEmail: process.env.SMTP_USER || 'appointments@vitalsync.com'
        });

        // 1-Click Google Calendar creation URL
        const googleCalendarUrl = generateGoogleCalendarUrl({
            appointmentId,
            doctorName: cleanDoc,
            doctorSpeciality,
            slotDate: sDate,
            slotTime: sTime,
            videoUrl
        });

        // Schema.org EventReservation JSON-LD for Google "Events from Gmail" automatic calendar parsing
        const parsedTime = parseAppointmentDateTime(sDate, sTime);
        const isoStart = parsedTime ? parsedTime.startDate.toISOString() : '';
        const isoEnd = parsedTime ? parsedTime.endDate.toISOString() : '';
        const jsonLd = {
            "@context": "http://schema.org",
            "@type": "EventReservation",
            "reservationNumber": String(appointmentId || Date.now()),
            "reservationStatus": "http://schema.org/Confirmed",
            "underName": {
                "@type": "Person",
                "name": pName
            },
            "reservationFor": {
                "@type": "Event",
                "name": `Teleconsultation: ${cleanDoc}`,
                "startDate": isoStart,
                "endDate": isoEnd,
                "location": {
                    "@type": "VirtualLocation",
                    "name": "VitalSync Video Room",
                    "url": videoUrl
                },
                "description": `100% Online Teleconsultation with ${cleanDoc} (${doctorSpeciality})`
            }
        };

        const transport = await getTransporter();

        const mailOptions = {
            from: getFromAddress('VitalSync Telemedicine'),
            to: patientEmail,
            subject: `🩺 Teleconsultation Confirmed: ${cleanDoc} (${formattedDate} at ${sTime})`,
            html: `
                <!-- Google Schema.org Event Structured Data for Automatic Calendar Sync -->
                <script type="application/ld+json">
                ${JSON.stringify(jsonLd)}
                </script>

                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #f8fafc; color: #1e293b;">
                    
                    <!-- Header Banner -->
                    <div style="background: linear-gradient(135deg, #0f172a 0%, #0284c7 100%); padding: 36px 30px; border-radius: 20px 20px 0 0; text-align: center; color: white;">
                        <div style="display: inline-block; padding: 6px 14px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 9999px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 12px;">
                            100% ONLINE TELEMEDICINE
                        </div>
                        <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">VitalSync</h1>
                        <p style="margin: 6px 0 0; color: #e0f2fe; font-size: 14px;">Skip Hospital Queues • Consult from Home</p>
                    </div>

                    <!-- Main Body Card -->
                    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 32px 30px; border-radius: 0 0 20px 20px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span style="display: inline-block; width: 10px; height: 10px; background-color: #10b981; border-radius: 50%;"></span>
                            <span style="font-size: 12px; font-weight: 700; color: #047857; text-transform: uppercase; letter-spacing: 0.5px;">Confirmed & Added to Calendar</span>
                        </div>

                        <h2 style="color: #0f172a; margin: 4px 0 16px; font-size: 20px; font-weight: 800;">
                            Your Teleconsultation is Confirmed!
                        </h2>

                        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
                            Hello <strong>${pName}</strong>, your online video consultation with <strong>${cleanDoc}</strong> is scheduled. An interactive calendar invitation has been attached to this email and synced with your inbox.
                        </p>

                        <!-- Consultation Details Box -->
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 20px; margin: 20px 0;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 600; width: 120px;">Specialist</td>
                                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${cleanDoc} <span style="color: #0284c7; font-weight: 600;">(${doctorSpeciality})</span></td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Date</td>
                                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${formattedDate}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Scheduled Time</td>
                                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">${sTime}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Mode</td>
                                    <td style="padding: 6px 0; color: #047857; font-weight: 700;">100% Online HD Video Call</td>
                                </tr>
                                ${amount ? `
                                <tr>
                                    <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Fee</td>
                                    <td style="padding: 6px 0; color: #0f172a; font-weight: 700;">₹${amount} (Paid Online)</td>
                                </tr>
                                ` : ''}
                            </table>
                        </div>

                        <!-- Action Buttons -->
                        <div style="margin: 28px 0 20px; text-align: center;">
                            <a href="${videoUrl}" style="display: block; background-color: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3); margin-bottom: 12px;">
                                📹 Enter Video Consultation Room
                            </a>
                            
                            ${googleCalendarUrl ? `
                            <a href="${googleCalendarUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; text-decoration: none; padding: 10px 20px; border-radius: 10px; font-weight: 600; font-size: 13px;">
                                📅 Add to Google Calendar
                            </a>
                            ` : ''}
                        </div>

                        <!-- Appointment Guidelines -->
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 24px 0 10px; font-size: 12px; color: #475569; line-height: 1.5;">
                            <strong style="color: #0f172a; display: block; margin-bottom: 6px;">How Teleconsultation Works:</strong>
                            <ul style="margin: 0; padding-left: 18px; space-y: 4px;">
                                <li>The encrypted video room unlocks <strong>10 minutes prior</strong> to your scheduled slot for camera/mic setup.</li>
                                <li>Connect from a well-lit and quiet room using headphones for maximum audio clarity.</li>
                                <li>Following your call, your doctor will issue a tamper-proof digital prescription directly to your account.</li>
                            </ul>
                        </div>

                        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
                        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
                            VitalSync Telemedicine Services • You can manage your appointments or reschedule slots at any time from your patient dashboard.
                        </p>
                    </div>
                </div>
            `,
            // Native iCalendar integration:
            // Send pure alternatives (text/calendar with method=REQUEST) so Gmail, Apple Mail, and Outlook
            // parse the event into the native Calendar card instead of forcing a downloadable file attachment
            ...(icsContent ? {
                alternatives: [
                    {
                        contentType: 'text/calendar; charset="utf-8"; method=REQUEST',
                        content: icsContent
                    }
                ]
            } : {})
        };

        const info = await transport.sendMail(mailOptions);
        console.log(`📧 Appointment confirmation email successfully delivered to: ${patientEmail} (MessageId: ${info.messageId})`);

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 VitalSync Confirmation Email preview: ${previewUrl}`);
        }
        return true;
    } catch (error) {
        console.error("❌ Email confirmation error:", error);
        return false;
    }
};

// Send appointment cancellation email
const sendCancellationEmail = async (patientEmail, patientName, doctorName, slotDate, slotTime) => {
    try {
        const transport = await getTransporter();
        const cleanDoc = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
        const formattedDate = slotDate.replace(/_/g, '/');

        const info = await transport.sendMail({
            from: getFromAddress('VitalSync Telemedicine'),
            to: patientEmail,
            subject: `❌ Teleconsultation Cancelled - ${cleanDoc}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">VitalSync</h1>
                        <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0;">Telemedicine Platform</p>
                    </div>
                    <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px;">
                        <h2 style="color: #1f2937; margin-top: 0;">Appointment Cancelled</h2>
                        <p style="color: #6b7280;">Hi <strong>${patientName}</strong>,</p>
                        <p style="color: #6b7280;">Your online consultation with <strong>${cleanDoc}</strong> scheduled for <strong>${formattedDate} at ${slotTime}</strong> has been cancelled.</p>
                        <p style="color: #6b7280;">You can browse other available specialists and book a new consultation anytime from your dashboard.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
                        <p style="color: #9ca3af; font-size: 12px; text-align: center;">VitalSync Telemedicine Services.</p>
                    </div>
                </div>
            `
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 Preview cancellation email: ${previewUrl}`);
        }
        return true;
    } catch (error) {
        console.log("Email send error:", error.message);
        return false;
    }
};

// Send prescription ready email
const sendPrescriptionEmail = async (patientEmail, patientName, doctorName) => {
    try {
        const transport = await getTransporter();
        const cleanDoc = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;

        const info = await transport.sendMail({
            from: getFromAddress('VitalSync Prescriptions'),
            to: patientEmail,
            subject: `📋 Digital Prescription Ready from ${cleanDoc}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center; color: white;">
                        <h1 style="color: white; margin: 0; font-size: 24px;">VitalSync</h1>
                    </div>
                    <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 12px 12px;">
                        <h2 style="color: #1f2937; margin-top: 0;">Prescription Ready 📋</h2>
                        <p style="color: #6b7280;">Hi <strong>${patientName}</strong>,</p>
                        <p style="color: #6b7280;"><strong>${cleanDoc}</strong> has issued a verified digital prescription following your teleconsultation.</p>
                        <p style="color: #6b7280;">You can view, verify the QR code, and download the official PDF from your VitalSync account.</p>
                        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;"/>
                        <p style="color: #9ca3af; font-size: 12px; text-align: center;">VitalSync Telemedicine Services.</p>
                    </div>
                </div>
            `
        });

        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
            console.log(`📧 Preview prescription email: ${previewUrl}`);
        }
        return true;
    } catch (error) {
        console.log("Email send error:", error.message);
        return false;
    }
};

export { getTransporter, sendAppointmentConfirmation, sendCancellationEmail, sendPrescriptionEmail };
