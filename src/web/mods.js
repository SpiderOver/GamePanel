/* GamePanel mod UI, following a library/catalog/version workflow. */
(() => {
  const el = id => document.getElementById(id);
  const state = {profile:null, mode:'installed', context:{}, projects:[], pagination:{}, inventory:[], loading:false, busy:false, configured:false, searchSerial:0, dialogSerial:0, identifiedSignature:'', queue:Promise.resolve(), loadedAt:0};
  const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
  const text = (tag,value,cls) => {const n=document.createElement(tag);n.textContent=value??'';if(cls)n.className=cls;return n;};
  const button = (label,fn,cls='') => {const b=text('button',label,'mm-button '+cls);b.type='button';b.addEventListener('click',fn);return b;};
  const id = () => current?.profile?.id || null;
  const endpoint = profile => `/api/profile/${encodeURIComponent(profile)}/mods`;
  function still(profile) {return id()===profile && state.profile===profile;}
  function notice(value='',error=false) {el('mm-notice').textContent=value;el('mm-notice').classList.toggle('error',error);}
  function showDialog(title,eyebrow='MODS') {
    state.dialogSerial++;
    el('mm-dialog-title').textContent=title;el('mm-dialog-eyebrow').textContent=eyebrow;
    el('mm-dialog-body').replaceChildren();el('mm-dialog-status').textContent='';
    if(!el('mm-dialog').open)el('mm-dialog').showModal();
    return state.dialogSerial;
  }
  function closeDialog() {state.dialogSerial++;el('mm-dialog').close();}
  function dialogValid(serial,profile) {return serial===state.dialogSerial && still(profile) && el('mm-dialog').open;}
  function errorMessage(error) {return error.message || String(error);}
  async function waitJob(profile,job) {
    const started=Date.now();
    while(Date.now()-started<1250000) {
      const result=await api(`${endpoint(profile)}/jobs/${job}`);
      if(!result.running) {if(!result.ok)throw new Error(result.error||'The operation failed.');return result.result;}
      await delay(700);
    }
    throw new Error('The operation took longer than expected. Refresh the list to check the result.');
  }
  function run(profile,payload,url=null) {
    const task=state.queue.catch(()=>{}).then(async()=>{
      const started=await api(url||endpoint(profile),{method:'POST',body:JSON.stringify(payload)});
      return waitJob(profile,started.job_id);
    });
    state.queue=task.catch(()=>{});
    return task;
  }
  function ensureProfile(profile) {
    if(state.profile===profile)return;
    state.profile=profile;state.loading=false;state.inventory=[];state.projects=[];state.pagination={};state.context={};state.loadedAt=0;state.identifiedSignature='';state.searchSerial++;
    if(el('mm-dialog').open)closeDialog();
  }
  function icon(mod) {
    const url=mod.icon_url;
    if(url && /^(https:\/\/|\/static\/mod-icons\/[a-f0-9]+\.(png|jpg)$|data:image\/(png|jpeg);base64,)/.test(url)) {
      const img=document.createElement('img');img.src=url;img.className='mm-icon';img.alt='';img.loading='lazy';img.referrerPolicy='no-referrer';
      img.addEventListener('error',()=>img.replaceWith(text('span',(mod.display_name||mod.name||'M').slice(0,2).toUpperCase(),'mm-icon')),{once:true});return img;
    }
    return text('span',(mod.display_name||mod.name||'M').slice(0,2).toUpperCase(),'mm-icon');
  }
  function empty(title,description='') {
    const box=text('div','','mm-empty');box.append(text('strong',title),text('span',description));return box;
  }
  function render() {
    if(!el('profile-mods-list'))return;
    const list=el('profile-mods-list'),query=el('profile-mods-search').value.trim().toLowerCase();
    el('mm-installed-tab').classList.toggle('active',state.mode==='installed');el('mm-catalog-tab').classList.toggle('active',state.mode==='catalog');
    el('mm-installed-tab').setAttribute('aria-selected',String(state.mode==='installed'));el('mm-catalog-tab').setAttribute('aria-selected',String(state.mode==='catalog'));
    el('mm-local-filters').hidden=state.mode!=='installed';el('mm-sort').hidden=state.mode!=='catalog';
    el('profile-mods-search').placeholder=state.mode==='catalog'?'Search CurseForge mods…':'Search installed mods…';
    el('mm-environment').textContent=state.context.compatible_filter_ready?`Minecraft ${state.context.minecraft_version} · ${state.context.loader}`:'Compatibility not detected';
    el('mm-count').textContent=String(state.inventory.length);
    el('profile-mods-installed').textContent=String(state.inventory.filter(x=>!x.disabled).length);
    el('profile-mods-disabled').textContent=String(state.inventory.filter(x=>x.disabled).length);
    list.replaceChildren();
    if(state.loading){list.append(empty('Loading mods…',state.mode==='catalog'?'Querying the compatible catalog.':'Reading local file metadata.'));return;}
    const rows=state.mode==='catalog'?state.projects:state.inventory.filter(x=>(profileModsFilter!=='disabled'||x.disabled)&&(!query||[x.display_name,x.name,x.version].some(v=>String(v||'').toLowerCase().includes(query)))).sort((a,b)=>String(a.display_name||a.name).localeCompare(String(b.display_name||b.name),'en',{numeric:true}));
    if(!rows.length)list.append(empty(state.mode==='catalog'?'No catalog results':'No mods found',state.mode==='catalog'?(state.configured?'Try another name or sorting option.':'Configure a CurseForge Core API key to search and install mods.'):'Try another query or filter.'));
    const fragment=document.createDocumentFragment();
    for(const mod of rows) {
      const row=text('div','','mm-row'),copy=text('div','','mm-copy'),actions=text('div','','mm-row-actions');
      copy.append(text('strong',mod.display_name||mod.name));
      const meta=text('div','','mm-metadata');
      if(state.mode==='installed') {
        meta.append(text('span',mod.version||mod.cf_version||'Local version'),text('span',formatFileSize(mod.size)));
        if(mod.project_id)meta.append(text('span','CurseForge','mm-channel'));
        copy.append(meta,text('small',mod.name));
        const toggle=button(mod.disabled?'○ Disabled':'● Active',()=>toggleMod(mod),'mm-toggle'+(mod.disabled?' off':''));
        toggle.title=mod.disabled?'Enable mod':'Disable mod';toggle.setAttribute('aria-pressed',String(!mod.disabled));
        toggle.disabled=state.busy||!state.context.mutable;actions.append(toggle);
        const release=button('Change version',()=>versions(mod));release.disabled=state.busy||!mod.project_id||!state.configured||!state.context.compatible_filter_ready;
        release.title=!mod.project_id?'Connect CurseForge to identify this file.':'Select a compatible release';actions.append(release);
        const remove=button('✕',()=>removeMod(mod),'mm-danger');remove.title='Remove mod';remove.setAttribute('aria-label',`Remove ${mod.display_name||mod.name}`);remove.disabled=state.busy||!state.context.mutable;actions.append(remove);
      } else {
        copy.append(text('p',mod.summary));
        meta.append(text('span',mod.authors||'CurseForge'),text('span',`${new Intl.NumberFormat('en',{notation:'compact'}).format(mod.downloads||0)} downloads`));copy.append(meta);
        const installed=state.inventory.find(x=>x.project_id===mod.project_id);
        const add=button(installed?'View versions':'＋ Add',()=>versions(installed||mod));add.disabled=state.busy;actions.append(add);
      }
      row.append(icon(mod),copy,actions);fragment.append(row);
    }
    list.append(fragment);
    const page=state.pagination;
    el('mm-more').hidden=state.mode!=='catalog'||!(Number(page.index||0)+Number(page.resultCount||0)<Number(page.totalCount||0));
    const identified=state.inventory.filter(x=>x.project_id).length;
    el('mm-status').textContent=state.mode==='catalog'?`${rows.length} results · filtered by Minecraft version and loader`:`${rows.length} visible mods · ${identified} identified on CurseForge`;
  }
  function inventoryResult(profile,data) {
    if(!still(profile))return;
    state.inventory=data.entries||[];state.context=data.context||{};state.configured=!!data.api_configured;
    profileModsCache=state.inventory;profileModsProfileId=profile;profileModsLoadedAt=Date.now();state.loadedAt=Date.now();
    if(state.context.service_running)notice('The server is running. Stop it before installing, changing, enabling, or removing mods.');
    else if(data.restart_required)notice('Mod changes will apply on the next server start.');
    else if(!state.configured)notice('Local mod management is available. Connect CurseForge to search and change releases.');
    else notice();
    render();
  }
  async function identify(profile) {
    const signature=state.inventory.map(x=>x.name+':'+x.mtime).join('|');
    if(!state.configured||state.identifiedSignature===signature)return;
    state.identifiedSignature=signature;el('mm-status').textContent='Identifying installed mods on CurseForge…';
    try {const result=await run(profile,{action:'identify'});inventoryResult(profile,result);}
    catch(error){state.identifiedSignature='';if(still(profile)){notice(errorMessage(error),true);render();}}
  }
  loadProfileModsPage=async function(force=false) {
    const profile=id();if(!profile||profileGameKey(current?.profile||{})!=='minecraft')return;
    ensureProfile(profile);
    if(current?.machine!=='online'){el('profile-mods-list').replaceChildren(empty('Game host offline','Power on the host to manage mods.'));return;}
    if(state.busy||state.loading)return;
    if(!force&&Date.now()-state.loadedAt<60000){render();return;}
    state.loading=state.inventory.length===0;render();
    try {const data=await run(profile,{action:'list'});if(!still(profile))return;state.loading=false;inventoryResult(profile,data);if(state.mode==='catalog')await search(false);identify(profile);}
    catch(error){if(still(profile)){state.loading=false;notice(errorMessage(error),true);render();}}
    finally {if(still(profile))state.loading=false;}
  };
  renderProfileModsPage=render;
  async function search(append=false) {
    const profile=id();if(!profile)return;ensureProfile(profile);
    const serial=++state.searchSerial;
    if(!state.configured){render();return;}
    state.loading=!append;if(!append)state.projects=[];render();
    const page=state.pagination,index=append?Number(page.index||0)+Number(page.resultCount||0):0;
    try {
      const data=await run(profile,{action:'search',query:el('profile-mods-search').value,sort:el('mm-sort').value,index});
      if(!still(profile)||serial!==state.searchSerial||state.mode!=='catalog')return;
      state.projects=append?[...state.projects,...data.projects]:data.projects;state.pagination=data.pagination;state.context=data.context;
    }catch(error){if(still(profile)&&serial===state.searchSerial)notice(errorMessage(error),true);}
    finally{if(still(profile)&&serial===state.searchSerial){state.loading=false;render();}}
  }
  async function versions(mod) {
    const profile=id(),serial=showDialog(mod.display_name||mod.name,'COMPATIBLE RELEASES');
    const body=el('mm-dialog-body'),tools=text('div','','mm-dialog-tools'),label=text('span',`Minecraft ${state.context.minecraft_version} · ${state.context.loader}`),channel=document.createElement('select');
    channel.setAttribute('aria-label','Release channel');
    for(const [value,name] of [['release','Release'],['beta','Release + Beta'],['all','Release + Beta + Alpha']]){const option=text('option',name);option.value=value;channel.append(option);}
    const releases=text('div'),more=button('Load more releases',()=>load(true));more.hidden=true;
    tools.append(label,channel);body.append(tools,releases,more);
    if(mod.website&&/^https:\/\//.test(mod.website)){const a=text('a','Open project on CurseForge ↗');a.href=mod.website;a.target='_blank';a.rel='noopener noreferrer';body.append(a);}
    let page={},loading=false,localSerial=0;
    async function load(append=false) {
      if(loading)return;loading=true;channel.disabled=true;more.disabled=true;const requestSerial=++localSerial;
      if(!append)releases.replaceChildren(text('p','Searching compatible releases…'));
      try{
        const data=await run(profile,{action:'versions',project_id:mod.project_id,channel:channel.value,index:append?Number(page.index||0)+Number(page.resultCount||0):0});
        if(!dialogValid(serial,profile)||requestSerial!==localSerial)return;
        if(!append)releases.replaceChildren();page=data.pagination;
        if(!append&&!data.files.length)releases.append(text('p','No releases in this channel. Try including Beta or Alpha.'));
        for(const file of data.files){
          const row=text('div','','mm-release'),copy=text('div'),isCurrent=file.file_id===mod.file_id;
          copy.append(text('strong',file.version),text('small',`${file.channel} · ${file.date?new Date(file.date).toLocaleDateString('en-US'):''} · ${formatFileSize(file.size)}`));
          const choose=button(isCurrent?'Installed':mod.file_id?'Use this version':'Install',()=>installPlan(mod,file));choose.disabled=isCurrent||!state.context.mutable||state.busy;
          row.append(copy,choose);releases.append(row);
        }
        more.hidden=!(Number(page.index||0)+Number(page.resultCount||0)<Number(page.totalCount||0));
        if(!state.context.mutable)el('mm-dialog-status').textContent='Stop the server before changing mods.';
      }catch(error){if(dialogValid(serial,profile))el('mm-dialog-status').textContent=errorMessage(error);}
      finally{loading=false;channel.disabled=false;more.disabled=false;}
    }
    channel.addEventListener('change',()=>load());load();
  }
  async function installPlan(mod,file) {
    const profile=id(),serial=showDialog('Prepare installation','CHECKING DEPENDENCIES');
    const payload={action:'plan',project_id:mod.project_id,file_id:file.file_id,max_release_type:file.release_type};
    if(mod.file_id)payload.filename=mod.name;
    el('mm-dialog-body').append(text('p','Checking the selected mod and required dependencies…'));
    try{
      const plan=await run(profile,payload);if(!dialogValid(serial,profile))return;
      el('mm-dialog-eyebrow').textContent='INSTALLATION';el('mm-dialog-body').replaceChildren(text('p',plan.replace?'The previous version will be preserved in a backup.':'The following mods will be installed in this profile.'));
      for(const item of plan.items){const row=text('div','','mm-plan-item');row.append(text('strong',item.name),text('small',`${item.primary?'Selected mod':'Required dependency'} · ${item.version} · ${item.channel}`));el('mm-dialog-body').append(row);}
      const confirm=button(plan.replace?'Confirm version change':'Confirm installation',async()=>{
        confirm.disabled=true;state.busy=true;render();el('mm-dialog-status').textContent='Downloading and validating files…';
        try{await run(profile,{...payload,action:'install'});if(dialogValid(serial,profile)){closeDialog();notice('Mods installed. Changes will apply on the next server start.');}}
        catch(error){if(dialogValid(serial,profile)){el('mm-dialog-status').textContent=errorMessage(error);confirm.disabled=false;}}
        finally{state.busy=false;if(still(profile))await loadProfileModsPage(true);}
      });confirm.disabled=!plan.context.mutable;el('mm-dialog-body').append(confirm);
    }catch(error){if(dialogValid(serial,profile))el('mm-dialog-status').textContent=errorMessage(error);}
  }
  async function toggleMod(mod) {
    const profile=id();state.busy=true;render();notice(`${mod.disabled?'Enabling':'Disabling'} ${mod.display_name||mod.name}…`);
    try{await run(profile,{action:'toggle',filename:mod.name,enabled:!!mod.disabled});}
    catch(error){if(still(profile))notice(errorMessage(error),true);}
    finally{state.busy=false;if(still(profile))await loadProfileModsPage(true);}
  }
  function removeMod(mod) {
    const profile=id(),serial=showDialog('Remove mod','LIBRARY');
    el('mm-dialog-body').append(text('p',`Remove ${mod.display_name||mod.name}? A copy will be preserved as a backup. Mods depending on it may stop working.`));
    const confirm=button('Remove mod',async()=>{
      confirm.disabled=true;state.busy=true;render();
      try{await run(profile,{action:'remove',filename:mod.name});if(dialogValid(serial,profile))closeDialog();}
      catch(error){if(dialogValid(serial,profile))el('mm-dialog-status').textContent=errorMessage(error);confirm.disabled=false;}
      finally{state.busy=false;if(still(profile))await loadProfileModsPage(true);}
    },'mm-danger');el('mm-dialog-body').append(confirm);
  }
  function integration() {
    const profile=id(),serial=showDialog('Connect CurseForge','INTEGRATION');
    const form=text('form','','mm-form'),label=text('label','CurseForge Core / 3rd Party API key'),input=document.createElement('input');
    input.type='password';input.autocomplete='off';input.id='mm-api-key';input.placeholder=state.configured?'New key (the current key is never displayed)':'Paste API key';input.required=true;input.maxLength=512;label.htmlFor=input.id;
    const intro=text('p',state.configured?'CurseForge is connected. You can replace the key below.':'Use an approved API key for the CurseForge Core / 3rd Party API (api.curseforge.com). Authors Console upload tokens are not valid for catalog searches.');
    const link=text('a','How to request the correct API key ↗');link.href='https://support.curseforge.com/support/solutions/articles/9000208346-about-the-curseforge-api-and-how-to-apply-for-a-key';link.target='_blank';link.rel='noopener noreferrer';
    const submit=button('Validate and save',()=>{});submit.type='submit';
    form.append(intro,link,label,input,submit);el('mm-dialog-body').append(form);
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(input.value.trim().length<10)return;
      submit.disabled=true;el('mm-dialog-status').textContent='Validating the CurseForge connection…';
      try{await run(profile,{profile_id:profile,api_key:input.value.trim()},'/api/mods/integration');input.value='';if(dialogValid(serial,profile)){state.configured=true;state.identifiedSignature='';closeDialog();await loadProfileModsPage(true);}}
      catch(error){if(dialogValid(serial,profile))el('mm-dialog-status').textContent=errorMessage(error);}
      finally{submit.disabled=false;}
    });
  }
  function mode(value) {state.mode=value;state.searchSerial++;state.loading=false;el('profile-mods-search').value='';render();if(value==='catalog')search();}
  el('mm-installed-tab').addEventListener('click',()=>mode('installed'));
  el('mm-catalog-tab').addEventListener('click',()=>mode('catalog'));
  el('mm-integration').addEventListener('click',integration);
  el('mm-close').addEventListener('click',closeDialog);
  el('mm-dialog').addEventListener('cancel',()=>state.dialogSerial++);
  el('mm-more').addEventListener('click',()=>search(true));
  el('mm-sort').addEventListener('change',()=>search());
  let timer;
  el('profile-mods-search').addEventListener('input',()=>{clearTimeout(timer);if(state.mode==='catalog')timer=setTimeout(()=>search(),350);else render();});
  const observer=new MutationObserver(()=>{if(!el('profile-mods-view').hidden)loadProfileModsPage();else if(el('mm-dialog').open)closeDialog();});
  observer.observe(el('profile-mods-view'),{attributes:true,attributeFilter:['hidden']});
  if(!el('profile-mods-view').hidden)loadProfileModsPage();
})();
