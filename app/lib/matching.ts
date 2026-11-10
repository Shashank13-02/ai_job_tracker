import {z} from "zod";
import type {Job,Profile} from "./model";
export const assessmentSchema=z.object({match:z.boolean(),fit_score:z.number().int().min(1).max(100),reason:z.string().min(1).max(2000),matched_skills:z.array(z.string().max(100)).max(30),missing_skills:z.array(z.string().max(100)).max(30)}).strict();
export const jsonSchema={type:"object",properties:{match:{type:"boolean"},fit_score:{type:"integer"},reason:{type:"string"},matched_skills:{type:"array",items:{type:"string"}},missing_skills:{type:"array",items:{type:"string"}}},required:["match","fit_score","reason","matched_skills","missing_skills"],additionalProperties:false};
export const skillVocabulary=["Python","JavaScript","TypeScript","React","Next.js","SQL","PostgreSQL","Machine learning","PyTorch","TensorFlow","NLP","Transformers","FastAPI","Docker","Kubernetes","AWS","Java","C++","Go","Figma","Statistics","LLM"];
export function contains(text:string,term:string){if(term.toLowerCase()==="go")return /\bgolang\b/i.test(text)||/\bGo\b(?=\s*(?:[,;/)]|$))|\bGo\s+(?:programming|language|development)\b/.test(text);const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return new RegExp("(^|[^a-z0-9])"+escaped+"(?=$|[^a-z0-9])","i").test(text);}
export function skillTags(text:string){return skillVocabulary.filter(s=>contains(text,s));}
export function keywordAssessment(profile:Profile,job:Pick<Job,"title"|"description"|"location">){
 const text=job.title+" "+job.description,skills=skillTags(text),evidence=profile.resume;
 const matched=skills.filter(s=>contains(evidence,s)),gaps=skills.filter(s=>!contains(evidence,s));
 const role=profile.roles.some(r=>r.toLowerCase().split(/\W+/).filter(w=>w.length>2).some(w=>contains(job.title,w)));
 const location=!profile.locations.length||profile.locations.some(l=>contains(job.location,l));
 let score=Math.round(15+(skills.length?matched.length/skills.length*55:10)+(role?20:0)+(location?10:0));
 if(profile.remoteOnly&&!/remote/i.test(job.location))score=Math.min(score,35);
 score=Math.max(1,Math.min(100,score));
 return {match:score>=profile.minScore,fit_score:score,reason:`Keyword estimate: ${matched.length} of ${skills.length} recognized job skills appear in your resume. ${role?"The title overlaps your target roles.":"Check the role and experience requirements carefully."}`,matched_skills:matched,missing_skills:gaps};
}
export function plainText(value:unknown){return String(value??"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();}
export function safeUrl(value:unknown){try{const u=new URL(String(value));if(u.protocol!=="https:"||u.username||u.password)return "";for(const key of [...u.searchParams.keys()])if(key.startsWith("utm_")||["ref","source","trackingId"].includes(key))u.searchParams.delete(key);u.hash="";return u.href;}catch{return "";}}
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,"0")).join("");}
export async function normalizeJob(raw:Record<string,unknown>,source:string,company=""):Promise<Job|null>{
 const title=plainText(raw.title??raw.jobTitle??raw.positionName).slice(0,200);
 const url=safeUrl(raw.absolute_url??raw.applicationUrl??raw.applyUrl??raw.jobUrl??raw.url??raw.link);
 const description=plainText(raw.content??raw.description??raw.descriptionText??raw.jobDescription).slice(0,16000);
 if(!title||!url||description.length<30)return null;
 const loc=raw.location;const location=plainText(typeof loc==="object"&&loc? (loc as {name?:string}).name:loc||raw.jobLocation||"Not specified").slice(0,200);
 const rawCompany=raw.companyName??raw.company??company;const companyName=plainText(typeof rawCompany==="object"&&rawCompany?(rawCompany as {name?:string}).name:rawCompany).slice(0,200)||"Not specified";
 const date=String(raw.postedAt??raw.publishedAt??raw.updated_at??"");const postedAt=Number.isNaN(Date.parse(date))?"":new Date(date).toISOString();
 return {id:await digest(url),title,company:companyName,location,type:/\b(intern(ship)?|co-?op)\b/i.test(title)?"Internship":plainText(raw.employmentType??raw.jobType??"Full-time").slice(0,60),salary:plainText(raw.salary??"Not listed").slice(0,150),description,url,source,tags:skillTags(title+" "+description).slice(0,6),postedAt,score:0,reason:"Not scored",gaps:[],matchedSkills:[],match:false,scoring:"keyword",status:"new",demo:false};
}

