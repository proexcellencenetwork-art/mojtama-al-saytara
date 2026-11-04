import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, MessageCircle, Plus, Search, Send, Users } from 'lucide-react'
import { Link } from 'react-router-dom'

type DemoContact = { id: string; name: string; headline: string; initial: string }
type DemoMessage = { id: string; contactId: string; sender: 'me'; body: string; createdAt: string }
type DemoGroup = { id: string; name: string; topic: string; description: string; visibility: 'public' | 'private'; joined: boolean; owner: boolean; pending?: boolean }
const contacts: DemoContact[] = [
  { id: 'sample-1', name: 'عضو تجريبي ١', headline: 'مهتم بالتطوير المهني', initial: '١' },
  { id: 'sample-2', name: 'عضو تجريبي ٢', headline: 'مجال الصحة والابتكار', initial: '٢' },
  { id: 'sample-3', name: 'عضو تجريبي ٣', headline: 'البحث والتعاون العلمي', initial: '٣' },
]
const starterGroups: DemoGroup[] = [
  { id: 'group-career', name: 'بدايات مهنية', topic: 'تطوير مهني', description: 'مساحة لتبادل الخبرات والأسئلة العملية في بدايات المسار.', visibility: 'public', joined: false, owner: false },
  { id: 'group-health', name: 'ممارسات صحية', topic: 'الصحة', description: 'نقاشات مهنية عامة حول بيئات العمل الصحية والتطوير.', visibility: 'public', joined: true, owner: false },
  { id: 'group-innovation', name: 'الابتكار والبحث', topic: 'ابتكار وبحث', description: 'مساحة للأفكار والتعاون وتبادل المعرفة بصورة مسؤولة.', visibility: 'private', joined: false, owner: false },
]
function readLocal<T>(key: string, fallback: T): T { try { const value=localStorage.getItem(key); return value?JSON.parse(value) as T:fallback } catch { return fallback } }
function saveLocal(key: string, value: unknown) { try { localStorage.setItem(key,JSON.stringify(value)) } catch { /* Local preview remains usable for this session. */ } }
function stamp(value: string) { return new Date(value).toLocaleString('ar',{dateStyle:'short',timeStyle:'short'}) }

export function DemoMessagesPage() {
 const [activeId,setActiveId]=useState(()=>new URLSearchParams(window.location.search).get('to')||contacts[0].id)
 const [messages,setMessages]=useState<DemoMessage[]>(()=>readLocal('saytara-demo-private-messages',[]))
 const [draft,setDraft]=useState('')
 const [query,setQuery]=useState('')
 const activeContact=contacts.find(person=>person.id===activeId)||contacts[0]
 const visibleContacts=useMemo(()=>contacts.filter(person=>(person.name+' '+person.headline).includes(query.trim())),[query])
 const thread=messages.filter(message=>message.contactId===activeId).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))
 useEffect(()=>{saveLocal('saytara-demo-private-messages',messages)},[messages])
 function send(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const body=draft.trim();if(!body||body.length>2000)return;setMessages(current=>[...current,{id:crypto.randomUUID(),contactId:activeId,sender:'me',body,createdAt:new Date().toISOString()}]);setDraft('')}
 return <main className="app-main wrap member-workspace-page">
  <header className="member-page-heading"><div><span className="eyebrow">تواصل مباشر</span><h1>محادثاتك</h1><p>كل محادثة بينك وبين شخص واحد فقط. افتح اسم الشخص واكتب له مباشرة.</p></div><Link className="btn btn-outline" to="/discover">اكتشف الأعضاء <ArrowLeft size={15}/></Link></header>
  <div className="demo-data-note" role="note">وضع تجربة محلي: الأسماء والمحادثات هنا أمثلة غير مرتبطة بأعضاء حقيقيين، وتحفظ على هذا الجهاز فقط.</div>
  <section className="messenger-shell">
   <aside className="messenger-people" aria-label="قائمة المحادثات"><div className="messenger-list-heading"><b>الأشخاص</b><span>{contacts.length}</span></div>
    <label className="member-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث في المحادثات" aria-label="البحث في المحادثات"/></label>
    <div className="messenger-contact-list">{visibleContacts.map(person=>{const last=messages.filter(message=>message.contactId===person.id).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];return <button type="button" className={'messenger-contact '+(activeId===person.id?'is-active':'')} key={person.id} onClick={()=>setActiveId(person.id)}><span className="messenger-avatar">{person.initial}</span><span className="messenger-contact-copy"><b>{person.name}</b><small>{last?.body||person.headline}</small></span>{activeId===person.id&&<span className="messenger-active-dot" aria-label="المحادثة المحددة"/>}</button>})}{visibleContacts.length===0&&<p className="member-empty-hint">لا توجد نتائج بهذا الاسم.</p>}</div>
   </aside>
   <section className="messenger-thread" aria-label={'محادثة '+activeContact.name}>
    <header className="messenger-thread-head"><span className="messenger-avatar">{activeContact.initial}</span><div><b>{activeContact.name}</b><small>{activeContact.headline} · محادثة تجريبية فردية</small></div></header>
    <div className="messenger-thread-body" aria-live="polite">{thread.length===0?<div className="messenger-empty"><MessageCircle size={26}/><b>ابدأ المحادثة</b><span>اكتب تحية بسيطة أو سؤالاً مهنياً. لا تحتاج إلى صياغة خطاب رسمي.</span></div>:thread.map(message=><article className="message-bubble message-mine" key={message.id}><p>{message.body}</p><time>{stamp(message.createdAt)}</time></article>)}</div>
    <form className="messenger-compose" onSubmit={send}><input value={draft} onChange={event=>setDraft(event.target.value)} maxLength={2000} placeholder={'اكتب رسالة قصيرة إلى '+activeContact.name+'…'} aria-label="نص الرسالة"/><button type="submit" className="btn btn-primary" disabled={!draft.trim()}><Send size={16}/> إرسال</button></form>
   </section>
  </section>
  <p className="member-privacy-hint">لا تشارك بيانات المرضى أو معلومات العمل السرية في الرسائل.</p>
 </main>
}

export function DemoGroupsPage() {
 const [groups,setGroups]=useState<DemoGroup[]>(()=>readLocal('saytara-demo-groups',starterGroups))
 const [query,setQuery]=useState('')
 const [filter,setFilter]=useState<'all'|'joined'|'available'>('all')
 const [creating,setCreating]=useState(false)
 const [name,setName]=useState('')
 const [topic,setTopic]=useState('')
 const [description,setDescription]=useState('')
 const [visibility,setVisibility]=useState<'public'|'private'>('public')
 const [notice,setNotice]=useState('')
 useEffect(()=>{saveLocal('saytara-demo-groups',groups)},[groups])
 const visible=groups.filter(group=>(filter==='all'||(filter==='joined'?group.joined:!group.joined))&&(group.name+' '+group.topic+' '+group.description).toLocaleLowerCase('ar').includes(query.trim().toLocaleLowerCase('ar')))
 function createGroup(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(name.trim().length<2)return;const group:DemoGroup={id:crypto.randomUUID(),name:name.trim(),topic:topic.trim()||'عام',description:description.trim(),visibility,joined:true,owner:true};setGroups(current=>[group,...current]);setName('');setTopic('');setDescription('');setVisibility('public');setCreating(false);setNotice('أُنشئت المجموعة في مساحة التجربة على هذا الجهاز.')}
 return <main className="app-main wrap member-workspace-page">
  <header className="member-page-heading"><div><span className="eyebrow">مجتمعات متخصصة</span><h1>المجموعات</h1><p>انضم لمساحة قريبة من اهتمامك أو أنشئ مجموعة صغيرة حول موضوع واضح.</p></div><button className="btn btn-primary" type="button" onClick={()=>setCreating(value=>!value)}><Plus size={16}/>{creating?'إغلاق':'إنشاء مجموعة'}</button></header>
  <div className="demo-data-note" role="note">وضع تجربة محلي: المجموعات هنا أمثلة للتجربة، وأي مجموعة تنشئها تُحفظ على هذا الجهاز فقط.</div>
  {notice&&<div className="inline-message" role="status">{notice}</div>}
  {creating&&<form className="member-create-group" onSubmit={createGroup}><div className="form-grid"><label>اسم المجموعة<input value={name} onChange={event=>setName(event.target.value)} maxLength={100} minLength={2} required placeholder="مثال: تطوير المسار المهني"/></label><label>الموضوع<input value={topic} onChange={event=>setTopic(event.target.value)} maxLength={80} placeholder="تطوير مهني، صحة، ابتكار…"/></label><label className="full-field">وصف مختصر<textarea value={description} onChange={event=>setDescription(event.target.value)} maxLength={600} placeholder="ما الذي سيناقشه أعضاء المجموعة؟"/></label><label>نوع المجموعة<select value={visibility} onChange={event=>setVisibility(event.target.value as 'public'|'private')}><option value="public">مفتوحة</option><option value="private">خاصة بطلب انضمام</option></select></label></div><button className="btn btn-primary" disabled={name.trim().length<2}>إنشاء المجموعة</button></form>}
  <div className="member-toolbar"><label className="member-search"><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="ابحث عن مجموعة أو موضوع" aria-label="البحث عن مجموعة"/></label><div className="member-filter-tabs"><button type="button" className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>الكل</button><button type="button" className={filter==='joined'?'selected':''} onClick={()=>setFilter('joined')}>مجموعاتي</button><button type="button" className={filter==='available'?'selected':''} onClick={()=>setFilter('available')}>متاحة للانضمام</button></div></div>
  <section className="member-group-grid">{visible.map(group=><article className="member-group-card" key={group.id}><span className="member-group-symbol"><Users size={20}/></span><span className="member-group-topic">{group.topic}</span><h2>{group.name}</h2><p>{group.description}</p><div className="member-group-footer"><span>{group.visibility==='public'?'مفتوحة':'خاصة بطلب انضمام'}</span>{group.owner?<span className="member-group-state"><Check size={14}/> أنت منشئ المجموعة</span>:group.joined?<button type="button" className="btn btn-outline btn-small" onClick={()=>setGroups(current=>current.map(item=>item.id===group.id?{...item,joined:false}:item))}>مغادرة</button>:group.pending?<button type="button" className="btn btn-outline btn-small" onClick={()=>setGroups(current=>current.map(item=>item.id===group.id?{...item,pending:false}:item))}>إلغاء الطلب</button>:<button type="button" className="btn btn-primary btn-small" onClick={()=>setGroups(current=>current.map(item=>item.id===group.id?item.visibility==='public'?{...item,joined:true}:{...item,pending:true}:item))}>{group.visibility==='public'?'انضمام':'طلب الانضمام'}</button>}</div></article>)}</section>
  {visible.length===0&&<div className="member-empty-state"><Users size={26}/><b>لا توجد مجموعات مطابقة</b><span>جرّب البحث بكلمة مختلفة أو أنشئ مجموعة جديدة.</span></div>}
 </main>
}

export function DemoConnectionsPage() {
 return <main className="app-main wrap member-workspace-page">
  <header className="member-page-heading"><div><span className="eyebrow">شبكتك المهنية</span><h1>اتصالاتك</h1><p>افتح محادثة فردية مع أي جهة اتصال تجريبية.</p></div><Link className="btn btn-outline" to="/discover">اكتشف الأعضاء <ArrowLeft size={15}/></Link></header>
  <div className="demo-data-note" role="note">وضع تجربة محلي: هذه بطاقات توضيحية وليست ملفات أعضاء حقيقيين.</div>
  <section className="member-connections-grid">{contacts.map(person=><article className="member-connection-card" key={person.id}><span className="messenger-avatar">{person.initial}</span><div><h2>{person.name}</h2><p>{person.headline}</p></div><Link className="btn btn-primary btn-small" to={'/messages?to='+person.id}><MessageCircle size={15}/> تواصل</Link></article>)}</section>
 </main>
}
