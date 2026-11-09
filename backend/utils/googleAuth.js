import { OAuth2Client } from 'google-auth-library';
import https from 'https';

// Lazily initialize client to support dynamic or runtime env vars
let googleClient = null;

const getOAuthClient = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClient && clientId) {
        googleClient = new OAuth2Client(clientId);
    }
    return googleClient;
};

/**
 * Fetch Google UserInfo given an OAuth2 access token
 */
const fetchUserInfoWithAccessToken = (accessToken) => {
    return new Promise((resolve, reject) => {
        const req = https.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'User-Agent': 'VitalSync-Health-Platform'
                }
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            const json = JSON.parse(data);
                            resolve(json);
                        } catch (err) {
                            reject(new Error('Failed to parse Google userinfo response'));
                        }
                    } else {
                        reject(new Error(`Google userinfo returned status ${res.statusCode}: ${data}`));
                    }
                });
            }
        );

        req.on('error', (err) => {
            reject(err);
        });

        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout connecting to Google userinfo'));
        });
    });
};

/**
 * Verifies a Google credential (either GIS ID token or OAuth access token)
 * Returns the verified user profile
 */
export const verifyGoogleCredential = async ({ credential, accessToken }) => {
    // 1. Dev / Test mode fallback support (STRICTLY disabled in production)
    const rawToken = credential || accessToken;
    if (typeof rawToken === 'string' && rawToken.startsWith('mock_google_token:')) {
        const isAllowedDevMock = process.env.NODE_ENV !== 'production' && String(process.env.ALLOW_DEV_MOCK_AUTH || '').toLowerCase() === 'true';
        if (!isAllowedDevMock) {
            throw new Error('Security Violation: Mock authentication tokens are disabled on this environment.');
        }

        try {
            const encoded = rawToken.replace('mock_google_token:', '');
            const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
            return {
                sub: decoded.sub || `mock-google-id-${Date.now()}`,
                email: (decoded.email || 'patient.google@vitalsync.local').toLowerCase(),
                name: decoded.name || 'Google Patient',
                picture: decoded.picture || 'https://res.cloudinary.com/demo/image/upload/v1/samples/people/smiling-man.jpg',
                given_name: decoded.given_name || 'Google',
                family_name: decoded.family_name || 'Patient',
                email_verified: true,
                isMock: true
            };
        } catch (e) {
            throw new Error('Malformed development mock token');
        }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;

    // 2. ID Token flow (standard Google Identity Services button & One Tap)
    if (credential) {
        if (!clientId) {
            throw new Error('GOOGLE_CLIENT_ID is not configured in backend/.env');
        }

        const client = getOAuthClient() || new OAuth2Client(clientId);
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: clientId
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error('Invalid Google credential payload');
        }

        if (!payload.email_verified) {
            throw new Error('Google email is not verified. Please verify your Google email address first.');
        }

        return {
            sub: payload.sub,
            email: payload.email.toLowerCase(),
            name: payload.name || `${payload.given_name || ''} ${payload.family_name || ''}`.trim() || 'Google User',
            picture: payload.picture || '',
            given_name: payload.given_name || '',
            family_name: payload.family_name || '',
            email_verified: true,
            isMock: false
        };
    }

    // 3. Access Token flow (Google popup / useGoogleLogin implicit flow)
    if (accessToken) {
        const userInfo = await fetchUserInfoWithAccessToken(accessToken);
        if (!userInfo || !userInfo.email) {
            throw new Error('Unable to retrieve profile from Google access token');
        }

        if (userInfo.email_verified === false) {
            throw new Error('Google email is not verified');
        }

        return {
            sub: userInfo.sub,
            email: userInfo.email.toLowerCase(),
            name: userInfo.name || `${userInfo.given_name || ''} ${userInfo.family_name || ''}`.trim() || 'Google User',
            picture: userInfo.picture || '',
            given_name: userInfo.given_name || '',
            family_name: userInfo.family_name || '',
            email_verified: true,
            isMock: false
        };
    }

    throw new Error('No Google credential or access token provided');
};
