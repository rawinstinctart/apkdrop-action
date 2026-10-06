import fs from 'node:fs';

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

async function jsonFetch(url,options={}){
  const response=await fetch(url,options);
  let data=null;try{data=await response.json()}catch{}
  if(!response.ok)fail(data?.error||data?.message||`Request failed (${response.status})`);
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

  console.log(`APKDrop: synchronisiere ${process.env.GITHUB_REPOSITORY||'GitHub Repository'} …`);
  const queued=await jsonFetch(endpoint+'/api/automation/sync',{
    method:'POST',
    headers:{Authorization:`Bearer ${oidc}`,'Content-Type':'application/json','User-Agent':'APKDrop-GitHub-Action/1'},
    body:JSON.stringify(slug?{slug}:{})
  });
  setOutput('showcase-url',queued.showcaseUrl||'');
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
      setOutput('receipt-url',latest.receiptUrl||'');
      setOutput('status','ready');
      console.log(`APKDrop bereit: v${latest.version||'?'} · ${latest.showcaseUrl||queued.showcaseUrl}`);
      addSummary(`### APKDrop ✅\n\n- **Version:** ${latest.version||'—'}\n- **App:** [${queued.slug||'APKDrop'}](${latest.showcaseUrl||queued.showcaseUrl})\n- **APK:** [Download](${latest.downloadUrl||'#'})\n- **Release Receipt:** [Prüfnachweis](${latest.receiptUrl||'#'})\n- **SHA-256:** \`${latest.sha256||'—'}\``);
      return;
    }
    await sleep(3000);
  }
  fail('APKDrop Sync hat das Zeitlimit erreicht. Der Release wird im Hintergrund weiter verarbeitet.');
}

main().catch(error=>{
  setOutput('status','error');
  console.error('::error::'+String(error?.message||error));
  process.exitCode=1;
});
