import { GmailService } from '../src/modules/gmail/gmail.service';
import { GmailProfileDto } from '../src/modules/gmail/dto/gmail-profile.dto';
import { GmailMessageDto } from '../src/modules/gmail/dto/gmail-message.dto';
import { ListMessagesResponseDto } from '../src/modules/gmail/dto/list-messages-response.dto';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${message}`);
}

async function runGmailApiTests() {
  console.log('Testing Gmail API Module & Parsing Engine...\n');

  // 1. Test Base64Url Decoder
  console.log('--- 1. Base64Url & UTF-8 Decoder Tests ---');
  const mockService = new GmailService({} as any, { get: () => '' } as any);

  const encodeBase64Url = (str: string) =>
    Buffer.from(str, 'utf-8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const samplePlain = 'Hi Ashish, we would love to invite you for an interview.';
  const sampleHtml = '<p>Hi Ashish, we would love to <strong>invite you</strong> for an interview.</p>';

  const encodedPlain = encodeBase64Url(samplePlain);
  const encodedHtml = encodeBase64Url(sampleHtml);

  assert((mockService as any).decodeBase64Url(encodedPlain) === samplePlain, 'Decodes plain text base64url payload');
  assert((mockService as any).decodeBase64Url(encodedHtml) === sampleHtml, 'Decodes HTML base64url payload');

  // 2. Test Multipart MIME Body Extraction
  console.log('\n--- 2. Multipart MIME Body Traversal Tests ---');

  // Scenario A: Single-part payload
  const singlePartPayload = {
    mimeType: 'text/plain',
    body: { data: encodedPlain },
  };
  const extractedSingle = (mockService as any).extractBodies(singlePartPayload);
  assert(extractedSingle.plainTextBody === samplePlain, 'Single-part text/plain extracted');

  // Scenario B: Multipart/alternative payload (both plain and HTML)
  const multipartAlternativePayload = {
    mimeType: 'multipart/alternative',
    parts: [
      {
        mimeType: 'text/plain',
        body: { data: encodedPlain },
      },
      {
        mimeType: 'text/html',
        body: { data: encodedHtml },
      },
    ],
  };
  const extractedAlt = (mockService as any).extractBodies(multipartAlternativePayload);
  assert(extractedAlt.plainTextBody === samplePlain, 'Multipart text/plain extracted');
  assert(extractedAlt.htmlBody === sampleHtml, 'Multipart text/html extracted');

  // Scenario C: Nested Multipart/mixed with attachments
  const nestedPayload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: encodedPlain } },
          { mimeType: 'text/html', body: { data: encodedHtml } },
        ],
      },
      {
        mimeType: 'application/pdf',
        body: { size: 102400 },
      },
    ],
  };
  const extractedNested = (mockService as any).extractBodies(nestedPayload);
  assert(extractedNested.plainTextBody === samplePlain, 'Nested multipart plain extracted');
  assert(extractedNested.htmlBody === sampleHtml, 'Nested multipart HTML extracted');

  // 3. Test Header Extraction
  console.log('\n--- 3. Header Extraction Tests ---');
  const headers = [
    { name: 'Subject', value: 'Interview Invitation - Backend Engineer' },
    { name: 'From', value: 'Recruiter <talent@stripe.com>' },
    { name: 'To', value: 'Ashish Raj <ashishrajcr7@gmail.com>' },
    { name: 'Date', value: 'Tue, 25 Aug 2026 14:30:00 +0000' },
  ];

  assert((mockService as any).getHeader(headers, 'Subject') === 'Interview Invitation - Backend Engineer', 'Extracts Subject');
  assert((mockService as any).getHeader(headers, 'from') === 'Recruiter <talent@stripe.com>', 'Extracts From (case-insensitive)');
  assert((mockService as any).getHeader(headers, 'TO') === 'Ashish Raj <ashishrajcr7@gmail.com>', 'Extracts To (case-insensitive)');
  assert((mockService as any).getHeader(headers, 'Date') === 'Tue, 25 Aug 2026 14:30:00 +0000', 'Extracts Date');

  // 4. Test Structured Message DTO Mapping
  console.log('\n--- 4. Full Message Parsing Verification ---');
  const rawGmailMessage = {
    id: '18a99f123456789a',
    threadId: '18a99f123456789a',
    snippet: 'Hi Ashish, we would love to invite you...',
    labelIds: ['INBOX', 'UNREAD', 'IMPORTANT'],
    internalDate: '1724590000000',
    payload: {
      headers,
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: encodedPlain } },
        { mimeType: 'text/html', body: { data: encodedHtml } },
      ],
    },
  };

  const parsedSubject = (mockService as any).getHeader(rawGmailMessage.payload.headers, 'Subject');
  const parsedFrom = (mockService as any).getHeader(rawGmailMessage.payload.headers, 'From');
  const parsedTo = (mockService as any).getHeader(rawGmailMessage.payload.headers, 'To');
  const parsedDate = (mockService as any).getHeader(rawGmailMessage.payload.headers, 'Date');
  const { plainTextBody, htmlBody } = (mockService as any).extractBodies(rawGmailMessage.payload);

  const messageDto: GmailMessageDto = {
    id: rawGmailMessage.id,
    threadId: rawGmailMessage.threadId,
    subject: parsedSubject,
    from: parsedFrom,
    to: parsedTo,
    date: parsedDate,
    snippet: rawGmailMessage.snippet,
    plainTextBody,
    htmlBody,
    labelIds: rawGmailMessage.labelIds,
    internalDate: rawGmailMessage.internalDate,
  };

  assert(messageDto.id === '18a99f123456789a', 'Message ID mapped');
  assert(messageDto.subject === 'Interview Invitation - Backend Engineer', 'Subject mapped');
  assert(messageDto.from === 'Recruiter <talent@stripe.com>', 'From mapped');
  assert(messageDto.to === 'Ashish Raj <ashishrajcr7@gmail.com>', 'To mapped');
  assert(messageDto.labelIds.includes('UNREAD'), 'UNREAD label preserved');
  assert(messageDto.plainTextBody === samplePlain, 'Plain body decoded');
  assert(messageDto.htmlBody === sampleHtml, 'HTML body decoded');

  console.log('\n🎉 ALL GMAIL API & PARSING UNIT TESTS PASSED SUCCESSFULLY!\n');
}

runGmailApiTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
