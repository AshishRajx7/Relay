const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ResumeParserService } = require('../dist/modules/resume/resume-parser.service');
const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://relay:relay_dev_password@127.0.0.1:5432/relay',
  });
  await client.connect();
  const res = await client.query('SELECT raw_text FROM resume_file WHERE id = \'bb6abcf6-920b-41e8-9f04-7e0232e5356c\'');
  const rawText = res.rows[0].raw_text;
  await client.end();

  // Create Nest app context to access AiProviderService and test
  const app = await NestFactory.createApplicationContext(AppModule);
  const parser = app.get(ResumeParserService);
  const aiProvider = parser.aiProviderService;

  console.log('Sending raw text to LLM directly...');
  // We can inspect what the LLM produces with the system prompt
  const result = await parser.parseWithAi(rawText);
  console.log('\n=== PARSER RESULT EXPERIENCE ===');
  for (const exp of result.experience) {
    console.log('\n---', exp.company, '|', exp.title, '---');
    console.log('whatWasBuilt:', exp.whatWasBuilt);
    console.log('scaleAndOwnership:', exp.scaleAndOwnership);
    console.log('measurableImpact:', exp.measurableImpact);
    console.log('technologies:', exp.technologies);
  }
  await app.close();
}

run().catch(console.error);
