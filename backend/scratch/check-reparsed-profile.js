const { Client } = require('pg');
require('dotenv').config();

async function check() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();

  const profiles = await client.query('SELECT * FROM candidate_profile WHERE resume_file_id = \'bb6abcf6-920b-41e8-9f04-7e0232e5356c\'');
  console.log('\n================ CANDIDATE PROFILE EXPERIENCE ================');
  for (const exp of profiles.rows[0].experience) {
    console.log('\n--- ' + exp.company + ' | ' + exp.title + ' (' + exp.startDate + ' - ' + exp.endDate + ') ---');
    console.log('experienceType:', exp.experienceType);
    console.log('isFounder:', exp.isFounder);
    console.log('sourceBullets:\n', exp.sourceBullets);
    console.log('whatWasBuilt:\n', exp.whatWasBuilt);
    console.log('scaleAndOwnership:\n', exp.scaleAndOwnership);
    console.log('measurableImpact:\n', exp.measurableImpact);
    console.log('technologies:\n', exp.technologies);
  }

  await client.end();
}

check().catch(console.error);
