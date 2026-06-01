/**
 * DNS-AID (DNS for AI Discovery) - helper script
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
  {
    name: `_index._agents.${DOMAIN}`,
    svcPriority: 1,
    target: DOMAIN,
    params: 'alpn="http/1.1" port=443',
    description: 'Agent skills discovery index'
  },
  {
    name: `_a2a._agents.${DOMAIN}`,
    svcPriority: 1,
    target: DOMAIN,
    params: 'alpn="a2a" port=443',
    description: 'A2A Agent Card endpoint'
  },
];

console.log('=== DNS-AID Records for', DOMAIN, '===\n');
console.log('Add the following SVCB/HTTPS records to your authoritative DNS zone:\n');

for (const r of records) {
  console.log(`--- ${r.description} ---`);
  console.log(`${r.name}. 3600 IN HTTPS ${r.svcPriority} ${r.target} ( ${r.params} )`);
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
