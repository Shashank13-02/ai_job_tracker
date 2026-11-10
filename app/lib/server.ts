import {env} from "cloudflare:workers";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {blankProfile,type Profile,type Job} from "./model";
import {z} from "zod";
export class AppError extends Error{constructor(message:string,public status=400){super(message);}}
export function db(){if(!env.DB)throw new AppError("Storage is unavailable. Please try again shortly.",503);return env.DB;}
export function secret(key:string){return (env as unknown as Record<string,string|undefined>)[key]||"";}
export async function identity(){const user=await getChatGPTUser();if(!user)throw new AppError("Sign in to save your profile and matches.",401);return user.userId;}
export async function body(request:Request){if(request.headers.get("origin")&&request.headers.get("origin")!==new URL(request.url).origin)throw new AppError("Request origin is not allowed.",403);if(!request.headers.get("content-type")?.includes("application/json"))throw new AppError("Expected JSON.",415);const text=await request.text();if(text.length>100000)throw new AppError("Request is too large.",413);try{return JSON.parse(text);}catch{throw new AppError("Invalid JSON.");}}
export function failure(e:unknown){if(e instanceof AppError)return Response.json({error:e.message},{status:e.status});if(e instanceof z.ZodError)return Response.json({error:e.issues.map(i=>i.path.join(".")+": "+i.message).join("; ")},{status:400});console.error(e instanceof Error?e.message:"Request failed");return Response.json({error:"The request could not be completed. Your saved data is unchanged; please retry."},{status:500});}
export async function ensure(user:string){await db().prepare("INSERT INTO profiles (user_id,body) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING").bind(user,JSON.stringify(blankProfile)).run();}
export async function profileFor(user:string){await ensure(user);const row=await db().prepare("SELECT body,revision,sources FROM profiles WHERE user_id=?").bind(user).first<{body:string;revision:number;sources:string}>();return {profile:{...JSON.parse(row!.body),revision:row!.revision} as Profile,sources:JSON.parse(row!.sources) as {boards:string[];apify:boolean}};}
export async function jobsFor(user:string){const rows=await db().prepare("SELECT body,status,revision FROM listings WHERE user_id=? ORDER BY updated_at DESC LIMIT 1000").bind(user).all<{body:string;status:Job["status"];revision:number}>();return rows.results.map(r=>({...JSON.parse(r.body),status:r.status,revision:r.revision}));}
export const profileSchema=z.object({name:z.string().trim().max(100),resume:z.string().trim().min(50,"Add at least 50 characters of resume text").max(30000),roles:z.array(z.string().trim().min(1).max(100)).min(1).max(15),locations:z.array(z.string().trim().min(1).max(100)).max(15),skills:z.array(z.string().trim().min(1).max(100)).max(40),minScore:z.number().int().min(1).max(100),remoteOnly:z.boolean(),revision:z.number().int().min(0)});
export const sourcesSchema=z.object({boards:z.array(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/,"Use a Greenhouse board token, for example: figma")).max(4),apify:z.boolean()});

