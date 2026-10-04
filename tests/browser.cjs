const fs=require('fs');
const path=require('path');
const http=require('http');
const {chromium}=require('playwright');
const root=path.join(__dirname,'..');
const output=process.env.TEST_OUTPUT_DIR||path.join(root,'test-results');
fs.mkdirSync(output,{recursive:true});
const results=[];
const server=http.createServer((req,res)=>{
 let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if(name==='/')name='/index.html';
 const file=path.join(root,name);
 if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404);return res.end('Not found');}
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png'};
 res.setHeader('Content-Type',mime[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true});
 async function test(name,fn){try{await fn();results.push({name,status:'PASS'});}catch(e){results.push({name,status:'FAIL',detail:e.message});}}
 function check(condition,msg){if(!condition)throw Error(msg);}
 async function page(options={}){
  const context=await browser.newContext({viewport:options.mobile?{width:375,height:812}:{width:1280,height:900},isMobile:!!options.mobile,hasTouch:!!options.mobile,serviceWorkers:options.sw?'allow':'block'});
  const p=await context.newPage();p.errors=[];p.calls=[];
  await p.exposeFunction('__recordCall',data=>{p.calls.push({method:data.action==='list'?'GET':'POST',body:JSON.stringify(data),action:data.action});});
  p.on('pageerror',e=>p.errors.push(e.message));p.on('dialog',d=>d.dismiss());
  await p.route('**/*',async r=>{
   if(r.request().url().startsWith(base))return r.continue();
   if(r.request().url().includes('script.google.com')){
    const url=new URL(r.request().url());
    const target='https://n-mock-script.googleusercontent.com/bridge'+url.search;
    return r.fulfill({contentType:'text/html',body:`<iframe src="${target.replace(/&/g,'&amp;')}"></iframe>`});
   }
   if(r.request().url().includes('n-mock-script.googleusercontent.com')){
    const url=new URL(r.request().url());
    const config={channel:url.searchParams.get('channel'),origin:url.searchParams.get('origin')};
    let bridge=fs.readFileSync(path.join(root,'apps-script/Bridge.html'),'utf8').replace('<?!= config ?>',JSON.stringify(config));
    const mock=`<script>
      const options=${JSON.stringify(options).replace(/</g,'\\u003c')};
      window.google={script:{run:{withSuccessHandler(ok){return {withFailureHandler(fail){return {handleClientRequest(data){
        window.__recordCall(data);
        const result=(data.action==='reply'&&options.postReply)||options.reply||{success:true,data:[]};
        window.__respond=()=>ok(result);
        if(options.defer)return;
        if(options.networkFailure)return fail({message:'Mock network failure'});
        setTimeout(()=>ok(result),0);
      }}}}}}}};
    </script>`;
    bridge=bridge.replace('<script>',mock+'<script>');
    return r.fulfill({contentType:'text/html',body:bridge});
   }
   if(r.request().url().includes('html2canvas'))return r.fulfill({contentType:'application/javascript',body:''});
   return r.fulfill({status:200,contentType:'image/png',body:fs.readFileSync(path.join(root,'icon-192.png'))});
  });
  await p.addInitScript(value=>{if(value!==undefined)localStorage.setItem('ratechotui_history',value);},options.history);
  await p.goto(base+(options.admin?'/?admin=1':'/'));
  return p;
 }
 async function fill(p,whitespace=false){await p.fill('#user-email','test@example.com');await p.fill('#service',whitespace?'   ':'Test service');await p.fill('#comment',whitespace?'   ':'Test comment');await p.click('#stars [data-v="4"]');}
 await test('Initial page loads without runtime errors',async()=>{const p=await page();check(p.errors.length===0,p.errors.join(';'));check(await p.locator('#badge-title').innerText()==='Tân binh','Wrong badge');await p.context().close();});
 await test('Mobile page fits viewport',async()=>{const p=await page({mobile:true});check(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow');await p.context().close();});
 await test('Required fields prevent submission',async()=>{const p=await page();await p.click('#send-btn');check(p.calls.length===0,'Unexpected submission');check(await p.locator('#email-error').evaluate(e=>e.classList.contains('show')),'Email error missing');await p.context().close();});
 await test('Rating selects correct stars',async()=>{const p=await page();await p.click('#stars [data-v="3"]');check(await p.locator('#stars .active').count()===3,'Wrong stars');await p.context().close();});
 await test('Successful submission stores history and resets form',async()=>{const p=await page();await fill(p);await p.click('#send-btn');await p.waitForFunction(()=>document.querySelector('#thanks-popup').style.display==='flex');check(p.calls.length===1,'Wrong request count');check(await p.inputValue('#user-email')==='','Form not reset');check(await p.evaluate(()=>JSON.parse(localStorage.getItem('ratechotui_history')).length)===1,'Missing history');await p.context().close();});
 await test('Whitespace-only service/comment rejected',async()=>{const p=await page();await fill(p,true);await p.click('#send-btn');await p.waitForTimeout(100);check(p.calls.length===0,'Whitespace-only fields accepted and submitted');await p.context().close();});
 await test('Backend rejection does not show success or erase form',async()=>{const p=await page({reply:{success:false,error:'Rejected'}});await fill(p);await p.click('#send-btn');await p.waitForTimeout(100);check(await p.locator('#thanks-popup').evaluate(e=>e.style.display)!=='flex','Server rejection shown as success');check(await p.inputValue('#user-email')!=='','Form erased on rejection');await p.context().close();});
 await test('Network failure preserves input and re-enables button',async()=>{const p=await page({networkFailure:true});await fill(p);await p.click('#send-btn');await p.waitForTimeout(100);check(await p.inputValue('#user-email')==='test@example.com','Lost input');check(await p.locator('#send-btn').isEnabled(),'Button stuck');await p.context().close();});
 await test('Malformed history cannot break initialization',async()=>{const p=await page({history:'{}',admin:true});check(p.errors.length===0,p.errors.join(';'));check(await p.locator('#admin-view').isVisible(),'Admin initialization interrupted');await p.context().close();});
 await test('Out-of-range history rating cannot break page',async()=>{const p=await page({history:JSON.stringify([{ts:Date.now(),stars:6}])});check(p.errors.length===0,p.errors.join(';'));await p.context().close();});
 await test('Admin button opens the login form reliably',async()=>{const p=await page();await p.click('#open-admin-btn');await p.waitForFunction(()=>location.search.includes('admin=1')&&!document.querySelector('#admin-view').classList.contains('hidden'));check(await p.locator('#login-screen').isVisible(),'Admin login form did not open');await p.context().close();});
 await test('Admin login and logout',async()=>{const p=await page({admin:true});await p.fill('#admin-key-input','mock-key');await p.click('#login-btn');await p.waitForFunction(()=>!document.querySelector('#dashboard').classList.contains('hidden'));check(await p.locator('#empty-state').isVisible(),'Missing empty state');await p.click('#logout-btn');check(await p.locator('#login-screen').isVisible(),'Logout failed');check(await p.evaluate(()=>sessionStorage.getItem('meow_admin_key'))===null,'Key retained');await p.context().close();});
 await test('Wrong admin key stays at login',async()=>{const p=await page({admin:true,reply:{success:false,error:'Invalid key',code:'AUTH'}});await p.fill('#admin-key-input','bad-key');await p.click('#login-btn');await p.waitForFunction(()=>document.querySelector('#login-error').classList.contains('show'));check(await p.locator('#login-screen').isVisible(),'Wrong key logged in');await p.context().close();});
 await test('Logout during pending login cannot restore session',async()=>{const p=await page({admin:true,defer:true});await p.fill('#admin-key-input','mock-key');await p.click('#login-btn');while(p.calls.length===0)await p.waitForTimeout(50);await p.evaluate(()=>document.querySelector('#logout-btn').click());const frame=p.frames().find(f=>f.url().includes('n-mock-script'));await frame.evaluate(()=>window.__respond());await p.waitForTimeout(100);check(await p.locator('#login-screen').isVisible(),'Pending login re-opened dashboard after logout');await p.context().close();});
 await test('All HTML and manifest local asset paths exist',async()=>{const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const refs=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(x=>x[1]).filter(x=>x&&!/^https?:/.test(x)&&!x.startsWith('?'));refs.push(...JSON.parse(fs.readFileSync(path.join(root,'manifest.json'))).icons.map(x=>x.src));const missing=[...new Set(refs.filter(x=>!fs.existsSync(path.join(root,x))))];check(!missing.length,'Missing: '+missing.join(', '));});
 await test('Service worker installs and controls page',async()=>{const p=await page({sw:true});await p.waitForFunction(()=>navigator.serviceWorker.controller!==null,{},{timeout:4000});await p.context().close();});
 await test('PNG dimensions match declared sizes',async()=>{for(const [name,size]of [['icon-192.png',192],['icon-512.png',512],['favicon-32.png',32],['favicon-64.png',64],['apple-touch-icon.png',180]]){const b=fs.readFileSync(path.join(root,name));check(b.readUInt32BE(16)===size&&b.readUInt32BE(20)===size,`${name}: wrong dimensions`);}});
 await test('Selected photo is resized and included in submission',async()=>{const p=await page();await p.setInputFiles('#photo-input',path.join(root,'icon-512.png'));await p.waitForFunction(()=>document.querySelector('#form-status').textContent==='Ảnh đã sẵn sàng.');await p.waitForTimeout(20);await fill(p);await p.click('#send-btn');await p.waitForFunction(()=>document.querySelector('#form-status').textContent.startsWith('Đã lưu đánh giá.'));check(p.calls.length===1,'Submission did not reach bridge');const body=JSON.parse(p.calls[0].body);check(body.photoMime==='image/jpeg'&&body.photoBase64.length>0,'Image missing');await p.context().close();});
 await test('Admin renders text safely and sends mocked reply',async()=>{const p=await page({admin:true,reply:{success:true,data:[{email:'test@example.com',service:'<script>alert(1)</script>',comment:'<img onerror=alert(1)>',stars:4,rowIndex:2}]}});await p.fill('#admin-key-input','mock-key');await p.click('#login-btn');await p.waitForSelector('.feedback-card');check(await p.locator('.card-service script').count()===0,'HTML injected');await p.fill('.reply-message','Mock reply');await p.click('.send-reply-btn');await p.waitForFunction(()=>document.querySelector('.reply-status').classList.contains('replied'));check(JSON.parse(p.calls.find(x=>x.method==='POST').body).action==='reply','Reply request malformed');await p.context().close();});
 await test('Failed mocked admin reply retains pending status',async()=>{const p=await page({admin:true,postReply:{success:false,error:'Mock failure'},reply:{success:true,data:[{email:'test@example.com',stars:4,rowIndex:2}]}});await p.fill('#admin-key-input','mock-key');await p.click('#login-btn');await p.waitForSelector('.feedback-card');await p.fill('.reply-message','Mock reply');await p.click('.send-reply-btn');await p.waitForTimeout(100);check(await p.locator('.reply-status').evaluate(e=>e.classList.contains('pending')),'Failure shown as success');check(await p.locator('.send-reply-btn').isEnabled(),'Reply button stuck');await p.context().close();});
 await test('Card downloads without external library',async()=>{const p=await page();await fill(p);await p.click('#send-btn');await p.waitForFunction(()=>document.querySelector('#thanks-popup').style.display==='flex');const downloaded=p.waitForEvent('download');await p.click('#download-card-btn');const file=await downloaded;check(file.suggestedFilename().endsWith('.png'),'Wrong download');await p.waitForFunction(()=>!document.querySelector('#download-card-btn').disabled);check(p.errors.length===0,p.errors.join(';'));await file.saveAs(path.join(output,'thank-you-card.png'));await p.context().close();});
 await test('Admin refresh preserves reply draft and form',async()=>{const p=await page({admin:true,reply:{success:true,data:[{email:'test@example.com',stars:4,rowIndex:2}]}});await p.fill('#admin-key-input','mock-key');await p.click('#login-btn');await p.waitForSelector('.feedback-card');await p.fill('.reply-subject','Draft subject');await p.fill('.reply-message','Draft message');await p.click('#refresh-btn');await p.waitForFunction(()=>!document.querySelector('#refresh-btn').disabled);check(await p.inputValue('.reply-message')==='Draft message','Draft lost');check(await p.inputValue('.reply-subject')==='Draft subject','Subject lost');await p.context().close();});
 await test('Install button and fallback instructions visible',async()=>{const p=await page({mobile:true});check(await p.locator('#install-app-btn').isVisible(),'Missing install button');await p.click('#install-app-btn');check(await p.locator('#install-help').isVisible(),'Missing install guidance');await p.screenshot({path:path.join(output,'mobile-preview.png'),fullPage:true});await p.context().close();});
 await test('Service worker supports offline reload and card download',async()=>{const p=await page({sw:true});await p.waitForFunction(()=>navigator.serviceWorker.controller!==null,{},{timeout:4000});await p.context().setOffline(true);await p.reload();check(await p.locator('#send-btn').isVisible(),'Offline shell missing');await fill(p);await p.click('#send-btn');check(await p.inputValue('#user-email')==='test@example.com','Offline submit erased inputs');check((await p.locator('#form-status').innerText()).includes('offline'),'Missing offline message');await p.evaluate(()=>{document.querySelector('#thanks-popup').style.display='flex';});const downloaded=p.waitForEvent('download');await p.click('#download-card-btn');await downloaded;await p.context().close();});
 await test('Forged bridge result is ignored',async()=>{const p=await page({defer:true});await fill(p);await p.click('#send-btn');while(p.calls.length===0)await p.waitForTimeout(50);const channel=await p.locator('iframe').getAttribute('src');await p.evaluate(channel=>window.postMessage({type:'meow-backend',channel:new URL(channel).searchParams.get('channel'),ready:true},location.origin),channel);check(await p.inputValue('#user-email')==='test@example.com','Forged message reset form');await p.context().close();});
 await test('Retry preserves request ID and changed payload gets a new ID',async()=>{const p=await page({networkFailure:true});await fill(p);await p.click('#send-btn');await p.waitForFunction(()=>document.querySelector('#form-status').textContent==='Mock network failure');const first=JSON.parse(p.calls[0].body).requestId;await p.click('#send-btn');await p.waitForFunction(()=>!document.querySelector('#send-btn').disabled);check(JSON.parse(p.calls[1].body).requestId===first,'Retry used new ID');await p.fill('#comment','Changed comment');await p.click('#send-btn');await p.waitForFunction(()=>!document.querySelector('#send-btn').disabled);check(JSON.parse(p.calls[2].body).requestId!==first,'Changed payload reused old ID');await p.context().close();});
 fs.writeFileSync(path.join(output,'browser-results.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 await browser.close();server.close();if(results.some(r=>r.status==='FAIL'))process.exitCode=1;
})().catch(e=>{console.error(e);server.close();process.exit(1)});
