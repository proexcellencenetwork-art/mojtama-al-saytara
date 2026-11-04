import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
const allowedOrigins=new Set(['https://proexcellencenetwork-art.github.io','http://localhost:5173','http://127.0.0.1:5173'])
function headers(req:Request){const origin=req.headers.get('Origin');return{...(origin&&allowedOrigins.has(origin)?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{}),'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Content-Type':'application/json; charset=utf-8'}}
function json(req:Request,body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:headers(req)})}
async function hash(value:string,secret:string){const bytes=new TextEncoder().encode(`${value}:${secret}`);const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:headers(req)})
 const origin=req.headers.get('Origin')
 if(!origin||!allowedOrigins.has(origin))return json(req,{error:'origin_not_allowed'},403)
 const collectionEnabled=Deno.env.get('ONBOARDING_COLLECTION_ENABLED')==='true'
 if(req.method==='GET')return json(req,{status:collectionEnabled?'open':'paused'})
 if(req.method!=='POST')return json(req,{error:'method_not_allowed'},405)
 // Keep collection disabled until the cross-border privacy review is approved.
 if(!collectionEnabled)return json(req,{error:'collection_paused'},503)
 let body:unknown
 try{body=await req.json()}catch{return json(req,{error:'invalid_json'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return json(req,{error:'invalid_body'},400)
 const input=body as Record<string,unknown>
 if(typeof input.website==='string'&&input.website.trim())return json(req,{status:'ignored'},202)
 if(input.processingConsent!==true)return json(req,{error:'consent_required'},400)
 const fullName=typeof input.fullName==='string'?input.fullName.trim():''
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():''
 const userType=typeof input.userType==='string'?input.userType:''
 const specialty=typeof input.specialty==='string'?input.specialty.trim():''
 const goal=typeof input.goal==='string'?input.goal:''
 const selectedPath=typeof input.selectedPath==='string'?input.selectedPath:''
 const sourcePath=typeof input.sourcePath==='string'&&input.sourcePath.startsWith('/')?input.sourcePath.split(/[?#]/)[0].slice(0,300):'/'
 const validUserTypes=new Set(['professional','job_seeker','graduate','coach','researcher','innovator','other'])
 const validGoals=new Set(['job','skills','promotion','transition','leadership','explore'])
 const validSpecialties=new Set(['تقنية وذكاء اصطناعي','صحة وعلوم طبية','إدارة وأعمال','هندسة','مالية ومحاسبة','موارد بشرية','تعليم وبحث علمي','أخرى'])
 if(fullName.length<2||fullName.length>100)return json(req,{error:'invalid_name'},400)
 if(email.length<5||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(req,{error:'invalid_email'},400)
 if(!validUserTypes.has(userType)||!validSpecialties.has(specialty)||!validGoals.has(goal)||selectedPath!==goal)return json(req,{error:'invalid_selection'},400)
 if(typeof input.marketingOptIn!=='boolean')return json(req,{error:'invalid_consent'},400)
 const url=Deno.env.get('SUPABASE_URL'),serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
 if(!url||!serviceKey)return json(req,{error:'server_configuration_unavailable'},503)
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})
 const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown'
 const fingerprint=await hash(ip,serviceKey),now=Date.now()
 const {data:prior,error:rateReadError}=await admin.from('onboarding_rate_limits').select('window_started_at,request_count').eq('fingerprint',fingerprint).maybeSingle()
 if(rateReadError)return json(req,{error:'rate_limit_unavailable'},503)
 const active=prior&&now-new Date(prior.window_started_at).getTime()<60*60*1000
 if(active&&prior.request_count>=5)return json(req,{error:'rate_limited'},429)
 const {error:rateWriteError}=await admin.from('onboarding_rate_limits').upsert({fingerprint,window_started_at:active?prior.window_started_at:new Date(now).toISOString(),request_count:active?prior.request_count+1:1,updated_at:new Date(now).toISOString()},{onConflict:'fingerprint'})
 if(rateWriteError)return json(req,{error:'rate_limit_unavailable'},503)
 const {data:lead,error:leadError}=await admin.from('onboarding_leads').insert({full_name:fullName,email,user_type:userType,specialty,goal,selected_paths:[goal],processing_consent_at:new Date(now).toISOString(),privacy_notice_version:'2026-11-04',marketing_opt_in:input.marketingOptIn,marketing_consent_at:input.marketingOptIn?new Date(now).toISOString():null,source_path:sourcePath}).select('id').single()
 if(leadError?.code==='23505')return json(req,{error:'already_registered'},409)
 if(leadError||!lead)return json(req,{error:'save_failed'},500)
 await admin.from('onboarding_interest_events').insert({lead_id:lead.id,interest_key:goal,source_page:sourcePath})
 return json(req,{status:'submitted'},201)
})
