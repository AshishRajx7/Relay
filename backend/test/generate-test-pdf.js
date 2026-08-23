const fs = require('fs');
const path = require('path');

function generateValidPdf(outputPath) {
  // A clean, byte-exact standard PDF 1.4 document
  const content = `Alex Mercer
Email: alex.mercer@example.com | Phone: (555) 019-2834 | Location: San Francisco, CA
LinkedIn: https://linkedin.com/in/alexmercer | GitHub: https://github.com/alexmercer

SUMMARY
Staff Backend Engineer with 8+ years experience designing high-throughput distributed systems, microservices, and event-driven architectures using NestJS, TypeScript, PostgreSQL, and Redis.

TECHNICAL SKILLS
Languages: TypeScript, Python, Go, SQL
Frameworks: NestJS, Express, FastAPI, Next.js
Databases: PostgreSQL, Redis, MongoDB
Tools: Docker, Kubernetes, AWS, BullMQ, Git, Terraform
Other: Microservices, Event-Driven Architecture, Distributed Systems, CI/CD

EXPERIENCE
TechFlow Systems - Senior Backend Engineer (San Francisco, CA)
2021-03 to Present
- Architected event-driven microservices processing 10M+ daily transactions using NestJS and PostgreSQL.
- Implemented background job processing infrastructure with BullMQ and Redis, slashing queue latency by 45%.
- Led database optimization and partitioning strategy, improving query response times by 3x.
- Mentored a team of 6 engineers and drove engineering best practices.

CloudScale Inc - Software Engineer (Austin, TX)
2018-06 to 2021-02
- Built scalable REST APIs and services supporting 500k active users in TypeScript and PostgreSQL.
- Automated deployment workflows using GitHub Actions and AWS ECS.

EDUCATION
University of Texas at Austin
Bachelor of Science in Computer Science | 2014-08 to 2018-05 | GPA: 3.8

PROJECTS
Relay Outreach Engine (TypeScript, NestJS, PostgreSQL, BullMQ, OpenAI)
- Built high-performance cold outreach engine with automated AI research and email generation.
`;

  // Create PDF objects with accurate xref offsets
  let pdf = '';
  const offsets = [];

  function addObj(objStr) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += objStr + '\n';
  }

  pdf += '%PDF-1.4\n';

  // Obj 1: Catalog
  addObj('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj');

  // Obj 2: Pages
  addObj('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj');

  // Obj 3: Page
  addObj('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj');

  // Format text stream
  const lines = content.split('\n');
  let streamData = 'BT\n/F1 9 Tf\n12 TL\n50 740 Td\n';
  for (const line of lines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    streamData += `(${escaped}) '\n`;
  }
  streamData += 'ET';

  const streamLen = Buffer.byteLength(streamData, 'utf8');

  // Obj 4: Stream
  addObj(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamData}\nendstream\nendobj`);

  // Obj 5: Font
  addObj('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj');

  // Xref
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += 'xref\n';
  pdf += `0 ${offsets.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets) {
    pdf += String(offset).padStart(10, '0') + ' 00000 n \n';
  }

  // Trailer
  pdf += `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF\n`;

  fs.writeFileSync(outputPath, pdf, 'utf8');
  console.log(`Generated 100% valid PDF at: ${outputPath}`);
}

const targetPath = path.join(__dirname, 'test-resume.pdf');
generateValidPdf(targetPath);
