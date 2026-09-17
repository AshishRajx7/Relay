const http = require('http');

async function main() {
  const resumeId = 'bb6abcf6-920b-41e8-9f04-7e0232e5356c';

  console.log(`Triggering reparse for resume ID: ${resumeId}...`);
  const postRes = await fetch(`http://localhost:3000/api/v1/resumes/${resumeId}/reparse`, {
    method: 'POST',
  });
  const postJson = await postRes.json();
  console.log('Reparse trigger response:', postJson);

  console.log('Waiting for parsing to complete...');
  let attempts = 0;
  while (attempts < 180) {
    await new Promise((r) => setTimeout(r, 2000));
    attempts++;
    const getRes = await fetch(`http://localhost:3000/api/v1/resumes/${resumeId}`);
    const resume = await getRes.json();
    console.log(`[Attempt ${attempts}] Status: ${resume.status}`);
    if (resume.status === 'PARSED') {
      console.log('\nSUCCESS! Resume parsed successfully.');
      console.log('\n=== CANDIDATE PROFILE EXPERIENCE ===');
      console.log(JSON.stringify(resume.profile?.experience, null, 2));
      return resume;
    }
    if (resume.status === 'FAILED') {
      console.error('Parsing failed:', resume.parseError);
      process.exit(1);
    }
  }
  console.error('Timed out waiting for resume to parse');
  process.exit(1);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
