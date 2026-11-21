(() => {
const KEY='activeProjectsPortal_v1';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const today=()=>new Date().toISOString().slice(0,10);
const seed=()=>({
 users:[{id:'u-super',name:'Super Admin',password:'Admin123!',role:'superadmin',status:'approved',created:today(),email:'superadmin@school.local'},
 {id:'u-admin',name:'School Admin',password:'Admin123!',role:'admin',status:'approved',created:today(),email:'admin@school.local'}],
 projects:[
 {id:'p-pedal',name:'Project Pedal',category:'Student Assistance',description:'A bicycle assistance program to help eligible students with transportation to and from school.',requirements:'Currently enrolled student; demonstrate transportation need; submit the required supporting documents.',documents:'Proof of enrollment, application form',slots:12,deadline:'2026-12-15',status:'published',created:today()},
 {id:'p-salamin',name:'Project Salamin',category:'Health & Wellness',description:'Vision screening and eyeglasses assistance for students who meet the program criteria.',requirements:'Currently enrolled student; vision concern confirmed through screening; meet program eligibility criteria.',documents:'Proof of enrollment, vision screening result',slots:20,deadline:'2026-12-20',status:'published',created:today()},
 {id:'p-tulong',name:'Student Financial Assistance',category:'Financial Assistance',description:'Financial assistance for eligible students based on the school’s published assessment criteria.',requirements:'Currently enrolled student; meet the published household-income and assessment requirements.',documents:'Proof of enrollment, household income documents',slots:8,deadline:'2026-12-10',status:'published',created:today()}],
 applications:[],notifications:[],logs:[{id:uid(),at:new Date().toISOString(),actor:'System',action:'Demo portal initialized'}]
});
let db, current=null, page='dashboard', authMode='login', searchText='', filterStatus='all';
try{db=JSON.parse(localStorage.getItem(KEY))||seed()}catch(e){db=seed()}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){}}
function log(action){db.logs.unshift({id:uid(),at:new Date().toISOString(),actor:current?.name||'System',actorId:current?.id||null,actorRole:current?.role||'system',action});db.logs=db.logs.slice(0,300);save()}
function notify(userId,title,message){db.notifications.unshift({id:uid(),userId,title,message,at:new Date().toISOString(),read:false});save()}
function askConfirm(msg,fn){modal(`<div class="modalhead"><h2>Please confirm</h2></div><p>${esc(msg)}</p><div class="actions"><button class="primary" id="cfyes">Confirm</button><button class="ghost" id="cfno">Cancel</button></div>`);$('#cfyes').onclick=()=>{closeModal();fn()};$('#cfno').onclick=closeModal}
function toast(msg){$('#toastroot').innerHTML=`<div class="toast">${esc(msg)}</div>`;setTimeout(()=>$('#toastroot').innerHTML='',3000)}
function roleLabel(role){return ({superadmin:'Super Admin',admin:'Admin / School Personnel',student:'Student'})[role]||role}
function statusTag(s){return `<span class="tag ${esc(String(s).toLowerCase().replace(/[^a-z]/g,''))}">${esc(s)}</span>`}
function fmtDate(d){if(!d)return '—';return new Date(d+'T00:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function fmtTime(d){return new Date(d).toLocaleString()}
function initials(n){return (n||'U').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}
const LOGO='school-logo.png';
const GRADES=['Grade 11','Grade 12'],STRANDS=['ABM','STEM','HUMSS','TVL ICT','TVL HE','TVL Automotive'];
const nameKey=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();

// --- Production API Bridge (auto-activates when PHP backend + config.php are configured) ---
let apiMode = false, csrfToken = '', pageNum = { users: 1, applications: 1, audit: 1 }, sortDir = { applications: 'desc', users: 'desc' };
const PAGE_SIZE = 10;

async function apiReq(path, opts = {}) {
  const method = (opts.method || 'GET').toUpperCase();
  const headers = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;
  const res = await fetch('api/' + path, { ...opts, method, headers, credentials: 'same-origin' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function syncFromApi() {
  try {
    const me = await apiReq('auth.php?action=me');
    apiMode = true;
    csrfToken = me.csrf || '';
    if (me.user) {
      current = me.user;
      const [pRes, aRes, nRes] = await Promise.all([
        apiReq('projects.php'),
        apiReq('applications.php?limit=100'),
        apiReq('notifications.php')
      ]);
      db.projects = (pRes.projects || []).map(p => ({
        id: String(p.id), name: p.name, category: p.category, description: p.description,
        requirements: p.eligibility_requirements, documents: p.required_documents,
        slots: Number(p.total_slots), deadline: p.deadline || '', status: p.status
      }));
      db.applications = (aRes.applications || []).map(a => ({
        id: String(a.id), studentId: String(a.student_id), studentName: a.student_name || current.name,
        studentEmail: a.student_email || '', projectId: String(a.project_id), reason: a.reason,
        notes: a.additional_notes || '', status: a.status, submitted: a.submitted_at,
        reviewedAt: a.reviewed_at || '', reviewNote: a.review_note || '', reviewer: a.reviewer_name || ''
      }));
      db.notifications = (nRes.notifications || []).map(n => ({
        id: String(n.id), userId: String(current.id), title: n.title, message: n.message,
        at: n.created_at, read: Boolean(Number(n.is_read))
      }));
      if (current.role === 'admin' || current.role === 'superadmin') {
        const uRes = await apiReq('admin-users.php?limit=100');
        db.users = (uRes.users || []).map(u => ({
          id: String(u.id), name: u.full_name, email: u.email, lrn: u.lrn || '',
          grade: u.grade_level || '', section: u.section || '', strand: u.strand || '',
          role: u.role, status: u.account_status, created: (u.created_at || '').slice(0, 10)
        }));
      }
    }
  } catch (_) {
    apiMode = false; // Falls back cleanly to localStorage prototype if config.php / MySQL isn't set up yet
  }
  render();
}

function checkPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 10) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (!pw) return { label: '', cls: '', pct: 0 };
  if (score <= 2) return { label: 'Weak (use 10+ chars, uppercase, number & symbol)', cls: 'pw-weak', pct: 33 };
  if (score <= 3) return { label: 'Fair (add uppercase, number, or symbol)', cls: 'pw-fair', pct: 66 };
  return { label: 'Strong password', cls: 'pw-strong', pct: 100 };
}

window.updatePwMeter = inp => {
  const meter = inp.closest('.field')?.querySelector('.pw-meter');
  if (!meter) return;
  const st = checkPasswordStrength(inp.value);
  meter.innerHTML = inp.value
    ? `<div class="pw-bar"><div class="pw-fill ${st.cls}" style="width:${st.pct}%"></div></div><small class="${st.cls}">${st.label}</small>`
    : '';
};

window.maskLrnInput = inp => {
  inp.value = inp.value.replace(/\D/g, '').slice(0, 12);
  const counter = inp.closest('.field')?.querySelector('.lrn-count');
  if (counter) counter.textContent = `${inp.value.length} / 12 digits`;
};

function paginateList(items, key) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(Math.max(1, pageNum[key] || 1), totalPages);
  pageNum[key] = cur;
  const start = (cur - 1) * PAGE_SIZE;
  return { slice: items.slice(start, start + PAGE_SIZE), page: cur, totalPages, total };
}

window.setPageNum = (key, p) => { pageNum[key] = p; renderPage(); };
window.toggleSort = key => { sortDir[key] = sortDir[key] === 'asc' ? 'desc' : 'asc'; renderPage(); };

function pagerBar(key, meta) {
  if (meta.total <= PAGE_SIZE) return '';
  return `<div class="pager"><span class="muted">Showing page <b>${meta.page}</b> of <b>${meta.totalPages}</b> (${meta.total} total records)</span><div class="actions"><button class="ghost small" ${meta.page <= 1 ? 'disabled' : ''} onclick="setPageNum('${key}', ${meta.page - 1})">← Previous</button><button class="ghost small" ${meta.page >= meta.totalPages ? 'disabled' : ''} onclick="setPageNum('${key}', ${meta.page + 1})">Next →</button></div></div>`;
}

function schoolFields(){return `<div class="formsec">Your school details</div><div class="field"><label style="display:flex;justify-content:space-between"><span>LRN (Learner Reference Number)</span><span class="muted lrn-count" style="font-weight:500;font-size:12px">0 / 12 digits</span></label><input name="lrn" required inputmode="numeric" pattern="[0-9]{12}" maxlength="12" placeholder="12-digit LRN" title="Enter your 12-digit LRN" oninput="maskLrnInput(this)"></div><div class="formgrid"><div class="field"><label>Grade level</label><select name="grade" required><option value="">Select grade</option>${GRADES.map(g=>`<option>${g}</option>`).join('')}</select></div><div class="field"><label>Section</label><input name="section" required placeholder="e.g. Rizal"></div></div><div class="field"><label>Strand</label><select name="strand" required><option value="">Select strand</option>${STRANDS.map(x=>`<option>${x}</option>`).join('')}</select></div>`}
function stuInfo(u){if(!u||u.role!=='student'||!u.grade)return '';return [u.grade,u.section&&('Section '+u.section),u.strand].filter(Boolean).join(', ')}
function classLine(a){const s=db.users.find(u=>u.id===a.studentId);return s&&s.lrn?'LRN '+s.lrn+(stuInfo(s)?' — '+stuInfo(s):''):''}
function approvedApp(uid){return db.applications.find(a=>a.studentId===uid&&a.status==='Approved')}
function blockReason(uid,pid){const ap=approvedApp(uid);if(ap)return ap.projectId===pid?'Your application for this project is already approved.':'You are already approved for a project, so you cannot apply to another one.';if(db.applications.some(a=>a.studentId===uid&&a.projectId===pid&&a.status!=='Rejected'))return 'You have already applied to this project.';return ''}
function activeProjects(){return db.projects.filter(p=>p.status==='published'&&(!p.deadline||p.deadline>=today()))}
function usedSlots(projectId){return db.applications.filter(a=>a.projectId===projectId&&a.status==='Approved').length}
function availableSlots(p){return Math.max(0,Number(p.slots||0)-usedSlots(p.id))}
function userApps(userId){return db.applications.filter(a=>a.studentId===userId)}
function appProject(a){return db.projects.find(p=>p.id===a.projectId)}
function showLogin(){current=null;render()}
function render(){if(!current){renderAuth();return}renderShell()}
function guestItems(){return db.projects.filter(p=>p.status==='published').filter(p=>(p.name+' '+(p.category||'')+' '+p.description).toLowerCase().includes(searchText.toLowerCase()))}
function guestCards(items){if(!items.length)return empty('No projects found','Try a different search, or check back later.');return `<div class="projectgrid">${items.map(p=>`<article class="project"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">${availableSlots(p)>0?'<span class="tag published">Open for applications</span>':'<span class="tag rejected">No slots left</span>'}<span class="muted" style="font-size:12px">${esc(p.category||'School project')}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="meta"><div>📅 Deadline: <b>${fmtDate(p.deadline)}</b></div><div>🎟 Available slots: <b>${availableSlots(p)}</b> / ${Number(p.slots||0)}</div><div>📄 Requirements: ${esc(p.requirements)}</div><div>📎 Documents: ${esc(p.documents||'None specified')}</div></div><div class="bottom"><button class="primary" onclick="setAuth('signup')">Create account to apply</button></div></article>`).join('')}</div>`}
window.guestSearch=v=>{searchText=v;$('#guestlist').innerHTML=guestCards(guestItems())};
function renderGuest(){$('#app').innerHTML=`<header class="topbar"><div class="brand"><img class="logo" src="${LOGO}" alt="San Jose-Litex Senior High School logo">School Project Portal</div><div class="top-actions"><button class="ghost small" onclick="setAuth('login')">Sign in</button><button class="primary small" onclick="setAuth('signup')">Create account</button></div></header><main style="max-width:1200px;margin:auto"><div class="pagehead"><div><h1>Available projects</h1><p>See which school projects are open, what each one requires, and the deadline. You don’t need an account to look.</p></div></div><div class="panel"><b>How to apply</b><div class="howto" style="margin-top:10px"><div><b>1. Pick a project</b><span>Read the requirements and documents below.</span></div><div><b>2. Create a student account</b><span>Then wait for the school admin to approve it.</span></div><div><b>3. Sign in and apply</b><span>Each student can be approved for one project only.</span></div></div></div><div class="toolbar"><input placeholder="Search projects..." value="${esc(searchText)}" oninput="guestSearch(this.value)"></div><div id="guestlist">${guestCards(guestItems())}</div></main>`}
function renderAuth(){if(authMode==='browse'){renderGuest();return}const app=$('#app');app.innerHTML=`<div class="authscreen"><section class="authhero"><div class="herobrand"><img class="logo" src="${LOGO}" alt="San Jose-Litex Senior High School logo"><span>San Jose-Litex<br>Senior High School<small class="school-id">School ID: 342566</small></span></div><div class="hero-badge">● SCHOOL PROJECT PORTAL</div><h1>Find support.<br>Apply with confidence.</h1><p>A simple place to discover active school projects, check eligibility, submit applications, and follow updates.</p><button class="ghost" style="width:max-content;margin-top:20px" onclick="setAuth('browse')">Browse available projects</button><div class="featurelist"><div>✓ Clear project requirements and deadlines</div><div>✓ Online applications and status tracking</div><div>✓ Secure role-specific access for school personnel</div></div></section><section class="authside"><div class="authbox"><h2>${authMode==='login'?'Welcome back':'Create student account'}</h2><p>${authMode==='login'?'Sign in to continue to your workspace.':'Register to explore available school projects.'}</p><div class="authswitch"><button class="${authMode==='login'?'active':''}" onclick="setAuth('login')">Sign in</button><button class="${authMode==='signup'?'active':''}" onclick="setAuth('signup')">Student sign up</button></div><form id="authform">${authMode==='signup'?`<div class="field"><label>Full name <span class="muted">(used to sign in)</span></label><input name="name" required placeholder="e.g. Juan Dela Cruz"></div><div class="field"><label>Email address</label><input name="email" type="email" required placeholder="you@example.com"></div>${schoolFields()}`:''}${authMode==='login'?`<div class="field"><label>Full name</label><input name="name" required autocomplete="name" placeholder="Enter your full name"></div>`:''}<div class="field"><label style="display:flex;justify-content:space-between"><span>Password</span>${authMode==='login'?`<a href="#" onclick="openForgotPasswordModal();return false" style="font-size:12.5px;color:var(--brand-dark);font-weight:600">Forgot password?</a>`:''}</label><div class="pwwrap"><input name="password" type="password" required autocomplete="${authMode==='login'?'current-password':'new-password'}" placeholder="${authMode==='signup'?'At least 10 characters':'Enter password'}" minlength="${authMode==='signup'?10:6}" ${authMode==='signup'?'oninput="updatePwMeter(this)"':''}><button type="button" class="pwtoggle" onclick="togglePw(this)" aria-label="Show password">Show</button></div>${authMode==='signup'?'<div class="pw-meter"></div>':''}</div>${authMode==='signup'?`<div class="notice">New student accounts require school personnel approval before you can access the student dashboard.</div>`:''}<button class="primary" style="width:100%" type="submit">${authMode==='login'?'Sign in':'Submit registration'}</button></form><button class="ghost" style="width:100%;margin-top:14px" onclick="setAuth('browse')">Just looking? See available projects</button><div class="authfoot">For security, admin and Super Admin accounts are provisioned by the Super Admin. Do not share your password.</div><div class="notice warn">Prototype security notice: this version uses browser storage, not a protected server database. Use sample data only.</div><div class="demo"><b>Demo login accounts (sign in with full name)</b>Super Admin: <code>Super Admin</code> / <code>Admin123!</code><br>Admin: <code>School Admin</code> / <code>Admin123!</code><br><span class="muted">Prototype only — data is stored in this browser. Do not enter real student information until a secure backend is installed.</span></div></div></section></div>`;
$('#authform').addEventListener('submit',authSubmit)}
window.setAuth=m=>{authMode=m;if(m==='browse')searchText='';renderAuth()};
window.togglePw=b=>{const i=b.previousElementSibling,show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Hide':'Show';b.setAttribute('aria-label',show?'Hide password':'Show password')};
function authSubmit(e){e.preventDefault();const f=new FormData(e.target),key=nameKey(f.get('name')),password=String(f.get('password'));
if(authMode==='signup'){const name=String(f.get('name')||'').trim().replace(/\s+/g,' '),email=String(f.get('email')).trim(),lrn=String(f.get('lrn')||'').trim(),grade=String(f.get('grade')||''),section=String(f.get('section')||'').trim(),strand=String(f.get('strand')||'');if(db.users.some(u=>nameKey(u.name)===key)){toast('That full name is already registered.');return}if(!key||!name){toast('Please complete all required fields.');return}if(!/^\d{12}$/.test(lrn)){toast('LRN must be exactly 12 digits.');return}if(db.users.some(x=>x.lrn===lrn)){toast('That LRN is already registered.');return}if(!grade||!section){toast('Please enter your grade level and section.');return}if(!strand){toast('Please select your strand.');return}const u={id:uid(),name,email,password,role:'student',status:'pending',created:today(),lrn,grade,section,strand};db.users.push(u);db.users.filter(x=>x.role==='admin'||x.role==='superadmin').forEach(x=>notify(x.id,'Student account awaiting approval',`${name} registered and is awaiting account approval.`));log(`Student account registration submitted: ${name}`);save();authMode='login';renderAuth();toast('Registration submitted. Please wait for account approval.');return}
const u=db.users.find(x=>nameKey(x.name)===key&&x.password===password);if(!u){toast('Incorrect full name or password.');return}if(u.status!=='approved'){toast(u.status==='pending'?'Your account is awaiting approval.':'This account is not active. Contact the school administrator.');return}current=u;page='dashboard';log('Signed in');render()}
function renderShell(){const role=current.role;const nav=role==='superadmin'?[['dashboard','🏠','Overview'],['users','👥','User & Admin Accounts'],['projects','📁','Project Management'],['applications','📝','Applications'],['reports','📊','Reports'],['notifications','🔔','Notifications'],['audit','📋','Audit Log']]:role==='admin'?[['dashboard','🏠','Overview'],['users','👥','Student Accounts'],['projects','📁','Project Management'],['applications','📝','Review Applications'],['reports','📊','Reports'],['notifications','🔔','Notifications'],['audit','📋','Activity Log']]:[['dashboard','🏠','My Dashboard'],['projects','📁','Browse Projects'],['myapps','📝','My Applications'],['notifications','🔔','Notifications']];
const labels={dashboard:'Overview',users:role==='superadmin'?'User & Admin Accounts':'Student Accounts',projects:'Project Management',applications:'Applications',reports:'Reports',myapps:'My Applications',notifications:'Notifications',audit:'Audit Log'};
$('#app').innerHTML=`<div class="shell"><header class="topbar"><div style="display:flex;align-items:center;gap:12px"><button class="ghost mobilemenu" onclick="document.querySelector('.layout').classList.toggle('menuopen')">☰</button><div class="brand"><img class="logo" src="${LOGO}" alt="San Jose-Litex Senior High School logo"><span>Active Projects <span class="muted" style="font-weight:500">Portal</span></span></div></div><div class="top-actions"><button class="ghost small" onclick="go('notifications')">🔔 <span class="userlabel">Notifications</span> ${unreadCount()?`<b>(${unreadCount()})</b>`:''}</button><div class="avatar">${esc(initials(current.name))}</div><div class="userlabel"><b>${esc(current.name)}</b><div class="muted" style="font-size:11px">${esc(roleLabel(role))}</div></div><button class="ghost small" onclick="logout()">Sign out</button></div></header><div class="layout"><aside><div class="side-label">Workspace</div>${nav.map(([id,icon,label])=>`<button class="navbtn ${page===id?'active':''}" onclick="go('${id}')"><span>${icon}</span><span>${label}</span>${id==='notifications'&&unreadCount()?`<span class="pillcount">${unreadCount()}</span>`:''}</button>`).join('')}<div class="side-label" style="margin-top:22px">Signed in as</div><div style="padding:8px 12px"><b>${esc(current.name)}</b><div class="muted" style="font-size:12px;margin-top:4px">${esc(roleLabel(role))}</div>${stuInfo(current)?`<div class="muted" style="font-size:12px;margin-top:2px">${esc(stuInfo(current))}</div>`:''}<button class="ghost small" style="margin-top:10px;width:100%" onclick="openChangePasswordModal()">🔑 Change password</button></div></aside><main id="maincontent"></main></div></div>`;
renderPage()}
window.go=id=>{page=id;renderShell()};
window.logout=()=>{log('Signed out');current=null;authMode='login';renderAuth()};
function unreadCount(){return db.notifications.filter(n=>n.userId===current?.id&&!n.read).length}
function stat(label,n,sub){return `<div class="stat"><div class="label">${label}</div><div class="number">${n}</div><div class="sub">${sub||''}</div></div>`}
function head(title,desc,action=''){return `<div class="pagehead"><div><h1>${title}</h1><p>${desc}</p></div>${action}</div>`}
function renderPage(){const m=$('#maincontent');if(!m)return;switch(page){case'dashboard':m.innerHTML=dashboard();break;case'projects':m.innerHTML=projectsPage();break;case'users':m.innerHTML=usersPage();break;case'applications':m.innerHTML=applicationsPage();break;case'reports':m.innerHTML=reportsPage();break;case'myapps':m.innerHTML=myAppsPage();break;case'notifications':m.innerHTML=notificationsPage();break;case'audit':m.innerHTML=auditPage();break;default:m.innerHTML=dashboard()}}
function dashboard(){if(current.role==='student'){const apps=userApps(current.id),projs=activeProjects(),unread=unreadCount();return head(`Hello, ${esc(current.name.split(' ')[0])} 👋`,'Here is your school project activity at a glance.',`<button class="primary" onclick="go('projects')">Browse projects →</button>`)+`<div class="cards">${stat('Available projects',projs.length,'Currently open for applications')}${stat('Applications submitted',apps.length,'All your project applications')}${stat('Awaiting review',apps.filter(a=>a.status==='Pending').length,'Pending decisions')}${stat('Unread notifications',unread,'Updates from the school')}</div><div class="panel"><div class="panelhead"><h2>Recently updated applications</h2><button class="ghost small" onclick="go('myapps')">View all</button></div>${apps.length?tableApps(apps.slice().reverse().slice(0,5),false):empty('No applications yet','Explore projects and submit your first application.')}</div><div class="panel"><div class="panelhead"><h2>Open school projects</h2><button class="ghost small" onclick="go('projects')">Browse all</button></div>${projectCards(projs.slice(0,3),true)}</div>`}
const isSuper=current.role==='superadmin',pendingUsers=db.users.filter(u=>u.role==='student'&&u.status==='pending').length,pendingApps=db.applications.filter(a=>a.status==='Pending').length,open=activeProjects().length;
return head(isSuper?'System overview':'School personnel dashboard','Manage active school projects and student applications.',isSuper?`<button class="primary" onclick="openUserModal()">＋ Create account</button>`:`<button class="primary" onclick="openProjectModal()">＋ Add project</button>`)+`<div class="cards">${stat('Published projects',open,'Visible to eligible students')}${stat('Pending applications',pendingApps,'Waiting for review')}${stat('Pending student accounts',pendingUsers,'Awaiting account approval')}${stat('Total students',db.users.filter(u=>u.role==='student').length,'Registered student accounts')}</div><div class="panel"><div class="panelhead"><h2>Needs your attention</h2></div>${pendingUsers||pendingApps?`<div style="display:flex;gap:10px;flex-wrap:wrap">${pendingUsers?`<button class="secondary" onclick="go('users')">Review ${pendingUsers} account registration(s)</button>`:''}${pendingApps?`<button class="secondary" onclick="go('applications')">Review ${pendingApps} application(s)</button>`:''}</div>`:`<div class="notice success">You're all caught up. No pending account approvals or applications.</div>`}</div><div class="panel"><div class="panelhead"><h2>Recently submitted applications</h2><button class="ghost small" onclick="go('applications')">Open application queue</button></div>${db.applications.length?tableApps(db.applications.slice().sort((a,b)=>b.submitted.localeCompare(a.submitted)).slice(0,5),true):empty('No applications yet','Student submissions will appear here.')}</div><div class="panel"><div class="panelhead"><h2>Project status</h2><button class="ghost small" onclick="go('projects')">Manage projects</button></div>${projectTable(db.projects.slice(0,5))}</div>`}
function empty(title,desc){return `<div class="empty"><strong>${title}</strong>${desc||''}</div>`}
function projectCards(items,studentMode){if(!items.length)return empty('No projects found','Try again later or adjust your search.');return `<div class="projectgrid">${items.map(p=>`<article class="project"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center">${statusTag(p.status)}<span class="muted" style="font-size:11px">${esc(p.category||'School project')}</span></div><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="meta"><div>📅 Deadline: <b>${fmtDate(p.deadline)}</b></div><div>🎟 Available slots: <b>${availableSlots(p)}</b> / ${Number(p.slots||0)}</div><div>📄 Requirements: ${esc(p.requirements)}</div><div>📎 Documents: ${esc(p.documents||'None specified')}</div></div><div class="bottom">${studentMode?`<button class="primary" onclick="applyProject('${p.id}')" ${availableSlots(p)<=0||blockReason(current.id,p.id)?'disabled':''}>${approvedApp(current.id)?(approvedApp(current.id).projectId===p.id?'Approved ✓':'Not available'):blockReason(current.id,p.id)?'Already applied':availableSlots(p)<=0?'No slots left':db.applications.some(a=>a.studentId===current.id&&a.projectId===p.id)?'Apply again':'Apply now'}</button>`:`<div class="actions"><button class="secondary small" onclick="openProjectModal('${p.id}')">Edit</button><button class="ghost small" onclick="viewApprovedApplicants('${p.id}')">Approved (${usedSlots(p.id)})</button><button class="ghost small" onclick="toggleProject('${p.id}')">${p.status==='published'?'Unpublish':'Publish'}</button><button class="ghost small" onclick="archiveProject('${p.id}')">Archive</button></div>`}</div></article>`).join('')}</div>`}
window.viewApprovedApplicants=id=>{if(!current||current.role==='student')return;const p=db.projects.find(x=>x.id===id);if(!p)return;const approved=db.applications.filter(a=>a.projectId===id&&a.status==='Approved').sort((a,b)=>(a.studentName||'').localeCompare(b.studentName||''));const rows=approved.map(a=>{const s=db.users.find(u=>u.id===a.studentId);return `<tr><td><b>${esc(a.studentName)}</b><div class="muted">${esc(a.studentEmail||'')}</div></td><td>${esc(stuInfo(s)||'—')}</td><td>${esc(s?.lrn||'—')}</td><td>${fmtDate((a.reviewedAt||a.submitted||'').slice(0,10))}</td><td><button class="secondary small" onclick="viewApplication('${a.id}')">View</button></td></tr>`}).join('');modal(`<div class="modalhead"><div><h2>${esc(p.name)} — Approved applicants</h2><div class="muted">${approved.length} approved of ${Number(p.slots||0)} slots</div></div><button class="ghost small" onclick="closeModal()">✕</button></div>${approved.length?`<div class="tablewrap"><table><thead><tr><th>Student</th><th>Grade / Section / Strand</th><th>LRN</th><th>Approved date</th><th>Details</th></tr></thead><tbody>${rows}</tbody></table></div>`:empty('No approved applicants yet','Approved students for this project will appear here.')}`)};
function projectsPage(){const student=current.role==='student',items=db.projects.filter(p=>student?p.status==='published':true).filter(p=>(p.name+' '+p.category+' '+p.description).toLowerCase().includes(searchText.toLowerCase())).filter(p=>filterStatus==='all'||p.status===filterStatus);return head(student?'Browse school projects':'Project management',student?'Review the eligibility criteria before applying.':'Create and maintain project listings, requirements, deadlines, and available slots.',!student?`<button class="primary" onclick="openProjectModal()">＋ Add project</button>`:'')+(!student?`<div class="notice">Publish accurate eligibility criteria and required documents. Students will see published projects and current slot counts.</div>`:`<div class="notice">Please check eligibility, required documents, and the deadline before applying. Submitting an application does not guarantee selection.</div>${approvedApp(current.id)?`<div class="notice success">You are approved for ${esc(appProject(approvedApp(current.id))?.name||'a project')}. Each student can be approved for only one project, so other applications are closed.</div>`:''}`)+`<div class="toolbar"><input placeholder="Search projects..." value="${esc(searchText)}" oninput="setSearch(this.value)">${!student?`<select onchange="setFilter(this.value)"><option value="all">All statuses</option><option value="published" ${filterStatus==='published'?'selected':''}>Published</option><option value="draft" ${filterStatus==='draft'?'selected':''}>Draft</option><option value="archived" ${filterStatus==='archived'?'selected':''}>Archived</option></select>`:''}</div>${student?projectCards(items,true):projectCards(items,false)}<div class="footer-note">Available slots are calculated from the project capacity minus approved applications. Prototype data is stored in this browser only; connect a secure server database before real deployment.</div>`}
window.setSearch=v=>{searchText=v;const pos=v.length;renderPage();const inp=$('#maincontent .toolbar input');if(inp){inp.focus();inp.setSelectionRange(pos,pos)}};
window.setFilter=v=>{filterStatus=v;renderPage()};
function projectTable(items){if(!items.length)return empty('No projects yet','Add your first project to get started.');return `<div class="tablewrap"><table><thead><tr><th>Project</th><th>Deadline</th><th>Slots remaining</th><th>Status</th><th>Actions</th></tr></thead><tbody>${items.map(p=>`<tr><td><b>${esc(p.name)}</b><div class="muted">${esc(p.category||'')}</div></td><td>${fmtDate(p.deadline)}</td><td>${availableSlots(p)} / ${Number(p.slots||0)}</td><td>${statusTag(p.status)}</td><td><div class="actions"><button class="secondary small" onclick="openProjectModal('${p.id}')">Edit</button><button class="ghost small" onclick="toggleProject('${p.id}')">${p.status==='published'?'Unpublish':'Publish'}</button></div></td></tr>`).join('')}</tbody></table></div>`}
function openProjectModal(id){if(current.role==='student')return;const p=db.projects.find(x=>x.id===id)||{name:'',category:'Student Assistance',description:'',requirements:'',documents:'',slots:10,deadline:'',status:'draft'};modal(`<div class="modalhead"><h2>${id?'Edit project':'Add a school project'}</h2><button class="ghost small" onclick="closeModal()">✕</button></div><form id="projectform"><div class="formgrid"><div class="field span2"><label>Project name *</label><input name="name" required value="${esc(p.name)}"></div><div class="field"><label>Category</label><select name="category">${['Student Assistance','Financial Assistance','Health & Wellness','Education','Transportation','Other'].map(x=>`<option ${p.category===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Application deadline *</label><input name="deadline" type="date" required value="${esc(p.deadline)}"></div><div class="field span2"><label>Description *</label><textarea name="description" required>${esc(p.description)}</textarea></div><div class="field span2"><label>Eligibility requirements *</label><textarea name="requirements" required placeholder="Who can apply? What criteria must they meet?">${esc(p.requirements)}</textarea></div><div class="field span2"><label>Required documents</label><textarea name="documents" placeholder="Separate items with commas">${esc(p.documents)}</textarea></div><div class="field"><label>Total available slots *</label><input name="slots" type="number" min="${id?usedSlots(id):0}" required value="${Number(p.slots||0)}"></div><div class="field"><label>Listing status</label><select name="status"><option value="draft" ${p.status==='draft'?'selected':''}>Draft (not visible to students)</option><option value="published" ${p.status==='published'?'selected':''}>Published</option></select></div></div><div class="actions"><button class="primary" type="submit">Save project</button><button class="ghost" type="button" onclick="closeModal()">Cancel</button></div></form>`);$('#projectform').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),data={name:String(f.get('name')).trim(),category:f.get('category'),deadline:f.get('deadline'),description:String(f.get('description')).trim(),requirements:String(f.get('requirements')).trim(),documents:String(f.get('documents')).trim(),slots:Number(f.get('slots')),status:f.get('status')};if(data.slots<usedSlots(id||'')){toast('Slots cannot be lower than the number of approved applications.');return}if(id){Object.assign(db.projects.find(x=>x.id===id),data);log(`Updated project: ${data.name}`)}else{const newp={id:uid(),...data,created:today()};db.projects.unshift(newp);log(`Created project: ${data.name}`)}save();closeModal();renderPage();toast('Project saved successfully.')})}
window.openProjectModal=openProjectModal;
window.toggleProject=id=>{const p=db.projects.find(x=>x.id===id);if(!p)return;p.status=p.status==='published'?'draft':'published';log(`${p.status==='published'?'Published':'Unpublished'} project: ${p.name}`);save();renderPage();toast('Project status updated.')};
window.archiveProject=id=>{const p=db.projects.find(x=>x.id===id);if(!p)return;askConfirm(`Archive "${p.name}"? Students will no longer see it.`,()=>{p.status='archived';log(`Archived project: ${p.name}`);save();renderPage();toast('Project archived.')})};
function usersPage(){const isSuper=current.role==='superadmin';let list=db.users.filter(u=>isSuper?true:u.role==='student').filter(u=>(u.name+' '+u.email+' '+(u.lrn||'')+' '+stuInfo(u)).toLowerCase().includes(searchText.toLowerCase())).filter(u=>filterStatus==='all'||u.status===filterStatus);return head(isSuper?'User & admin accounts':'Student account approvals',isSuper?'Manage role-specific accounts and approve student registrations.':'Review student registrations and activate eligible accounts.',isSuper?`<button class="primary" onclick="openUserModal()">＋ Create account</button>`:'')+`<div class="toolbar"><input placeholder="Search by name or LRN..." value="${esc(searchText)}" oninput="setSearch(this.value)"><select onchange="setFilter(this.value)"><option value="all">All statuses</option><option value="pending" ${filterStatus==='pending'?'selected':''}>Pending</option><option value="approved" ${filterStatus==='approved'?'selected':''}>Approved</option><option value="rejected" ${filterStatus==='rejected'?'selected':''}>Rejected</option></select>${isSuper?`<select onchange="setRoleFilter(this.value)"><option value="all">All roles</option><option value="superadmin">Super Admin</option><option value="admin">Admin</option><option value="student">Student</option></select>`:''}</div><div class="panel"><div class="tablewrap"><table><thead><tr><th>Full name</th><th>Email</th><th>LRN & class</th><th>Role</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.length?list.map(u=>`<tr><td><b>${esc(u.name)}</b></td><td>${esc(u.email||'—')}</td><td>${u.lrn?`<b>${esc(u.lrn)}</b><div class="muted">${esc(stuInfo(u))}</div>`:'—'}</td><td>${esc(roleLabel(u.role))}</td><td>${fmtDate(u.created)}</td><td>${statusTag(u.status)}</td><td><div class="actions">${u.role==='student'&&u.status!=='approved'?`<button class="primary small" onclick="approveUser('${u.id}')">Approve</button>`:''}${u.role==='student'&&u.status==='pending'?`<button class="danger small" onclick="rejectUser('${u.id}')">Reject</button>`:''}${isSuper&&u.id!=='u-super'?`<button class="ghost small" onclick="toggleUser('${u.id}')">${u.status==='approved'?'Deactivate':'Activate'}</button><button class="ghost small" onclick="deleteUser('${u.id}')">Delete</button>`:''}</div></td></tr>`).join(''):`<tr><td colspan="7">${empty('No accounts found','Try changing your search or status filter.')}</td></tr>`}</tbody></table></div></div><div class="footer-note">Only the Super Admin can create or manage privileged accounts. Student registrations are separate from project application approvals.</div>`}
let roleFilter='all';
window.setRoleFilter=v=>{roleFilter=v;const old=window.renderPage;renderPageRolePatch()};
function renderPageRolePatch(){const m=$('#maincontent');if(page!=='users')return renderPage();const html=usersPage();m.innerHTML=html;if(roleFilter!=='all'){const rows=$$('tbody tr',m);rows.forEach(row=>{const t=row.innerText.toLowerCase();if(!t.includes(roleFilter==='superadmin'?'super admin':roleFilter))row.style.display='none'})}}
function openUserModal(){if(current.role!=='superadmin')return;modal(`<div class="modalhead"><h2>Create authorized account</h2><button class="ghost small" onclick="closeModal()">✕</button></div><div class="notice">Create admin or Super Admin accounts here. Students should use the public student sign-up form.</div><form id="userform"><div class="field"><label>Full name *</label><input name="name" required></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>Temporary password *</label><div class="pwwrap"><input name="password" type="password" required minlength="8"><button type="button" class="pwtoggle" onclick="togglePw(this)" aria-label="Show password">Show</button></div></div><div class="field"><label>Role *</label><select name="role"><option value="admin">Admin / School Personnel</option><option value="superadmin">Super Admin</option></select></div><button class="primary" type="submit">Create account</button></form>`);$('#userform').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target),key=nameKey(f.get('name'));if(db.users.some(u=>nameKey(u.name)===key)){toast('That full name is already registered.');return}const u={id:uid(),name:String(f.get('name')).trim(),email:String(f.get('email')).trim(),password:String(f.get('password')),role:f.get('role'),status:'approved',created:today()};db.users.push(u);log(`Created ${u.role} account: ${u.name}`);save();closeModal();renderPage();toast('Account created. Share credentials securely with the account owner.')})}
window.openUserModal=openUserModal;
window.approveUser=id=>{const u=db.users.find(x=>x.id===id);if(!u)return;u.status='approved';notify(u.id,'Account approved','Your student account has been approved. You can now sign in and browse school projects.');log(`Approved student account: ${u.name}`);save();renderPage();toast('Student account approved.')};
window.rejectUser=id=>{const u=db.users.find(x=>x.id===id);if(!u)return;askConfirm(`Reject the registration for ${u.name}?`,()=>{u.status='rejected';notify(u.id,'Account registration not approved','Your account registration was not approved. Please contact the school office for guidance.');log(`Rejected student account: ${u.name}`);save();renderPage();toast('Registration rejected.')})};
window.toggleUser=id=>{const u=db.users.find(x=>x.id===id);if(!u||u.id==='u-super')return;u.status=u.status==='approved'?'rejected':'approved';log(`${u.status==='approved'?'Activated':'Deactivated'} account: ${u.name}`);save();renderPage();toast('Account status updated.')};
window.deleteUser=id=>{const u=db.users.find(x=>x.id===id);if(!u||u.id==='u-super')return;askConfirm(`Delete account ${u.name}? This will also remove its application records and notifications.`,()=>{db.users=db.users.filter(x=>x.id!==id);db.applications=db.applications.filter(a=>a.studentId!==id);db.notifications=db.notifications.filter(n=>n.userId!==id);log(`Deleted account: ${u.name}`);save();renderPage();toast('Account deleted.')})};
function applicationsPage(){const list=db.applications.filter(a=>(a.studentName+' '+(appProject(a)?.name||'')).toLowerCase().includes(searchText.toLowerCase())).filter(a=>filterStatus==='all'||a.status===filterStatus).sort((a,b)=>sortDir.applications==='asc'?a.submitted.localeCompare(b.submitted):b.submitted.localeCompare(a.submitted));const pg=paginateList(list,'applications');return head('Application review','Review each application against the selected project’s published eligibility requirements.',`<button class="ghost small" onclick="toggleSort('applications')">Sort: ${sortDir.applications==='asc'?'Oldest first ↑':'Newest first ↓'}</button>`)+`<div class="toolbar"><input placeholder="Search student or project..." value="${esc(searchText)}" oninput="pageNum.applications=1;setSearch(this.value)"><select onchange="pageNum.applications=1;setFilter(this.value)"><option value="all">All statuses</option>${['Pending','Approved','Rejected','Needs information'].map(x=>`<option ${filterStatus===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="panel">${tableApps(pg.slice,true)}${pagerBar('applications',pg)}</div>`}
function tableApps(list,reviewMode){if(!list.length)return empty('No applications found','Applications will appear here after students submit forms.');return `<div class="tablewrap"><table><thead><tr><th>Student</th><th>Project</th><th>Submitted</th><th>Status</th><th>Actions</th></tr></thead><tbody>${list.map(a=>`<tr><td><b>${esc(a.studentName)}</b><div class="muted">${esc(a.studentEmail||'')}</div>${reviewMode?`<div class="muted">${esc(classLine(a))}</div>`:''}</td><td>${esc(appProject(a)?.name||'Project unavailable')}</td><td>${fmtTime(a.submitted)}</td><td>${statusTag(a.status)}</td><td><div class="actions"><button class="secondary small" onclick="viewApplication('${a.id}')">View details</button>${reviewMode&&current.role!=='student'&&a.status!=='Approved'&&a.status!=='Rejected'?`<button class="primary small" onclick="reviewApp('${a.id}','Approved')">Approve</button><button class="danger small" onclick="reviewApp('${a.id}','Rejected')">Reject</button><button class="ghost small" onclick="reviewApp('${a.id}','Needs information')">Request info</button>`:''}</div></td></tr>`).join('')}</tbody></table></div>`}
function myAppsPage(){const list=userApps(current.id).sort((a,b)=>b.submitted.localeCompare(a.submitted));return head('My applications','Track decisions and review notes for your school project applications.',`<button class="primary" onclick="go('projects')">＋ Apply to a project</button>`)+`<div class="panel">${tableApps(list,false)}</div>`}
window.applyProject=id=>{if(current.role!=='student')return;const p=db.projects.find(x=>x.id===id);if(!p||p.status!=='published'||availableSlots(p)<=0)return;{const why=blockReason(current.id,id);if(why){toast(why);return}}modal(`<div class="modalhead"><h2>Apply: ${esc(p.name)}</h2><button class="ghost small" onclick="closeModal()">✕</button></div><div class="notice">Please review the project requirements carefully. Submitting does not guarantee approval.</div><div class="panel" style="background:#f8fafc;box-shadow:none"><b>Eligibility requirements</b><p class="muted">${esc(p.requirements)}</p><b>Required documents</b><p class="muted">${esc(p.documents||'No documents specified')}</p><b>Deadline:</b> ${fmtDate(p.deadline)} &nbsp; <b>Slots:</b> ${availableSlots(p)}</div><form id="applyform"><div class="field"><label>Why are you applying? *</label><textarea name="reason" required minlength="10" placeholder="Briefly explain your need and how you meet the criteria."></textarea></div><div class="field"><label>Additional notes (optional)</label><textarea name="notes" placeholder="Anything else the reviewer should know?"></textarea></div><div class="field"><label for="requirementFiles">Upload documentary requirements</label><div class="uploadbox"><input id="requirementFiles" name="requirementFiles" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple><small>Accepted formats: PDF, JPG, PNG. Maximum 5 files, 5 MB each.</small><div id="selectedFiles" class="selected-files muted">No files selected.</div></div></div><div class="notice warn">Prototype mode: files can be selected for preview, but they are not yet saved to the server. Complete the PHP API integration before using real student documents.</div><label style="display:flex;gap:9px;align-items:flex-start;margin-bottom:17px;font-size:13px"><input type="checkbox" required style="margin-top:4px"> I confirm that the information I provide is accurate and that I have reviewed the requirements.</label><button class="primary" type="submit">Submit application</button></form>`);const uploadInput=$('#requirementFiles'),selectedFiles=$('#selectedFiles');uploadInput.addEventListener('change',()=>{const files=[...uploadInput.files],allowed=['application/pdf','image/jpeg','image/png'];if(files.length>5||files.some(file=>!allowed.includes(file.type)||file.size>5*1024*1024)){uploadInput.value='';selectedFiles.textContent='Please select up to 5 PDF/JPG/PNG files, each no larger than 5 MB.';selectedFiles.classList.add('upload-error');return}selectedFiles.classList.remove('upload-error');selectedFiles.textContent=files.length?files.map(file=>`${file.name} (${(file.size/1024/1024).toFixed(2)} MB)`).join(' · '):'No files selected.'});$('#applyform').addEventListener('submit',e=>{e.preventDefault();{const why=blockReason(current.id,id);if(why){toast(why);closeModal();return}}const f=new FormData(e.target),a={id:uid(),studentId:current.id,studentName:current.name,studentEmail:current.email||'',projectId:id,reason:String(f.get('reason')).trim(),notes:String(f.get('notes')).trim(),status:'Pending',submitted:new Date().toISOString(),reviewNote:'',reviewer:'',documentNames:[...uploadInput.files].map(file=>file.name)};db.applications.push(a);db.users.filter(u=>u.role==='admin'||u.role==='superadmin').forEach(u=>notify(u.id,'New project application',`${current.name} applied for ${p.name}.`));notify(current.id,'Application submitted',`Your application for ${p.name} has been submitted and is pending review.`);log(`Submitted application for ${p.name}`);save();closeModal();go('myapps');toast('Application submitted successfully.')})};
window.viewApplication=id=>{const a=db.applications.find(x=>x.id===id);if(!a)return;if(current.role==='student'&&a.studentId!==current.id)return;const p=appProject(a),s=db.users.find(u=>u.id===a.studentId);modal(`<div class="modalhead"><h2>Application details</h2><button class="ghost small" onclick="closeModal()">✕</button></div><div class="formgrid"><div class="field"><label>Student</label><div>${esc(a.studentName)}</div></div><div class="field"><label>Project</label><div>${esc(p?.name||'Unavailable')}</div></div><div class="field"><label>LRN</label><div>${esc(s?.lrn||'—')}</div></div><div class="field"><label>Grade, section & strand</label><div>${esc(stuInfo(s)||'—')}</div></div><div class="field"><label>Submitted</label><div>${fmtTime(a.submitted)}</div></div><div class="field"><label>Status</label><div>${statusTag(a.status)}</div></div><div class="field span2"><label>Application statement</label><div style="white-space:pre-wrap">${esc(a.reason)}</div></div><div class="field span2"><label>Additional notes</label><div style="white-space:pre-wrap">${esc(a.notes||'—')}</div></div><div class="field span2"><label>Uploaded requirements</label><div style="white-space:pre-wrap">${a.documentNames&&a.documentNames.length?a.documentNames.map(name=>esc(name)).join('<br>'):'No files selected.'}</div></div><div class="field span2"><label>Reviewer notes</label><div style="white-space:pre-wrap">${esc(a.reviewNote||'No reviewer notes yet.')}</div></div><div class="field"><label>Reviewed by</label><div>${esc(a.reviewer||'Not reviewed')}</div></div></div>${current.role!=='student'&&a.status!=='Approved'&&a.status!=='Rejected'?`<div class="actions"><button class="primary" onclick="reviewApp('${a.id}','Approved')">Approve</button><button class="danger" onclick="reviewApp('${a.id}','Rejected')">Reject</button><button class="secondary" onclick="reviewApp('${a.id}','Needs information')">Request information</button></div>`:''}`)};
window.reviewApp=(id,status)=>{const a=db.applications.find(x=>x.id===id);if(!a||current.role==='student')return;const p=appProject(a);if(status==='Approved'){const other=approvedApp(a.studentId);if(other&&other.id!==a.id){toast('This student is already approved for another project, so this application cannot be approved.');return}}if(status==='Approved'&&p&&availableSlots(p)<=0){toast('No slots remain for this project. Increase capacity or review another application.');return}modal(`<div class="modalhead"><h2>${status==='Needs information'?'Request more information':status+' application'}</h2><button class="ghost small" onclick="closeModal()">✕</button></div><p class="muted">Student: <b>${esc(a.studentName)}</b> · Project: <b>${esc(p?.name||'Unavailable')}</b></p><form id="reviewform"><div class="field"><label>Review note ${status==='Needs information'?'(explain what is missing)':'(optional)'}</label><textarea name="note" ${status==='Needs information'?'required':''} placeholder="Write feedback for the student...">${esc(a.reviewNote||'')}</textarea></div><button class="primary" type="submit">Confirm ${esc(status.toLowerCase())}</button></form>`);$('#reviewform').addEventListener('submit',e=>{e.preventDefault();const note=String(new FormData(e.target).get('note')).trim();a.status=status;a.reviewNote=note;a.reviewer=current.name;a.reviewedAt=new Date().toISOString();a.reviewed=new Date().toISOString();notify(a.studentId,`Application ${status.toLowerCase()}`,`Your application for ${p?.name||'a school project'} is now marked "${status}".${note?' Reviewer note: '+note:''}`);log(`${status} application ${a.id} for ${p?.name||'project'}`);save();closeModal();renderPage();toast('Application review saved.')})};
function notificationsPage(){const ns=db.notifications.filter(n=>n.userId===current.id);return head('Notifications','Account approvals, application decisions, and system updates.',`<button class="ghost" onclick="markAllRead()">Mark all as read</button>`)+`<div class="panel">${ns.length?ns.map(n=>`<div style="padding:15px 0;border-bottom:1px solid var(--line);display:flex;gap:12px"><div class="avatar" style="flex-shrink:0">${n.read?'✓':'•'}</div><div style="flex:1"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(n.title)}</b>${n.read?'':`<span class="tag pending">New</span>`}</div><div class="muted" style="margin:5px 0">${esc(n.message)}</div><div class="muted" style="font-size:11px">${fmtTime(n.at)}</div></div>${!n.read?`<button class="ghost small" onclick="markRead('${n.id}')">Read</button>`:''}</div>`).join(''):empty('You’re all caught up','New notifications will appear here.')}</div>`}
window.markRead=id=>{const n=db.notifications.find(x=>x.id===id&&x.userId===current.id);if(n)n.read=true;save();renderPage()};
window.markAllRead=()=>{db.notifications.filter(n=>n.userId===current.id).forEach(n=>n.read=true);save();renderShell();toast('All notifications marked as read.')};
window.runDataRetentionCleanup=()=>{askConfirm('Archive logs older than 180 days and purge read notifications older than 90 days (Data Privacy Act retention policy)?',()=>{const cutoffLogs=Date.now()-180*86400000,cutoffNotifs=Date.now()-90*86400000;const beforeLogs=db.logs.length,beforeNotifs=db.notifications.length;db.logs=db.logs.filter(l=>new Date(l.at).getTime()>=cutoffLogs);db.notifications=db.notifications.filter(n=>!n.read||new Date(n.at).getTime()>=cutoffNotifs);log(`Ran retention cleanup (archived ${beforeLogs-db.logs.length} old logs, purged ${beforeNotifs-db.notifications.length} old read notifications)`);save();renderPage();toast('Data retention cleanup completed.')})};
function auditPage(){if(current.role!=='superadmin'&&current.role!=='admin')return '';const pg=paginateList(db.logs,'audit');return head('Activity log','A record of important account, project, and application actions.',`<button class="secondary small" onclick="runDataRetentionCleanup()">🧹 Run Retention & Archival</button>`)+`<div class="panel"><div class="tablewrap"><table><thead><tr><th>Date & time</th><th>Actor</th><th>Action</th></tr></thead><tbody>${pg.slice.map(l=>`<tr><td>${fmtTime(l.at)}</td><td>${esc(l.actor)}</td><td>${esc(l.action)}</td></tr>`).join('')}</tbody></table></div>${pagerBar('audit',pg)}</div>`}

let reportMode='daily', reportDate=today(), reportMonth=today().slice(0,7);
function buildLocalReport(mode,target){
  const matchesPeriod=iso=>{
    if(!iso)return false;
    const d=new Date(iso);
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
    return mode==='daily'?`${y}-${m}-${day}`===target:`${y}-${m}`===target;
  };
  const studentMap=new Map();
  db.logs.forEach(l=>{
    if(!matchesPeriod(l.at))return;
    const stu=db.users.find(u=>u.role==='student'&&(u.id===l.actorId||nameKey(u.name)===nameKey(l.actor)));
    if(!stu)return;
    const prev=studentMap.get(stu.id);
    if(!prev){studentMap.set(stu.id,{student:stu,firstAt:l.at,lastAt:l.at,actions:1});}
    else{if(l.at<prev.firstAt)prev.firstAt=l.at;if(l.at>prev.lastAt)prev.lastAt=l.at;prev.actions++;}
  });
  const submittedApps=db.applications.filter(a=>matchesPeriod(a.submitted)).sort((a,b)=>a.submitted.localeCompare(b.submitted));
  submittedApps.forEach(a=>{
    const stu=db.users.find(u=>u.id===a.studentId);
    if(stu&&!studentMap.has(stu.id)){studentMap.set(stu.id,{student:stu,firstAt:a.submitted,lastAt:a.submitted,actions:1});}
  });
  const projectBreakdown=db.projects.map(p=>{
    const decided=db.applications.filter(a=>a.projectId===p.id&&(a.status==='Approved'||a.status==='Rejected')&&matchesPeriod(a.reviewedAt||a.submitted));
    const accepted=decided.filter(a=>a.status==='Approved');
    const rejected=decided.filter(a=>a.status==='Rejected');
    return {
      projectId:p.id,
      projectName:p.name,
      acceptedCount:accepted.length,
      rejectedCount:rejected.length,
      acceptedStudents:accepted.map(a=>({name:a.studentName,appliedAt:a.submitted,reviewedAt:a.reviewedAt||a.submitted})),
      rejectedStudents:rejected.map(a=>({name:a.studentName,appliedAt:a.submitted,reviewedAt:a.reviewedAt||a.submitted}))
    };
  });
  return {mode,target,systemUsers:[...studentMap.values()].sort((a,b)=>a.firstAt.localeCompare(b.firstAt)),submittedApps,projectBreakdown};
}
window.setReportMode=m=>{reportMode=m;renderPage()};
window.setReportPeriod=v=>{if(reportMode==='daily')reportDate=v;else reportMonth=v;renderPage()};
window.exportReportCSV=()=>{
  const target=reportMode==='daily'?reportDate:reportMonth;
  const rep=buildLocalReport(reportMode,target);
  const rows=[
    ['Section','Student Name','LRN / Class','Project','Time Applied / First Activity','Decision Status'],
    ...rep.systemUsers.map(u=>['System User',u.student.name,u.student.lrn?`${u.student.lrn} (${stuInfo(u.student)})`:'','—',fmtTime(u.firstAt),'Active in System']),
    ...rep.submittedApps.map(a=>['Application Submitted',a.studentName,classLine(a),appProject(a)?.name||'Project unavailable',fmtTime(a.submitted),a.status]),
    ...rep.projectBreakdown.flatMap(pb=>[
      ...pb.acceptedStudents.map(s=>['Accepted List',s.name,'',pb.projectName,fmtTime(s.appliedAt),'Accepted']),
      ...pb.rejectedStudents.map(s=>['Rejected List',s.name,'',pb.projectName,fmtTime(s.appliedAt),'Rejected'])
    ])
  ];
  const csv=rows.map(r=>r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SJLSHS-${reportMode}-report-${target}.csv`;a.click();URL.revokeObjectURL(a.href);
};
function reportsPage(){
  if(current.role==='student')return '';
  const target=reportMode==='daily'?reportDate:reportMonth;
  const rep=buildLocalReport(reportMode,target);
  const totalAccepted=rep.projectBreakdown.reduce((sum,p)=>sum+p.acceptedCount,0);
  const totalRejected=rep.projectBreakdown.reduce((sum,p)=>sum+p.rejectedCount,0);
  return head(
    reportMode==='daily'?'End-of-Day Report':'Monthly Summary Report',
    'Student system usage, project applications, timestamps, and accepted/rejected outcomes per project.',
    `<div class="actions"><button class="secondary" onclick="exportReportCSV()">⬇ Export CSV</button><button class="primary" onclick="window.print()">🖨 Print / Save PDF</button></div>`
  )+
  `<div class="toolbar"><select onchange="setReportMode(this.value)"><option value="daily" ${reportMode==='daily'?'selected':''}>End-of-Day Report</option><option value="monthly" ${reportMode==='monthly'?'selected':''}>Monthly Report</option></select>${reportMode==='daily'?`<input type="date" value="${esc(reportDate)}" onchange="setReportPeriod(this.value)">`:`<input type="month" value="${esc(reportMonth)}" onchange="setReportPeriod(this.value)">`}</div>`+
  `<div class="cards">${stat('Students who used system',rep.systemUsers.length,reportMode==='daily'?`Date: ${fmtDate(reportDate)}`:`Month: ${esc(reportMonth)}`)}${stat('Applications submitted',rep.submittedApps.length,'Total project applications')}${stat('Accepted applications',totalAccepted,'Approved across all projects')}${stat('Rejected applications',totalRejected,'Rejected across all projects')}</div>`+
  `<div class="panel"><div class="panelhead"><h2>1. Students Who Used the System (${rep.systemUsers.length})</h2></div>${rep.systemUsers.length?`<div class="tablewrap"><table><thead><tr><th>#</th><th>Student Name</th><th>LRN & Class</th><th>First Time Used</th><th>Last Activity</th></tr></thead><tbody>${rep.systemUsers.map((u,i)=>`<tr><td>${i+1}</td><td><b>${esc(u.student.name)}</b></td><td>${esc(u.student.lrn||'—')} ${stuInfo(u.student)?`· ${esc(stuInfo(u.student))}`:''}</td><td>${fmtTime(u.firstAt)}</td><td>${fmtTime(u.lastAt)}</td></tr>`).join('')}</tbody></table></div>`:empty('No student activity recorded','No students signed in or submitted applications during this period.')}</div>`+
  `<div class="panel"><div class="panelhead"><h2>2. Student Applications & Time Applied (${rep.submittedApps.length})</h2></div>${rep.submittedApps.length?`<div class="tablewrap"><table><thead><tr><th>#</th><th>Student Name</th><th>Project Applied For</th><th>Time Applied</th><th>Current Status</th></tr></thead><tbody>${rep.submittedApps.map((a,i)=>`<tr><td>${i+1}</td><td><b>${esc(a.studentName)}</b><div class="muted">${esc(classLine(a))}</div></td><td>${esc(appProject(a)?.name||'Project unavailable')}</td><td>${fmtTime(a.submitted)}</td><td>${statusTag(a.status)}</td></tr>`).join('')}</tbody></table></div>`:empty('No applications submitted','No project applications were submitted in this timeframe.')}</div>`+
  `<div class="panel"><div class="panelhead"><h2>3. Accepted & Rejected Breakdown by Project</h2></div>${rep.projectBreakdown.length?`<div class="tablewrap"><table><thead><tr><th>Project Name</th><th>Accepted Count</th><th>Accepted Students</th><th>Rejected Count</th><th>Rejected Students</th></tr></thead><tbody>${rep.projectBreakdown.map(pb=>`<tr><td><b>${esc(pb.projectName)}</b></td><td><span class="tag approved">${pb.acceptedCount}</span></td><td>${pb.acceptedStudents.length?pb.acceptedStudents.map(s=>`<div>• <b>${esc(s.name)}</b> <span class="muted" style="font-size:12px">(Applied: ${fmtTime(s.appliedAt)})</span></div>`).join(''):'<span class="muted">None</span>'}</td><td><span class="tag rejected">${pb.rejectedCount}</span></td><td>${pb.rejectedStudents.length?pb.rejectedStudents.map(s=>`<div>• <b>${esc(s.name)}</b> <span class="muted" style="font-size:12px">(Applied: ${fmtTime(s.appliedAt)})</span></div>`).join(''):'<span class="muted">None</span>'}</td></tr>`).join('')}</tbody></table></div>`:empty('No projects found','Create projects to track acceptance and rejection metrics.')}</div>`;
}


window.openForgotPasswordModal = () => {
  modal(`<div class="modalhead"><h2>Reset account password</h2><button class="ghost small" onclick="closeModal()">✕</button></div>
    <p class="muted">Enter your registered email address to receive a password reset token.</p>
    <form id="forgotform">
      <div class="field"><label>Registered email address *</label><input name="email" type="email" required placeholder="you@example.com"></div>
      <div class="actions"><button class="primary" type="submit">Request reset token</button><button class="ghost" type="button" onclick="openTokenResetModal()">Already have a token?</button></div>
    </form>`);
  $('#forgotform').addEventListener('submit', async e => {
    e.preventDefault();
    const email = String(new FormData(e.target).get('email')).trim().toLowerCase();
    if (apiMode) {
      try {
        const res = await apiReq('auth.php?action=forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        toast(res.message);
        openTokenResetModal(res.dev_reset_token || '');
      } catch (err) { toast(err.message); }
      return;
    }
    const u = db.users.find(x => (x.email || '').toLowerCase() === email);
    if (!u) { toast('If an account matches that email, reset instructions were issued.'); closeModal(); return; }
    const token = uid().toUpperCase();
    u.resetToken = token; save();
    toast('Prototype reset token generated.');
    openTokenResetModal(token);
  });
};

window.openTokenResetModal = (prefill = '') => {
  modal(`<div class="modalhead"><h2>Set new password</h2><button class="ghost small" onclick="closeModal()">✕</button></div>
    <form id="resetpwform">
      <div class="field"><label>Reset token *</label><input name="token" required value="${esc(prefill)}" placeholder="Paste reset token"></div>
      <div class="field"><label>New password (10+ characters) *</label><div class="pwwrap"><input name="password" type="password" required minlength="10" oninput="updatePwMeter(this)"><button type="button" class="pwtoggle" onclick="togglePw(this)">Show</button></div><div class="pw-meter"></div></div>
      <button class="primary" type="submit">Update password</button>
    </form>`);
  $('#resetpwform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), token = String(f.get('token')).trim(), password = String(f.get('password'));
    if (apiMode) {
      try {
        const res = await apiReq('auth.php?action=reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
        toast(res.message); closeModal();
      } catch (err) { toast(err.message); }
      return;
    }
    const u = db.users.find(x => x.resetToken === token);
    if (!u) { toast('Invalid or expired reset token.'); return; }
    u.password = password; delete u.resetToken;
    log(`Password reset completed for ${u.name}`); save(); closeModal(); toast('Password updated. You can now sign in.');
  });
};

window.openChangePasswordModal = () => {
  if (!current) return;
  const minLen = (current.role === 'admin' || current.role === 'superadmin') ? 12 : 10;
  modal(`<div class="modalhead"><h2>Change my password</h2><button class="ghost small" onclick="closeModal()">✕</button></div>
    <form id="changepwform">
      <div class="field"><label>Current password *</label><div class="pwwrap"><input name="current_password" type="password" required><button type="button" class="pwtoggle" onclick="togglePw(this)">Show</button></div></div>
      <div class="field"><label>New password (${minLen}+ characters) *</label><div class="pwwrap"><input name="new_password" type="password" required minlength="${minLen}" oninput="updatePwMeter(this)"><button type="button" class="pwtoggle" onclick="togglePw(this)">Show</button></div><div class="pw-meter"></div></div>
      <button class="primary" type="submit">Save new password</button>
    </form>`);
  $('#changepwform').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.target), cur = String(f.get('current_password')), next = String(f.get('new_password'));
    if (apiMode) {
      try {
        const res = await apiReq('auth.php?action=change-password', { method: 'POST', body: JSON.stringify({ current_password: cur, new_password: next }) });
        toast(res.message); closeModal();
      } catch (err) { toast(err.message); }
      return;
    }
    if (current.password !== cur) { toast('Current password is incorrect.'); return; }
    current.password = next; log('Changed account password'); save(); closeModal(); toast('Password updated successfully.');
  });
};

function modal(content){$('#modalroot').innerHTML=`<div class="modalback" onclick="if(event.target===this)closeModal()"><section class="modal">${content}</section></div>`}
window.closeModal=()=>$('#modalroot').innerHTML='';
window.resetDemo=()=>{askConfirm('Reset all demo data in this browser?',()=>{db=seed();save();current=null;renderAuth();toast('Demo data reset.')})};
save();syncFromApi();
})();
