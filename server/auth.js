require('dotenv').config();

// auth.js is a standalone script run with: npm run auth
// googleapis is an optional dependency; if not installed, this script won't work.
let google;
try { google = require('googleapis').google; } catch {
  console.error('googleapis package not installed. Run: npm install googleapis');
  process.exit(1);
}
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const TOKEN_PATH = path.join(__dirname, '.google-token.json');
const REDIRECT_PORT = 3001;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;

async function authenticate() {
    const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
    const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('❌ GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET .env dosyasında tanımlanmalı!');
        console.log('\n📝 Kurulum:');
        console.log('1. https://console.cloud.google.com/apis/credentials adresine gidin');
        console.log('2. "OAuth 2.0 Client IDs" oluşturun (Desktop app)');
        console.log('3. Client ID ve Secret\'ı .env dosyasına ekleyin');
        process.exit(1);
    }

    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

    // Check for existing token
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
        oauth2Client.setCredentials(token);

        // Check if token is expired
        if (token.expiry_date && token.expiry_date > Date.now()) {
            console.log('✅ Mevcut token geçerli!');
            return;
        }

        // Try to refresh
        try {
            const { credentials } = await oauth2Client.refreshAccessToken();
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials, null, 2));
            console.log('✅ Token yenilendi!');
            return;
        } catch (err) {
            console.log('⚠️ Token yenilenemiyor, yeniden giriş gerekiyor...');
        }
    }

    // Generate auth URL
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
    });

    console.log('\n🔐 Google Drive Yetkilendirmesi');
    console.log('================================\n');

    // Start local server to receive callback
    return new Promise((resolve, reject) => {
        const server = http.createServer(async (req, res) => {
            try {
                const url = new URL(req.url, `http://localhost:${REDIRECT_PORT}`);

                if (url.pathname === '/callback') {
                    const code = url.searchParams.get('code');

                    if (code) {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #f1f5f9;">
                  <div style="text-align: center;">
                    <h1>✅ Yetkilendirme Başarılı!</h1>
                    <p>Bu pencereyi kapatabilirsiniz.</p>
                  </div>
                </body>
              </html>
            `);

                        const { tokens } = await oauth2Client.getToken(code);
                        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));

                        console.log('\n✅ Google Drive yetkilendirmesi tamamlandı!');
                        console.log('📁 Token kaydedildi:', TOKEN_PATH);

                        server.close();
                        resolve();
                    } else {
                        res.writeHead(400);
                        res.end('Yetkilendirme kodu bulunamadı');
                        reject(new Error('No authorization code'));
                    }
                }
            } catch (err) {
                res.writeHead(500);
                res.end('Hata: ' + err.message);
                reject(err);
            }
        });

        server.listen(REDIRECT_PORT, () => {
            console.log('Tarayıcınızda aşağıdaki linki açın:\n');
            console.log('\x1b[36m%s\x1b[0m', authUrl);
            console.log('\n⏳ Yetkilendirme bekleniyor...\n');

            // Try to open browser automatically
            const { exec } = require('child_process');
            const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            exec(`${startCmd} "${authUrl}"`);
        });
    });
}

// Run if called directly
if (require.main === module) {
    authenticate()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('❌ Hata:', err.message);
            process.exit(1);
        });
}

module.exports = { authenticate, TOKEN_PATH };

