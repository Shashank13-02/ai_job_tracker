import {identity,body,db,profileFor,jobsFor,secret,profileSchema,sourcesSchema,failure,AppError} from "@/lib/server";
import {synchronize,draftLetter} from "@/lib/pipeline";
import {z} from "zod";
export const dynamic="force-dynamic";
export async function GET(){try{const user=await identity();const {profile,sources}=await profileFor(user);const jobs=await jobsFor(user);const history=await db().prepare("SELECT * FROM runs WHERE user_id=? ORDER BY started_at DESC LIMIT 8").bind(user).all();return Response.json({profile,sources,jobs,history:history.results,connections:{openai:!!secret("OPENAI_API_KEY"),apify:!!secret("APIFY_TOKEN")&&!!secret("APIFY_TASK_ID")}}, {headers:{"Cache-Control":"private, no-store"}});}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const user=await identity();const input=await body(request);const {profile}=await profileFor(user);
 if(input.action==="profile"){const p=profileSchema.parse(input.profile);const result=await db().prepare("UPDATE profiles SET body=?,revision=revision+1 WHERE user_id=? AND revision=?").bind(JSON.stringify(p),user,p.revision).run();if(!result.meta.changes)throw new AppError("Your profile changed in another tab. Reload before saving.",409);return Response.json({ok:true});}
 if(input.action==="sources"){const sources=sourcesSchema.parse(input.sources);await db().prepare("UPDATE profiles SET sources=? WHERE user_id=?").bind(JSON.stringify(sources),user).run();return Response.json({ok:true});}
 if(input.action==="status"){const id=z.string().min(1).max(100).parse(input.id);const status=z.enum(["new","saved","applied","interview","archived"]).parse(input.status);const result=await db().prepare("UPDATE listings SET status=? WHERE user_id=? AND id=?").bind(status,user,id).run();if(!result.meta.changes)throw new AppError("Job not found.",404);return Response.json({ok:true});}
 if(input.action==="sync")return Response.json(await synchronize(user));
 if(input.action==="letter")return Response.json({letter:await draftLetter(user,z.string().min(1).max(100).parse(input.id))});
 throw new AppError("Unknown action.");
 }catch(e){return failure(e);}}
