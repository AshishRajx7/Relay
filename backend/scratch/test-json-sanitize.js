const badJson = `{
  "technicalVariant": {
    "subject": "Backend Engineer Application — Ashish Raj",
    "body": "I'm an ambitious early-career engineer with a strong background in building scalable systems, and I'm reaching out because I'm interested in backend engineer opportunities at Perennial Systems. I've been impressed by Perennial Systems' innovative approach to Product Engineering and Enterprise Solutions, particularly their work on Covoro and Enterprise GenAI, which aligns with my passion for developing cutting-edge digital solutions.

My experience as a Backend Developer Intern at Goklaim has given me a solid foundation in distributed systems, async queues, and rapid learning. I've worked with a range of technologies, including TypeScript, JavaScript, Python, SQL, and C++, and have a proven track record of delivering high-quality software. I'm excited about the opportunity to bring my skills and experience to a dynamic team like Perennial Systems and contribute to the development of innovative solutions.

I've attached my resume, which provides more details about my background and experience. I'd appreciate consideration for any backend engineer opportunities on your team and look forward to the opportunity to discuss my application."
  },
  "whyCompany": "Perennial Systems' innovative approach",
  "whyMe": "My experience as a Backend Developer Intern",
  "whyNow": "Perennial Systems is always looking for talented people",
  "confidenceLevel": "HIGH"
}`;

function sanitizeJson(raw) {
  // Replace unescaped newlines/returns/tabs inside string literals
  // Regex matches from opening quote to next unescaped quote across lines
  return raw.replace(/"([\s\S]*?)"(?=\s*[:,\]}])/g, (match, inner) => {
    const fixed = inner
      .replace(/\r\n/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\t/g, '\\t');
    return `"${fixed}"`;
  });
}

const cleaned = sanitizeJson(badJson);
try {
  const parsed = JSON.parse(cleaned);
  console.log('SUCCESSFULLY PARSED!');
  console.log('SUBJECT:', parsed.technicalVariant.subject);
  console.log('BODY LINES:', parsed.technicalVariant.body.split('\n').length);
} catch (e) {
  console.error('FAILED:', e.message);
}
