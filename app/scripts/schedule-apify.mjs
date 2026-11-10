// Creates or updates exactly one named daily collection schedule for a saved task.
import {loadEnvFile} from "node:process";
try{loadEnvFile(".env");}catch{}
const token=process.env.APIFY_TOKEN,task=process.env.APIFY_TASK_ID;
if(!token||!task)throw new Error("Set APIFY_TOKEN and APIFY_TASK_ID in .env first.");
if(!process.argv.includes("--enable")){console.log("Run with --enable to schedule the saved Apify task daily at 08:00 Asia/Kolkata. Apify usage charges may apply.");process.exit(0);}
async function api(path,init={}){const r=await fetch("https://api.apify.com/v2/"+path,{...init,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error("Apify request failed (HTTP "+r.status+").");return (await r.json()).data;}
const name="launchpad-daily-"+task.replace(/[^a-zA-Z0-9-]/g,"-").toLowerCase();
let existing=null,offset=0;
while(true){const page=await api("schedules?limit=100&offset="+offset);existing=page.items.find(s=>s.name===name);if(existing||page.items.length<100)break;offset+=100;}
const body={name,title:"Launchpad daily job collection",isEnabled:true,isExclusive:true,cronExpression:"0 8 * * *",timezone:"Asia/Kolkata",actions:[{type:"RUN_ACTOR_TASK",actorTaskId:task}]};
const result=await api(existing?"schedules/"+existing.id:"schedules",{method:existing?"PUT":"POST",body:JSON.stringify(body)});
console.log(JSON.stringify({id:result.id,name:result.name,isEnabled:result.isEnabled,nextRunAt:result.nextRunAt},null,2));
