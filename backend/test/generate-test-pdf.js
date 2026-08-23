const fs = require('fs');
const path = require('path');

function generateValidPdf(outputPath) {
  const target = outputPath || path.join(__dirname, 'test-resume.pdf');
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

  const lines = content.split('\n');
  let streamData = 'BT\n/F1 9 Tf\n12 TL\n50 740 Td\n';
  for (const line of lines) {
    const escaped = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    streamData += `(${escaped}) '\n`;
  }
  streamData += 'ET';

  const streamBuffer = Buffer.from(streamData, 'ascii');
  const streamLen = streamBuffer.length;

  const header = Buffer.from('%PDF-1.4\n', 'ascii');
  const obj1 = Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n', 'ascii');
  const obj2 = Buffer.from('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n', 'ascii');
  const obj3 = Buffer.from('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n', 'ascii');
  const obj4Header = Buffer.from(`4 0 obj\n<< /Length ${streamLen} >>\nstream\n`, 'ascii');
  const obj4Footer = Buffer.from('\nendstream\nendobj\n', 'ascii');
  const obj5 = Buffer.from('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n', 'ascii');

  const offset1 = header.length;
  const offset2 = offset1 + obj1.length;
  const offset3 = offset2 + obj2.length;
  const offset4 = offset3 + obj3.length;
  const offset5 = offset4 + obj4Header.length + streamLen + obj4Footer.length;
  const xrefOffset = offset5 + obj5.length;

  const pad = (n) => String(n).padStart(10, '0');
  // Exact 20-byte entries: 10 digits + ' ' + 5 digits + ' ' + char + ' \n' = 20 bytes
  const xref = Buffer.from(
    `xref\n0 6\n0000000000 65535 f \r\n${pad(offset1)} 00000 n \r\n${pad(offset2)} 00000 n \r\n${pad(offset3)} 00000 n \r\n${pad(offset4)} 00000 n \r\n${pad(offset5)} 00000 n \r\n`,
    'ascii'
  );

  const trailer = Buffer.from(
    `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
    'ascii'
  );

  const totalBuffer = Buffer.concat([
    header,
    obj1,
    obj2,
    obj3,
    obj4Header,
    streamBuffer,
    obj4Footer,
    obj5,
    xref,
    trailer,
  ]);

  fs.writeFileSync(target, totalBuffer);
  return target;
}

module.exports = { generateValidPdf };

if (require.main === module) {
  generateValidPdf();
}
