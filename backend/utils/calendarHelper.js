/**
 * Calendar Helper for VitalSync Telemedicine
 * - Parses appointment slot dates and times
 * - Computes video room open & expiration windows
 * - Generates RFC 5545 standard .ics calendar invite strings
 * - Generates 1-click Google Calendar web URLs
 */

export const parseAppointmentDateTime = (slotDate, slotTime, bufferBeforeMinutes = 10, durationMinutes = 30) => {
    if (!slotDate || !slotTime) return null;

    const parts = slotDate.includes('_') ? slotDate.split('_') : slotDate.split('/');
    if (parts.length < 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const year = parseInt(parts[2], 10);

    const match = slotTime.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridiem = match[3] ? match[3].toUpperCase() : null;

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    const startDate = new Date(year, month, day, hours, minutes, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const openTime = new Date(startDate.getTime() - bufferBeforeMinutes * 60 * 1000);
    // Consultation room stays open up to 60 minutes after start time
    const closeTime = new Date(startDate.getTime() + Math.max(durationMinutes + 30, 60) * 60 * 1000);

    return { startDate, endDate, openTime, closeTime };
};

export const formatICSDate = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return '';
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
};

/**
 * Checks if current time is within the allowed window to initiate or join video call.
 * Returns { status: 'OPEN' | 'TOO_EARLY' | 'EXPIRED', openTime, closeTime, message, remainingMs }
 */
export const checkAppointmentWindow = (slotDate, slotTime, isTestMode = false) => {
    const parsed = parseAppointmentDateTime(slotDate, slotTime);
    if (!parsed) {
        return { status: 'OPEN', isTestBypass: true, message: 'Time parsing unavailable' };
    }

    if (isTestMode) {
        return {
            status: 'OPEN',
            isTestBypass: true,
            message: 'Test mode enabled: video room open anytime',
            ...parsed
        };
    }

    const now = new Date();

    if (now < parsed.openTime) {
        const remainingMs = parsed.openTime.getTime() - now.getTime();
        return {
            status: 'TOO_EARLY',
            remainingMs,
            message: `Consultation room opens 10 minutes prior to scheduled slot (${parsed.openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
            ...parsed
        };
    }

    if (now > parsed.closeTime) {
        return {
            status: 'EXPIRED',
            remainingMs: 0,
            message: `The scheduled consultation window closed at ${parsed.closeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            ...parsed
        };
    }

    return {
        status: 'OPEN',
        isTestBypass: false,
        message: 'Consultation room is now open',
        ...parsed
    };
};

/**
 * Generates an RFC 5545 compliant iCalendar string (.ics)
 */
export const generateICS = ({
    appointmentId,
    doctorName,
    doctorSpeciality,
    patientName,
    patientEmail,
    slotDate,
    slotTime,
    amount,
    videoUrl,
    organizerEmail
}) => {
    const parsed = parseAppointmentDateTime(slotDate, slotTime);
    if (!parsed) return '';

    const orgEmail = organizerEmail || process.env.SMTP_USER || 'appointments@vitalsync.com';
    const isSelfInvite = orgEmail.toLowerCase() === (patientEmail || '').toLowerCase();
    const organizerLine = isSelfInvite
        ? `ORGANIZER;CN="VitalSync Telemedicine";SENT-BY="mailto:${orgEmail}":mailto:appointments@vitalsync.com`
        : `ORGANIZER;CN="VitalSync Telemedicine":mailto:${orgEmail}`;
    const cleanDoc = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    const dtStamp = formatICSDate(new Date());
    const dtStart = formatICSDate(parsed.startDate);
    const dtEnd = formatICSDate(parsed.endDate);
    const uid = `${appointmentId || Date.now()}@vitalsync.com`;

    const summary = `VitalSync Video Teleconsultation: ${cleanDoc}`;
    const description = `100% Online Teleconsultation\\n\\nDoctor: ${cleanDoc} (${doctorSpeciality || 'General'})\\nPatient: ${patientName || 'Patient'}\\n\\nJoin Video Room: ${videoUrl}\\nConsultation Fee: ₹${amount || 0}\\n\\nSkip hospital queues - consult from home!`;

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//VitalSync//Telemedicine Consultation//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${videoUrl}`,
        `URL:${videoUrl}`,
        'STATUS:CONFIRMED',
        'SEQUENCE:0',
        organizerLine,
        `ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN="${patientName || 'Patient'}":mailto:${patientEmail || 'patient@example.com'}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: Teleconsultation with ${cleanDoc} starts in 15 minutes`,
        'END:VALARM',
        'BEGIN:VALARM',
        'TRIGGER:-PT10M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Your VitalSync video room is now open. Tap to enter early.',
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');
};

/**
 * 1-Click Direct Google Calendar link
 */
export const generateGoogleCalendarUrl = ({
    appointmentId,
    doctorName,
    doctorSpeciality,
    slotDate,
    slotTime,
    videoUrl
}) => {
    const parsed = parseAppointmentDateTime(slotDate, slotTime);
    if (!parsed) return '';

    const cleanDoc = doctorName.startsWith('Dr.') ? doctorName : `Dr. ${doctorName}`;
    const title = `Online Video Consultation: ${cleanDoc}`;
    const dtStart = formatICSDate(parsed.startDate);
    const dtEnd = formatICSDate(parsed.endDate);
    const details = `100% Online Teleconsultation with ${cleanDoc} (${doctorSpeciality || 'Specialist'})\n\nJoin Video Consultation: ${videoUrl}\n\nSkip crowded hospital queues — consult privately from home with HD video, chat, and verified digital prescriptions.`;

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${dtStart}/${dtEnd}`,
        details,
        location: videoUrl
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
