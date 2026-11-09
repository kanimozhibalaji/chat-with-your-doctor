/**
 * Appointment Time & Calendar Utilities (Admin / Doctor-side)
 * Manages teleconsultation scheduled time window checks, countdowns, and calendar exports.
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
    const closeTime = new Date(startDate.getTime() + Math.max(durationMinutes + 30, 60) * 60 * 1000);

    return { startDate, endDate, openTime, closeTime };
};

export const formatDurationMs = (ms) => {
    if (ms <= 0) return '0m';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
};

export const checkAppointmentWindow = (slotDate, slotTime, isTestMode = false) => {
    const parsed = parseAppointmentDateTime(slotDate, slotTime);
    if (!parsed) {
        return {
            status: 'OPEN',
            isTestBypass: true,
            message: 'Time format unavailable — room unlocked'
        };
    }

    if (isTestMode) {
        return {
            status: 'OPEN',
            isTestBypass: true,
            message: 'Test mode active — scheduled time gate bypassed',
            ...parsed
        };
    }

    const now = new Date();

    if (now < parsed.openTime) {
        const remainingMs = parsed.openTime.getTime() - now.getTime();
        return {
            status: 'TOO_EARLY',
            remainingMs,
            formattedRemaining: formatDurationMs(remainingMs),
            message: `Consultation room opens 10 minutes prior to scheduled slot (${parsed.openTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).`,
            ...parsed
        };
    }

    if (now > parsed.closeTime) {
        return {
            status: 'EXPIRED',
            remainingMs: 0,
            formattedRemaining: '0m',
            message: `The scheduled consultation window closed at ${parsed.closeTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`,
            ...parsed
        };
    }

    return {
        status: 'OPEN',
        isTestBypass: false,
        message: 'Consultation room is open now',
        ...parsed
    };
};
