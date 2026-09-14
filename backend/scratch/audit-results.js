const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: 'relay',
  password: 'relay_dev_password',
  database: 'relay'
});

async function audit() {
  await client.connect();

  const allProspects = await client.query(`
    SELECT p.id, p.campaign_id, p.company_name, p.email, p.domain, p.contact_type, p.draft_status, p.research_status, p.failure_type
    FROM prospects p
    ORDER BY p.company_name ASC, p.email ASC
  `);

  const draftsRes = await client.query(`
    SELECT d.id, d.prospect_id, d.subject, d.body, d.status, d.gmail_draft_id, d.gmail_thread_id, d.created_at, d.updated_at,
           q.personalization_score, q.relevance_score, q.spam_risk_score, q.technical_alignment_score, q.confidence_score, q.requires_manual_review, q.flags,
           r.chosen_project, r.match_score, r.why_company, r.why_me, r.why_now, r.why_relevant
    FROM email_drafts d
    LEFT JOIN draft_quality q ON q.email_draft_id = d.id
    LEFT JOIN draft_reasoning r ON r.email_draft_id = d.id
    ORDER BY d.created_at DESC
  `);

  const forbiddenPhrases = [
    "I'd love to chat",
    "Let's connect",
    "Thought I'd reach out",
    "Happy to brainstorm",
    "Explore synergies",
    "I can help you",
    "Would love your thoughts",
    "love to discuss",
    "love to chat",
    "let's chat",
    "reach out"
  ];

  const auditedDrafts = draftsRes.rows.map(d => {
    const fullText = (d.subject + ' ' + d.body).toLowerCase();
    const matchedPhrases = forbiddenPhrases.filter(p => fullText.includes(p.toLowerCase()));
    const p = allProspects.rows.find(p => p.id === d.prospect_id);
    return {
      draftId: d.id,
      prospectId: d.prospect_id,
      email: p?.email,
      company: p?.company_name,
      contactType: p?.contact_type,
      subject: d.subject,
      body: d.body,
      gmailDraftId: d.gmail_draft_id,
      gmailThreadId: d.gmail_thread_id,
      scores: {
        personalization: d.personalization_score,
        relevance: d.relevance_score,
        spamRisk: d.spam_risk_score,
        technicalAlignment: d.technical_alignment_score,
        confidence: d.confidence_score
      },
      requiresManualReview: d.requires_manual_review,
      flags: d.flags,
      reasoning: {
        chosenProject: d.chosen_project,
        matchScore: d.match_score,
        whyCompany: d.why_company,
        whyMe: d.why_me
      },
      matchedForbidden: matchedPhrases
    };
  });

  const summary = {
    totalProspectsInDb: allProspects.rows.length,
    totalDraftsInDb: draftsRes.rows.length,
    allProspects: allProspects.rows,
    auditedDrafts
  };

  console.log(JSON.stringify(summary, null, 2));

  await client.end();
}

audit().catch(console.error);
