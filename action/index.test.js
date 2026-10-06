const test=require('node:test');
const assert=require('node:assert/strict');
const {repositorySetupUrl,proofArtifacts,developerBadgeMarkdown,normalizedTag}=require('./index.js');

test('repository setup URL pre-fills only valid GitHub repositories',()=>{
  assert.equal(
    repositorySetupUrl('owner/my-app'),
    'https://apkdrop.rawinstinctai.de/?repo=https%3A%2F%2Fgithub.com%2Fowner%2Fmy-app&src=github-action-setup'
  );
  assert.equal(repositorySetupUrl('../../bad'),'https://rawinstinctai.de/go/action-try');
});

test('proof artifacts create a live README badge and public update API',()=>{
  const queued={
    slug:'my-app',
    showcaseUrl:'https://apkdrop.rawinstinctai.de/my-app',
    latestUrl:'https://apkdrop.rawinstinctai.de/api/my-app/latest.json'
  };
  const latest={
    showcaseUrl:queued.showcaseUrl,
    app:{appName:'My App'}
  };
  const proof=proofArtifacts(latest,queued);
  assert.equal(proof.badgeUrl,'https://apkdrop.rawinstinctai.de/api/my-app/badge.svg?type=verified');
  assert.equal(proof.proofUrl,'https://apkdrop.rawinstinctai.de/my-app?src=badge#proof-details');
  assert.equal(proof.latestJsonUrl,queued.latestUrl);
  assert.equal(
    proof.badgeMarkdown,
    '[![My App on APKDrop](https://apkdrop.rawinstinctai.de/api/my-app/badge.svg?type=verified)](https://apkdrop.rawinstinctai.de/my-app?src=badge#proof-details)'
  );
});

test('tag normalization accepts conventional v-prefixed releases',()=>{
  assert.equal(normalizedTag('v1.2.3'),'1.2.3');
  assert.equal(normalizedTag('refs/tags/v2.0.0'),'2.0.0');
});


test('developer badge is optional and points through RawInstinctAI acquisition routing',()=>{
  assert.equal(
    developerBadgeMarkdown(),
    '[![Ship Android APKs with APKDrop](https://rawinstinctai.de/badge/github-action.svg)](https://rawinstinctai.de/go/developer-badge)'
  );
});
