const fs = require('fs');
let raw = fs.readFileSync('scratch/audit_output_utf8.json', 'utf8').replace(/^\uFEFF/, '');
const data = JSON.parse(raw);

const targetPhrases = [
  "I'd love to chat",
  "Let's connect",
  "Thought I'd reach out",
  "Happy to brainstorm",
  "Explore synergies",
  "I can help you",
  "Would love your thoughts",
  "love to chat",
  "let's chat",
  "quick chat",
  "open to a quick chat",
  "share implementation details",
  "share my approach",
  "thought leadership",
  "consulting"
];

console.log('=== V2 DRAFTS FORBIDDEN PHRASE AUDIT (9 REGENERATED DRAFTS) ===');
data.auditedDrafts.slice(0, 9).forEach((d, i) => {
  const text = (d.subject + ' ' + d.body).toLowerCase();
  const matched = targetPhrases.filter(p => text.includes(p.toLowerCase()));
  console.log(`Draft ${i+1} [${d.company} - ${d.email}]: ${matched.length === 0 ? 'CLEAN (0 forbidden phrases)' : 'FOUND: ' + matched.join(', ')}`);
});

console.log('\n=== PRE-V2 DRAFTS FORBIDDEN PHRASE AUDIT (OLDER DRAFTS) ===');
data.auditedDrafts.slice(9).forEach((d, i) => {
  const text = (d.subject + ' ' + d.body).toLowerCase();
  const matched = targetPhrases.filter(p => text.includes(p.toLowerCase()));
  console.log(`Old Draft ${i+1} [${d.company} - "${d.subject}"]: ${matched.length === 0 ? 'CLEAN' : 'VIOLATIONS DETECTED: ' + matched.join(', ')}`);
});
