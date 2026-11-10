import assert from "node:assert/strict";
const origin="http://localhost:5173";
const unauth=await fetch(origin+"/api/workspace");assert.equal(unauth.status,401);
const login=await fetch(origin+"/signin-with-chatgpt?return_to=/",{redirect:"manual"});
const cookie=login.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");assert.ok(cookie,"Local mock sign-in must return a cookie");
async function api(data,expected=200,extra={}){const r=await fetch(origin+"/api/workspace",{method:data?"POST":"GET",headers:{Cookie:cookie,...(data?{"Content-Type":"application/json",Origin:origin}:{}),...extra},body:data?JSON.stringify(data):undefined});const text=await r.text();let d;try{d=JSON.parse(text);}catch{d={error:text};}assert.equal(r.status,expected,JSON.stringify(d));return d;}
let state=await api();
await api({action:"profile",profile:{...state.profile,name:"Test applicant",resume:"Software engineering student with Python, TypeScript, React, SQL, and machine learning project experience. Built accessible web apps and tested APIs. Seeking internships.",roles:["Software Engineer","Intern"],locations:[],skills:["Python","React","SQL"],minScore:20,remoteOnly:false}});
await api({action:"profile",profile:{...state.profile,resume:""}},400); // Initial empty resume fails validation.
await api({action:"sources",sources:{boards:["https://evil.example"],apify:false}},400);
await api({action:"sources",sources:{boards:["figma"],apify:false}});
await api({action:"sources",sources:{boards:[],apify:false}},403,{Origin:"https://evil.example"});
const sync=await api({action:"sync"});console.log("Collection:",sync);
state=await api();assert.ok(state.jobs.length>0,"Expected real jobs from Greenhouse");const id=state.jobs[0].id;
await api({action:"status",id,status:"saved"});assert.equal((await api()).jobs.find(j=>j.id===id).status,"saved");
await api({action:"status",id,status:"applied"});assert.equal((await api()).jobs.find(j=>j.id===id).status,"applied");
await api({action:"status",id:"not-owned",status:"saved"},404);
await api({action:"letter",id},503);
const count=state.jobs.length;await api({action:"sync"});state=await api();assert.equal(new Set(state.jobs.map(j=>j.id)).size,state.jobs.length);assert.equal(state.jobs.find(j=>j.id===id).status,"applied");
const stale=state.profile;await api({action:"profile",profile:{...stale,resume:stale.resume+" Additional work in Python."}});await api({action:"profile",profile:stale},409);
console.log("PASS: authentication, profile validation, origin checking, real collection, persistent state, deduplication, missing-key handling, and profile conflict checks.",{initialJobs:count,finalJobs:state.jobs.length});
