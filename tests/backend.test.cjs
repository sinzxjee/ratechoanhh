const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
const headers=['Timestamp','Email','Service','Stars','Comment','PhotoURL','Replied','ReplyMessage'];
const id='a'.repeat(32), replyId='b'.repeat(32);
function env(options={}) {
 const state={rows:options.rows||[headers.slice()],mails:[],opened:null,photoFiles:[],locks:0,props:{ADMIN_KEY:'test-admin',...options.props}};
 function range(row,col,n=1,width=1){return {
  getValues(){return Array.from({length:n},(_,i)=>Array.from({length:width},(_,j)=>state.rows[row-1+i]?.[col-1+j]??''));},
  getValue(){return this.getValues()[0][0];},
  setValue(value){if(options.failMark&&col===7&&value==='Yes')throw Error('Sheet write failed');while(state.rows.length<row)state.rows.push([]);state.rows[row-1][col-1]=value;return this;},
  setValues(values){values.forEach((r,i)=>r.forEach((v,j)=>range(row+i,col+j).setValue(v)));return this;},
  createTextFinder(value){return {matchEntireCell(){return this;},findNext(){for(let i=row-1;i<row-1+n;i++){if(String(state.rows[i]?.[col-1]??'')===value)return {getRow:()=>i+1};}return null;}};}
 };}
 const sheet={getLastRow:()=>state.rows.length,getMaxColumns:()=>26,insertColumnsAfter(){},getRange:range,
  appendRow:r=>state.rows.push(r),getDataRange:()=>({getValues:()=>state.rows.map(r=>r.slice())})};
 const context={Date,console,SpreadsheetApp:{openById(value){state.opened=value;return {getSheetByName:name=>{assert.equal(name,'Feedback');return sheet;},insertSheet:()=>sheet};},flush(){}},
  PropertiesService:{getScriptProperties:()=>({getProperty:name=>state.props[name]||null})},
  LockService:{getScriptLock:()=>({waitLock(){state.locks++;},releaseLock(){state.locks--;}})},
  MailApp:{getRemainingDailyQuota:()=>options.quota??100,sendEmail(mail){if(options.mailFailure)throw Error('Authorization missing');state.mails.push(mail);}},
  DriveApp:{getFoldersByName:()=>({hasNext:()=>true,next:()=>({createFile(blob){state.photoFiles.push(blob);return {getUrl:()=> 'https://drive.google.com/file/d/mock/view'};}})}),getRootFolder:()=>({getId:()=> 'root'})},
  Utilities:{base64Decode:value=>Buffer.from(value,'base64'),newBlob:(bytes,mime,name)=>({bytes,mime,name})},
  HtmlService:{XFrameOptionsMode:{ALLOWALL:'allow'},createHtmlOutput:text=>({text}),createTemplateFromFile:name=>({name,evaluate(){return {config:this.config,setTitle(){return this;},setXFrameOptionsMode(){return this;}};}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({text,setMimeType(){return this;}})}
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {state,call:data=>context.handleClientRequest(data),context};
}
const submit=(extra={})=>({action:'submit',requestId:id,email:' test@example.com ',service:'Test service',stars:4,comment:'Test comment',...extra});
const reply=(extra={})=>({action:'reply',key:'test-admin',requestId:replyId,rowIndex:2,feedbackId:id,to:'test@example.com',message:'Thanks',...extra});
test('Submission opens the specified workbook and writes the Feedback row',()=>{const {state,call}=env();assert.equal(call(submit()).success,true);assert.equal(state.opened,'19VMyZMlWPwnt69FDE1ujU1YzBoycpeHreWCEl3qAuz0');assert.equal(state.rows[1][1],'test@example.com');assert.equal(state.rows[1][8],id);assert.equal(state.rows[0][8],'RequestID');assert.equal(state.locks,0);});
test('Retrying a submitted request never adds a duplicate row',()=>{const {state,call}=env();call(submit());assert.equal(call(submit()).duplicate,true);assert.equal(state.rows.length,2);});
test('Invalid fields never write rows',()=>{for(const fields of [{email:'bad'},{service:'   '},{comment:'   '},{stars:6},{stars:1.5},{requestId:'bad'}]){const {state,call}=env();assert.equal(call(submit(fields)).success,false);assert.equal(state.rows.length,1);}});
test('Formula-like user input is stored as text',()=>{const {state,call}=env();call(submit({service:'=SUM(1,2)',comment:'=IMPORTXML("bad","x")'}));assert.equal(state.rows[1][2],"'=SUM(1,2)");assert.ok(state.rows[1][4].startsWith("'="));});
test('Existing unexpected headers are not overwritten',()=>{const {state,call}=env({rows:[['Unrelated','Personal notes']]});assert.equal(call(submit()).success,false);assert.equal(state.rows[0][0],'Unrelated');assert.equal(state.rows.length,1);});
test('Existing I/J data is protected',()=>{const {state,call}=env({rows:[[...headers,'Other data']]});assert.equal(call(submit()).success,false);assert.equal(state.rows[0][8],'Other data');});
test('List requires configured correct admin password',()=>{const {call}=env();assert.equal(call({action:'list',key:'wrong'}).code,'AUTH');assert.equal(call({action:'list',key:'test-admin'}).success,true);assert.equal(env({props:{ADMIN_KEY:''}}).call({action:'list',key:'test-admin'}).success,false);});
test('List serializes timestamps for google.script.run and returns newest first',()=>{const {call}=env();call(submit());call(submit({requestId:'c'.repeat(32),comment:'Newer'}));const data=call({action:'list',key:'test-admin'}).data;assert.equal(data[0].comment,'Newer');assert.equal(typeof data[0].timestamp,'string');assert.equal(data[1].feedbackId,id);});
test('Valid reply sends to sheet email and records success',()=>{const {state,call}=env();call(submit());assert.equal(call(reply()).success,true);assert.equal(state.mails[0].to,'test@example.com');assert.equal(state.rows[1][6],'Yes');assert.equal(state.rows[1][7],'Thanks');assert.equal(state.rows[1][9],replyId);});
test('Retrying a reply cannot send email twice',()=>{const {state,call}=env();call(submit());call(reply());assert.equal(call(reply()).duplicate,true);assert.equal(state.mails.length,1);});
test('Reply cannot substitute another recipient or invalid row',()=>{const {state,call}=env();call(submit());for(const fields of [{key:'wrong'},{to:'other@example.com'},{feedbackId:'missing'},{feedbackId:'',rowIndex:1},{message:'  '}])assert.equal(call(reply(fields)).success,false);assert.equal(state.mails.length,0);});
test('Email quota failure does not mark feedback replied',()=>{const {state,call}=env({quota:0});call(submit());assert.equal(call(reply()).success,false);assert.equal(state.rows[1][6],'No');assert.equal(state.mails.length,0);});
test('Mail authorization error is explicit and restores prior row state',()=>{const {state,call}=env({mailFailure:true});call(submit());const result=call(reply());assert.equal(result.success,false);assert.match(result.error,/Authorization missing/);assert.equal(state.rows[1][6],'No');assert.equal(state.rows[1][9],'');});
test('Uncertain send state prevents a blind duplicate email',()=>{const {state,call}=env({failMark:true});call(submit());const sent=call(reply());assert.equal(sent.success,true);assert.ok(sent.warning);assert.equal(state.rows[1][6],'Sending');assert.equal(call(reply()).success,false);assert.equal(call(reply({requestId:'c'.repeat(32)})).success,false);assert.equal(state.mails.length,1);});
test('Photo upload does not make Drive files public',()=>{const {state,call}=env();assert.equal(call(submit({photoMime:'image/jpeg',photoBase64:Buffer.from([255,216,255,217]).toString('base64')})).success,true);assert.equal(state.photoFiles.length,1);assert.ok(state.rows[1][5].startsWith('https://drive.google.com/'));});
test('HTML bridge allows only configured origin and valid channel',()=>{const {context}=env();assert.ok(context.doGet({parameter:{action:'bridge',origin:'https://evil.example',channel:id}}).text.includes('chưa'));const output=context.doGet({parameter:{action:'bridge',origin:'https://sinzxjee.github.io',channel:id}});assert.equal(JSON.parse(output.config).origin,'https://sinzxjee.github.io');});
