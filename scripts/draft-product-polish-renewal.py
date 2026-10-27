"""Create an explicitly unsigned, non-deployable renewal proposal from an audited snapshot."""
import argparse
import json
from pathlib import Path
from datetime import datetime, timedelta

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--audit', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
report = json.loads(args.audit.read_bytes())
catalog, updates, experts = report['catalog'], report['updates'], report['expertFeed']
assert catalog['verification'] == 'signature-verified' and catalog['integrity'] == 'verified'
assert updates['verification'] == 'signature-and-integrity-verified'
assert len(catalog['fingerprint']) == len(updates['fingerprint']) == 64
issued = datetime.fromisoformat(report['checkedAt'].replace('Z', '+00:00'))
window = dict(issuedAt=issued.isoformat(), expiresAt=(issued + timedelta(days=7)).isoformat())
floor = max(updates['revision'], experts.get('revision', 0))
def domain(value, revision):
    return dict(currentRevision=value['revision'], currentFingerprint=value['fingerprint'], publicKeyId=value['keyId'],
                minimumNextRevision=revision, proposedTimeBounds=window, retainExistingPublicKey=True)
draft = dict(schema=2, status='UNSIGNED-REVIEW-REQUIRED', signed=False, deployable=False, autoPublish=False,
             catalog=domain(catalog, catalog['revision'] + 1), legacyUpdates=domain(updates, floor + 1),
             expertProjection=domain(experts, floor + 1) if experts.get('state') == 'verified' else
                 dict(state='supported-legacy-fallback', createAutomatically=False),
             reviewedAt=report['checkedAt'], evidenceTrust=report.get('trustDomain', 'unobserved'),
             coverageGaps=report.get('coverage', {}).get('gaps', []),
             archivePolicy='Keep every immutable archive byte and hash; this proposal adds no product or signing authority.',
             nextStep='Review coverage gaps separately, then use the existing independent publication preview/confirm and separate signed-update process. This is not a feed and cannot be deployed.')
with args.output.open('x', encoding='utf8') as f: json.dump(draft, f, ensure_ascii=False, indent=2); f.write('\n')
print(json.dumps({'unsignedDraftCreated':True,'signed':False,'deployable':False,'published':False}))
