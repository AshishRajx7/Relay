const text = `d'rons founder and full stack lead co-founded and built a quick commerce platform end-to-end, integrating payments, order workflows, and delivery tracking while running it alongside coursework. onboarded 2 vendors onto the platform, built custom backend apis and order-management workflows integrated with a wordpress-based storefront, and owned live production debugging and order processing.`;
function matchesSkill(skill, text) {
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(^|[^a-zA-Z0-9])${escaped}([^a-zA-Z0-9]|$)`, 'i');
  return regex.test(text);
}

console.log('matches git:', matchesSkill('git', text));
console.log('matches c++:', matchesSkill('c++', text));
console.log('matches wordpress:', matchesSkill('wordpress', text));
console.log('matches api:', matchesSkill('api', text));
