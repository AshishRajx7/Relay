require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { google } = require('googleapis');

async function main() {
  console.log('Connecting to Gmail API via OAuth credentials in .env...');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://developers.google.com/oauthplayground';
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!refreshToken) {
    console.error('Missing GOOGLE_REFRESH_TOKEN');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  // List drafts
  const listRes = await gmail.users.drafts.list({ userId: 'me', maxResults: 10 });
  const drafts = listRes.data.drafts || [];
  console.log(`Found ${drafts.length} drafts in Gmail.`);

  for (const d of drafts.slice(0, 5)) {
    const draftDetail = await gmail.users.drafts.get({ userId: 'me', id: d.id, format: 'full' });
    const headers = draftDetail.data.message?.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    const to = getHeader('To');
    const subject = getHeader('Subject');
    const contentType = getHeader('Content-Type');

    // Check parts for attachments
    const parts = draftDetail.data.message?.payload?.parts || [];
    const attachmentParts = parts.filter(p => p.filename && p.filename.length > 0);

    console.log('\n------------------------------------------------------------');
    console.log(`Draft ID:      ${d.id}`);
    console.log(`To:            ${to}`);
    console.log(`Subject:       ${subject}`);
    console.log(`Content-Type:  ${contentType}`);
    console.log(`Parts count:   ${parts.length}`);
    console.log(`Attachments:   ${attachmentParts.map(p => `${p.filename} (${p.mimeType}, ID: ${p.body?.attachmentId ? 'YES' : 'INLINE'})`).join(', ') || 'None'}`);
  }
}

main().catch(console.error);
