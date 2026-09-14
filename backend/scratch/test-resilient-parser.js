const raw = `Here is a job application email authored by candidate Ashish Raj:

**Technical Variant**

{
  "technicalVariant": {
    "subject": "Backend Engineer Application — Ashish Raj",
    "body": "Dear Akanksha Puri,\\n\\nI'm an B.Tech in Electronics & Computer Engineering at VIT Chennai currently working as a Backend Developer Intern at Goklaim, and I'm reaching out because I'm interested in backend engineer opportunities at SourceFuse.\\n\\nI've been following SourceFuse's work on ARC (IaC + API + UI/UX) and its applications in enterprise-scale product development. I'm impressed by the company's focus on leveraging accelerators like ARC to deliver faster timelines and production-grade outcomes for clients.\\n\\nIn my current role, I've gained experience building distributed systems and async queues using TypeScript, JavaScript, and Python. I've also worked on production-ready systems using NestJS, Node.js, Express, and FastAPI. My experience has taught me the importance of scalability, reliability, and maintainability in software systems.\\n\\nI've attached my resume, which provides more details about my background and experience. I'd appreciate consideration for any backend engineer opportunities on your team.\\n\\nThank you for your time, and I look forward to the opportunity to discuss my application.\\n\\nBest regards,\\nAshish Raj"
  }
}

**Startup Variant**

{
  "startupVariant": {
    "subject": "Backend Engineer | TypeScript, JavaScript, Python, SQL Experience",
    "body": "Dear Akanksha Puri,\\n\\nI'm an B.Tech in Electronics & Computer Engineering at VIT Chennai currently working as a Backend Developer Intern at Goklaim, and I'm reaching out because I'm interested in backend engineer opportunities at SourceFuse.\\n\\nI've been following SourceFuse's work on ARC (IaC + API + UI/UX) and its applications in enterprise-scale product development. I'm impressed by the company's focus on leveraging accelerators like ARC to deliver faster timelines and production-grade outcomes for clients.\\n\\nIn my current role, I've gained experience building distributed systems and async queues using TypeScript, JavaScript, and Python. I've also worked on production-ready systems using NestJS, Node.js, Express, and FastAPI. My experience has taught me the importance of scalability, reliability, and maintainability in software systems.\\n\\nI've attached my resume, which provides more details about my background and experience. I'd appreciate consideration for any backend engineer opportunities on your team.\\n\\nThank you for your time, and I look forward to the opportunity to discuss my application.\\n\\nBest regards,\\nAshish Raj"
  }
}

**Direct Variant**

{
  "directVariant": {
    "subject": "Interested in Backend Engineer Opportunities at SourceFuse",
    "body": "Dear Akanksha Puri,\\n\\nI'm an B.Tech in Electronics & Computer Engineering at VIT Chennai currently working as a Backend Developer Intern at Goklaim, and I'm reaching out because I'm interested in backend engineer opportunities at SourceFuse.\\n\\nI've been following SourceFuse's work on ARC (IaC + API + UI/UX) and its applications in enterprise-scale product development. I'm impressed by the company's focus on leveraging accelerators like ARC to deliver faster timelines and production-grade outcomes for clients.\\n\\nIn my current role, I've gained experience building distributed systems and async queues using TypeScript, JavaScript, and Python. I've also worked on production-ready systems using NestJS, Node.js, Express, and FastAPI. My experience has taught me the importance of scalability, reliability, and maintainability in software systems.\\n\\nI've attached my resume, which provides more details about my background and experience. I'd appreciate consideration for any backend engineer opportunities on your team.\\n\\nThank you for your time, and I look forward to the opportunity to discuss my application.\\n\\nBest regards,\\nAshish Raj"
  }
}

**Why Company, Why Me, Why Now**

* Why Company: I've been following SourceFuse's work on ARC (IaC + API + UI/UX) and its applications in enterprise-scale product development.
* Why Me: In my current role, I've gained experience building distributed systems and async queues using TypeScript, JavaScript, and Python.
* Why Now: I'm looking for a new challenge and opportunity to grow as a backend engineer.

**Confidence Level: HIGH**`;

function parseStructured(rawContent) {
  let content = rawContent.trim();
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    content = codeBlockMatch[1].trim();
  }

  try {
    return JSON.parse(content);
  } catch (e) {
    // 1. Try finding outermost { ... }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(content.substring(firstBrace, lastBrace + 1));
      } catch {}
    }

    // 2. Scan and merge individual JSON objects
    const merged = {};
    const objRegex = /\{[\s\S]*?\n\}/g;
    let match;
    while ((match = objRegex.exec(content)) !== null) {
      try {
        const obj = JSON.parse(match[0]);
        Object.assign(merged, obj);
      } catch {}
    }

    // Extract bullet points if missing
    if (!merged.whyCompany) {
      const m = content.match(/Why Company:\s*([^\n\r*]+)/i);
      if (m) merged.whyCompany = m[1].trim();
    }
    if (!merged.whyMe) {
      const m = content.match(/Why Me:\s*([^\n\r*]+)/i);
      if (m) merged.whyMe = m[1].trim();
    }
    if (!merged.whyNow) {
      const m = content.match(/Why Now:\s*([^\n\r*]+)/i);
      if (m) merged.whyNow = m[1].trim();
    }
    if (!merged.confidenceLevel) {
      const m = content.match(/Confidence Level:\s*([A-Z]+)/i);
      if (m) merged.confidenceLevel = m[1].trim();
    }

    if (Object.keys(merged).length > 0) {
      return merged;
    }
    throw e;
  }
}

const res = parseStructured(raw);
console.log('PARSED KEYS:', Object.keys(res));
console.log('TECHNICAL:', res.technicalVariant?.subject);
console.log('STARTUP:', res.startupVariant?.subject);
console.log('DIRECT:', res.directVariant?.subject);
console.log('WHY COMPANY:', res.whyCompany);
console.log('WHY ME:', res.whyMe);
console.log('WHY NOW:', res.whyNow);
