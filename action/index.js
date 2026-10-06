const fs=require('node:fs');

const input=name=>String(process.env['INPUT_'+name.toUpperCase().replaceAll('-','_')]||'').trim();
const setOutput=(name,value)=>{
  const file=process.env.GITHUB_OUTPUT;
  if(file)fs.appendFileSync(file,`${name}<<APKDROP_EOF\n${String(value??'')}\nAPKDROP_EOF\n`);
};
const addSummary=text=>{
  const file=process.env.GITHUB_STEP_SUMMARY;
  if(file)fs.appendFileSync(file,text+'\n');
};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=message=>{throw new Error(message)};
class ApiError extends Error{
  constructor(message,status,data){super(message);this.name='ApiError';this.status=status;this.data=data||null;}
}
const repositorySetupUrl=(repository=String(process.env.GITHUB_REPOSITORY||'').trim())=>{
  repository=String(repository||'').trim();
  return repository&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)
    ? 'https://apkdrop.rawinstinctai.de/?repo='+encodeURIComponent('https://github.com/'+repository)
    : 'https://apkdrop.rawinstinctai.de/';
};
const proofArtifacts=(latest,queued={})=>{
  const showcaseUrl=String(latest?.showcaseUrl||queued.showcaseUrl||'');
  if(!showcaseUrl)return {badgeMarkdown:'',badgeUrl:'',proofUrl:'',latestJsonUrl:String(queued.latestUrl||'')};
  const url=new URL(showcaseUrl),slug=String(queued.slug||url.pathname.split('/').filter(Boolean)[0]||'').trim();
  const name=String(latest?.app?.appName||slug||'Android app').replace(/[\[\]]/g,'');
  const badgeUrl=slug?`${url.origin}/api/${encodeURIComponent(slug)}/badge.svg?type=verified`:'';
  const proofUrl=showcaseUrl+(showcaseUrl.includes('?')?'&':'?')+'src=badge#proof-details';
  const badgeMarkdown=badgeUrl?`[![${name} on APKDrop](${badgeUrl})](${proofUrl})`:'';
  return {badgeMarkdown,badgeUrl,proofUrl,latestJsonUrl:String(queued.latestUrl||'')};
};

async function jsonFetch(url,options={}){
  const response=await fetch(url,options);
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok)throw new ApiError(data?.error||data?.message||`Request failed (${response.status})`,response.status,data);
  return data;
}
function normalizedTag(value){return String(value||'').trim().replace(/^refs\/tags\//,'').replace(/^v(?=\d)/i,'');}
function expectedTag(){
  const explicit=input('release-tag');if(explicit)return explicit;
  const ref=String(process.env.GITHUB_REF||'');
  return ref.startsWith('refs/tags/')?ref.slice('refs/tags/'.length):'';
}
async function githubOidcToken(){
  const requestUrl=process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if(!requestUrl||!requestToken)fail('GitHub OIDC ist nicht verfügbar. Setze im Job permissions: id-token: write.');
  const url=new URL(requestUrl);url.searchParams.set('audience','apkdrop.rawinstinctai.de');
  const response=await fetch(url,{headers:{Authorization:`bearer ${requestToken}`,Accept:'application/json'}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.value)fail('GitHub konnte keinen OIDC-Token für APKDrop ausstellen.');
  console.log('::add-mask::'+data.value);
  return data.value;
}

async function main(){
  const endpoint=(input('endpoint')||'https://apkdrop.rawinstinctart.workers.dev').replace(/\/$/,'');
  const slug=input('app');
  const shouldWait=(input('wait')||'true').toLowerCase()!=='false';
  const timeout=Math.max(15,Math.min(900,Number(input('timeout-seconds')||180)||180))*1000;
  const oidc=await githubOidcToken();

  const repository=String(process.env.GITHUB_REPOSITORY||'GitHub Repository');
  console.log(`APKDrop: synchronisiere ${repository} …`);
  let queued;
  try{
    queued=await jsonFetch(endpoint+'/api/automation/sync',{
      method:'POST',
      headers:{Authorization:`Bearer ${oidc}`,'Content-Type':'application/json','User-Agent':'APKDrop-GitHub-Action/1'},
      body:JSON.stringify(slug?{slug}:{})
    });
  }catch(error){
    if(error instanceof ApiError&&error.status===404){
      const setupUrl=repositorySetupUrl();
      setOutput('setup-url',setupUrl);
      addSummary(`### APKDrop · einmalig einrichten\n\nFür **${repository}** gibt es noch keine veröffentlichte APKDrop-App.\n\n[APKDrop mit diesem Repository öffnen →](${setupUrl})\n\nDort siehst du zuerst die private Vorschau. Veröffentliche die App einmal und starte danach diesen fehlgeschlagenen GitHub-Job über **Re-run jobs** erneut. Dann wird auch der aktuelle Release übernommen; künftige Releases laufen automatisch.`);
      error.apkdropStatus='setup-required';
      error.message=`APKDrop ist für ${repository} noch nicht eingerichtet. Öffne einmal: ${setupUrl}`;
    }
    throw error;
  }
  setOutput('showcase-url',queued.showcaseUrl||'');
  setOutput('setup-url','');
  setOutput('status','queued');

  if(!shouldWait){
    addSummary(`### APKDrop\n\nSync gestartet: [${queued.slug||'App'}](${queued.showcaseUrl})`);
    return;
  }

  const wanted=normalizedTag(expectedTag());
  const deadline=Date.now()+timeout;
  let lastState='';
  while(Date.now()<deadline){
    const status=await jsonFetch(queued.statusUrl,{headers:{Accept:'application/json','User-Agent':'APKDrop-GitHub-Action/1'}});
    if(status.state!==lastState){console.log(`APKDrop status: ${status.state||'unknown'}${status.reason?` · ${status.reason}`:''}`);lastState=status.state||'';}
    if(status.state==='error')fail(status.message||'APKDrop konnte den Release nicht verarbeiten.');
    if(status.state==='waiting'&&['multiple_apks','identity_changed','inspection_failed','filter_no_match','size_limit'].includes(status.reason)){
      fail(status.message||`APKDrop wartet auf eine manuelle Entscheidung (${status.reason}).`);
    }
    if(status.state==='ready'){
      const latest=await jsonFetch(queued.latestUrl,{headers:{Accept:'application/json','User-Agent':'APKDrop-GitHub-Action/1'}});
      if(wanted&&normalizedTag(latest.version)!==wanted){await sleep(3000);continue;}
      setOutput('showcase-url',latest.showcaseUrl||queued.showcaseUrl||'');
      setOutput('download-url',latest.downloadUrl||'');
      setOutput('version',latest.version||'');
      setOutput('sha256',latest.sha256||'');
      const proof=proofArtifacts(latest,queued);
      setOutput('receipt-url',latest.receiptUrl||'');
      setOutput('badge-markdown',proof.badgeMarkdown);
      setOutput('latest-json-url',proof.latestJsonUrl);
      setOutput('status','ready');
      console.log(`APKDrop bereit: v${latest.version||'?'} · ${latest.showcaseUrl||queued.showcaseUrl}`);
      addSummary(`### APKDrop ✅\n\n- **Version:** ${latest.version||'—'}\n- **App:** [${queued.slug||'APKDrop'}](${latest.showcaseUrl||queued.showcaseUrl})\n- **APK:** [Download](${latest.downloadUrl||'#'})\n- **Release Receipt:** [Prüfnachweis](${latest.receiptUrl||'#'})\n- **Update API:** [latest.json](${proof.latestJsonUrl||'#'})\n- **SHA-256:** \`${latest.sha256||'—'}\`\n\n#### Live proof badge for your README\n\n\`\`\`md\n${proof.badgeMarkdown||'Badge unavailable'}\n\`\`\`\n\nThe badge stays current and opens APKDrop's factual proof details.\n\n[APKDrop GitHub Action](https://github.com/marketplace/actions/apkdrop-ship-android-apk)`);
      return;
    }
    await sleep(3000);
  }
  fail('APKDrop Sync hat das Zeitlimit erreicht. Der Release wird im Hintergrund weiter verarbeitet.');
}

if(require.main===module){
  main().catch(error=>{
    setOutput('status',error?.apkdropStatus||'error');
    console.error('::error::'+String(error?.message||error));
    process.exitCode=1;
  });
}

module.exports={repositorySetupUrl,proofArtifacts,normalizedTag};
