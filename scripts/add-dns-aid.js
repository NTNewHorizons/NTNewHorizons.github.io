/**
 * DNS-AID (DNS for AI Discovery) — helper script
 *
 * This script prints the DNS records you need to publish in your
 * authoritative DNS zone to support agent discovery via DNS-AID
 * (draft-mozleywilliams-dnsop-dnsaid).
 *
 * REQUIREMENTS:
 *   - DNSSEC signing on the zone
 *   - Access to your DNS provider's SVCB/HTTPS record support
 *
 * USAGE:
 *   node scripts/add-dns-aid.js
 *
 * Then add the printed records to your DNS zone.
 */

const DOMAIN = 'ntnewhorizons.com';

const records = [
  // SVCB/HTTPS record advertising the A2A (Agent-to-Agent) endpoint
  {
    name: `_a2a._agents.${DOMAIN}`,
    type: 'HTTPS',
    params: {
      alpn: 'http/1.1',
      endpoint: `https://${DOMAIN}/.well-known/agent-endpoint`
    },
    description: 'Agent-to-Agent communication endpoint'
  },

  // SVCB/HTTPS record for the agent index (discovery entry point)
  {
    name: `_index._agents.${DOMAIN}`,
    type: 'HTTPS',
    params: {
      alpn: 'http/1.1',
      endpoint: `https://${DOMAIN}/.well-known/agent-skills/index.json`
    },
    description: 'Agent skills discovery index'
  },
];

console.log('=== DNS-AID Records for', DOMAIN, '===\n');
console.log('Add the following records to your authoritative DNS zone:\n');

for (const r of records) {
  console.log(`--- ${r.description} ---`);
  console.log(`Name:  ${r.name}`);
  console.log(`Type:  ${r.type}`);
  console.log(`Value: alpn="${r.params.alpn}" endpoint="${r.params.endpoint}"`);
  console.log();
}

console.log('=== DNSSEC ===\n');
console.log(`Ensure the ${DOMAIN} zone is signed with DNSSEC so that`);
console.log('validating resolvers receive authenticated data (AD flag).\n');

console.log('=== Verification ===\n');
console.log('After publishing, verify with:');
console.log(`  dig +short ${records[0].name} HTTPS`);
console.log(`  dig +short ${records[1].name} HTTPS`);
console.log(`  delv ${records[0].name} HTTPS`);
console.log();
