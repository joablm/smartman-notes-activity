(() => {
  'use strict';
  const app = document.getElementById('patient-app');
  const mobileMedia = window.matchMedia('(max-width: 820px), (pointer: coarse)');
  const applyDeviceMode = () => {
    const mobile = mobileMedia.matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    document.documentElement.dataset.device = mobile ? 'mobile' : 'desktop';
    document.body.classList.toggle('is-mobile', mobile);
  };
  applyDeviceMode();
  mobileMedia.addEventListener?.('change', applyDeviceMode);
  const modalRoot = document.getElementById('patient-modal');
  const toastRoot = document.getElementById('patient-toast');
  const STORAGE_KEY = 'humanevo_premium_studio_state_v3';
  const DEMO_STORAGE_KEY = 'humanevo_demo_patient_state_v1';
  const params = new URLSearchParams(location.search);
  const demoPatientId = params.get('demo') || sessionStorage.getItem('humanevo_demo_patient') || ((location.pathname.endsWith('/demo-paciente.html') || location.pathname.endsWith('/demo-paciente')) ? 'p1' : '');
  const signupAccess = params.get('signup') === '1';
  if (demoPatientId) sessionStorage.removeItem('humanevo_demo_patient');
  const cloud = window.HumanevoCloud;
  if (!demoPatientId && !signupAccess && (!sessionStorage.getItem('humanevo_access_granted') || !sessionStorage.getItem('humanevo_cloud_auth_v1'))) { location.replace('/'); return; }
  const state = { mode: demoPatientId ? 'demo' : 'cloud', authMode:signupAccess?'signup':'login', patient: null, appointments:[], appointmentsError:'', brandingLogo:'', assignments: [], notifications: [], chatThreads:[], chatMessages:[], activeChatThreadId:'', context: null, current: null, pendingAnswers: null };
  let patientChatRequestSequence=0;
  let patientRefreshSequence=0;
  let patientSpeechRecognition=null;
  let patientSpeechTarget=null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DEFAULT_BRAND_LOGO='./assets/logo-humanevo.svg';
  const brandLogo=()=>state.brandingLogo||DEFAULT_BRAND_LOGO;
  async function loadPatientBranding(){
    if(state.mode==='demo'){
      const local=readLocal();state.brandingLogo=String(local?.customization?.logoData||'');return state.brandingLogo;
    }
    if(!cloud?.configured||typeof cloud.getClinicBranding!=='function')return state.brandingLogo;
    try{const row=await cloud.getClinicBranding(window.HUMANEVO_CONFIG?.DEFAULT_CLINIC_ID||'');if(row&&Object.prototype.hasOwnProperty.call(row,'logo_data'))state.brandingLogo=String(row.logo_data||'');}
    catch(error){console.warn('Logo global do portal:',error);}
    return state.brandingLogo;
  }
  const initials = name => String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const dateFmt = value => value ? new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(value.length===10?`${value}T12:00:00`:value)) : 'Sem prazo';
  const formatPhone = value => { const d=String(value||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'').slice(0,11); if(!d)return''; if(d.length<=2)return`(${d}`; if(d.length<=6)return`(${d.slice(0,2)}) ${d.slice(2)}`; if(d.length<=10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`; return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; };
  const toast = (msg,type='') => { const el=document.createElement('div');el.className=`patient-toast ${type}`;el.textContent=msg;toastRoot.appendChild(el);setTimeout(()=>el.remove(),3200); };
  const formatFileSize = value => { const bytes=Number(value)||0;if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;return `${(bytes/1048576).toFixed(1)} MB`; };
  const avatarMarkup=(profile={},className='portal-chat-avatar')=>{const name=profile.full_name||profile.name||profile.email||'Usuário';const image=profile.avatar_path||profile.avatarData||profile.sender_avatar||'';return `<span class="${className}${image?' has-photo':''}">${image?`<img src="${esc(image)}" alt="Foto de ${esc(name)}">`:initials(name)}</span>`;};
  const downloadBlob=(blob,filename='anexo')=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);};
  function readLocal(){try{const raw=state.mode==='demo'?(sessionStorage.getItem(DEMO_STORAGE_KEY)||localStorage.getItem(STORAGE_KEY)):localStorage.getItem(STORAGE_KEY);return JSON.parse(raw||'null')}catch(_){return null}}
  function writeLocal(data){if(state.mode==='demo')sessionStorage.setItem(DEMO_STORAGE_KEY,JSON.stringify(data));else localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}
  function localForm(assignment){return assignment.formSnapshot||null;}
  function cloudForm(assignment){const f=assignment.humanevo_forms||{};return {id:f.id,title:f.title,category:f.category,description:f.description,duration:f.estimated_minutes,questions:f.questions||[],references:f.references_list||[]};}
  function normalizeCloudAssignment(a){const response=Array.isArray(a.humanevo_form_responses)?a.humanevo_form_responses[0]:a.humanevo_form_responses;return {id:a.id,status:a.status,dueAt:a.due_at,message:a.message,createdAt:a.created_at,submittedAt:a.submitted_at,answers:response?.answers||{},formSnapshot:cloudForm(a),cloud:true};}
  function normalizePatientAppointment(a={}){return {id:a.id,patientId:a.patient_id||a.patientId||'',start:a.starts_at||a.start||'',end:a.ends_at||a.end||'',type:a.session_type||a.type||'Consulta',mode:a.mode||'Presencial',status:a.status||'pending',professional:a.professional||'Equipe Humanevo',location:a.location||'',notes:a.notes||'',reminder:a.reminder||'24h'};}
  const patientAppointmentStatus={confirmed:{label:'Confirmado',tone:'green'},pending:{label:'Pendente',tone:'amber'},cancelled:{label:'Cancelado',tone:'red'},completed:{label:'Realizado',tone:'blue'}};
  const patientAppointmentMode={Presencial:'green',Online:'blue','Híbrida':'purple'};
  const patientAppointmentType={'Consulta':'teal','Retorno':'blue','Avaliação':'purple','Devolutiva':'gold','Orientação profissional':'cyan','Entrevista inicial':'rose'};
  const patientDateTime=value=>value?new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'Horário não definido';
  async function fetchPatientAppointments(patientId,fallback=[]){
    state.appointmentsError='';
    if(!patientId){state.appointmentsError='Seu cadastro ainda não está vinculado a um paciente. Solicite a conferência do vínculo à equipe.';return fallback;}
    if(typeof cloud?.listMyAppointments!=='function'){state.appointmentsError='O módulo de agenda do portal ainda não foi atualizado no navegador.';return fallback;}
    try{return await cloud.listMyAppointments(patientId);}
    catch(error){console.warn('Agendamentos do paciente:',error);state.appointmentsError='Não foi possível atualizar seus agendamentos agora. A área continua disponível e tentará sincronizar novamente.';return fallback;}
  }
  function scrollPortalTo(target){
    const section=document.getElementById(target);
    if(!section)return;
    section.scrollIntoView({behavior:'smooth',block:'start'});
    history.replaceState(null,'',`${location.pathname}${location.search.replace(/([?&])section=[^&]*(&|$)/,'$1').replace(/[?&]$/,'')}#${target}`);
  }
  function patientTextEntryActive(){const el=document.activeElement;if(!el)return false;if(el.isContentEditable)return true;if(!['INPUT','TEXTAREA','SELECT'].includes(el.tagName))return false;return !['checkbox','radio','range','file','button','submit'].includes(String(el.type||'').toLowerCase());}
  function renderPortalSafely(){if(patientTextEntryActive()||modalRoot.children.length||state.current)return false;render();return true;}
  function normalizePatientThread(thread={}){const channelType=String(thread.channel_type||thread.channelType||'private');return {...thread,channelType,channel_type:channelType,canPost:thread.can_post??thread.canPost??true,participants:Array.isArray(thread.participants)?thread.participants:[]};}
  function patientChannelMeta(thread={}){const type=normalizePatientThread(thread).channelType;if(type==='general')return {label:'Canal Geral',short:'Geral',description:'Avisos, eventos e comunicados da clínica.'};if(type==='intake')return {label:'Acolhimento',short:'Acolhimento',description:'Canal exclusivo com o Gestor de Acolhimento.'};if(type==='internal')return {label:'Canal Interno',short:'Interno',description:'Canal reservado à equipe.'};return {label:'Conversa privada',short:'Privada',description:'Conversa protegida com a equipe.'};}

  function requiresPasswordChange(context) {
    return context?.user?.app_metadata?.force_password_change === true || context?.user?.user_metadata?.force_password_change === true;
  }
  function renderRequiredPasswordChange(){
    const name=state.context?.profile?.full_name||state.context?.user?.email||'Paciente';
    app.innerHTML=`<main class="login-shell"><section class="login-card password-change-card"><div class="portal-mark"><img src="${esc(brandLogo())}" alt="Logo Humanevo" width="48" height="48"></div><span class="tag">Primeiro acesso</span><h1>Crie uma nova senha</h1><p>Olá, ${esc(String(name).split(' ')[0])}. A senha temporária foi validada e precisa ser substituída antes de abrir o portal.</p><form id="patient-password-change"><div class="field"><label>Nova senha</label><input name="password" type="password" minlength="8" required autocomplete="new-password"></div><div class="field"><label>Confirmar nova senha</label><input name="passwordConfirm" type="password" minlength="8" required autocomplete="new-password"></div><button class="btn btn-primary" style="width:100%;margin-top:18px" type="submit">Salvar nova senha</button><p class="portal-auth-helper">A senha não será armazenada no navegador ou no banco de dados da aplicação.</p></form></section></main>`;
    requestAnimationFrame(()=>app.querySelector('[name="password"]')?.focus());
  }
  function technicalFormError(error){
    const status=Number(error?.status||0);
    const data=error?.data||{};
    const raw=String(error?.message||data?.message||data?.details||error||'').toLowerCase();
    const code=String(data?.code||'').toUpperCase();
    if(status===401||raw.includes('jwt')||raw.includes('session')||raw.includes('sessão')||raw.includes('expired')) return 'Sessão expirada (HTTP 401). Entre novamente antes de enviar o formulário.';
    if(status===403||raw.includes('row-level security')||raw.includes('rls')||raw.includes('permission denied')||code==='42501') return 'Operação bloqueada pela política RLS do Supabase (HTTP 403). Solicite ao administrador a liberação correta.';
    if(status===404||raw.includes('not found')||raw.includes('não encontrado')||raw.includes('nao encontrado')||code==='PGRST116') return 'Formulário ou vínculo de resposta inexistente (HTTP 404). Atualize o portal e solicite um novo envio ao profissional.';
    return `Falha técnica ao salvar a resposta${status?` (HTTP ${status})`:''}: ${error?.message||'erro não identificado pelo Supabase.'}`;
  }

  async function initialize(){
    await loadPatientBranding();
    if(state.mode==='demo'){
      const data=readLocal();
      state.patient=(data?.patients||[]).find(p=>p.id===demoPatientId)||null;
      state.appointmentsError='';state.appointments=(data?.appointments||[]).filter(a=>a.patientId===demoPatientId).map(normalizePatientAppointment).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
      state.assignments=(data?.formAssignments||[]).filter(a=>a.patientId===demoPatientId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      state.notifications=(data?.notifications||[]).filter(n=>n.patientId===demoPatientId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      state.chatThreads=(data?.chatThreads||[]).filter(t=>(t.participants||[]).some(x=>x.patientId===demoPatientId||x.user_id===demoPatientId));
      render(); showUnreadPopup(); return;
    }
    if(!cloud?.configured){renderLogin('O portal ainda não está conectado ao banco central.');return;}
    if(!cloud.auth?.access_token){renderLogin();return;}
    try{
      state.context=await cloud.currentContext();
      if(!state.context?.membership||state.context.membership.role!=='patient'||state.context.membership.status!=='approved') throw new Error('Perfil de paciente não aprovado.');
      if(requiresPasswordChange(state.context)){renderRequiredPasswordChange();return;}
      const rows=await cloud.rest('humanevo_patients',`user_id=eq.${encodeURIComponent(state.context.user.id)}&select=*&limit=1`);
      state.patient=rows?.[0]||{full_name:state.context.profile.full_name,email:state.context.profile.email};
      const [appointments,assignments,notifications]=await Promise.all([fetchPatientAppointments(state.patient.id,[]),cloud.listMyAssignments(),cloud.listNotifications()]);
      state.appointments=(appointments||[]).map(normalizePatientAppointment).sort((a,b)=>String(a.start).localeCompare(String(b.start)));
      state.assignments=assignments.map(normalizeCloudAssignment);
      state.notifications=notifications;
      await cloud.ensureChatChannels().catch(error=>console.warn('Canal Geral não sincronizado:',error));
      await cloud.openIntakeChat(state.context.user.id).catch(error=>console.warn('Canal de acolhimento ainda indisponível:',error));
      state.chatThreads=(await cloud.listChatThreads().catch(()=>[])).map(normalizePatientThread);
      if(state.chatThreads.length){state.activeChatThreadId=state.activeChatThreadId||state.chatThreads[0].id;state.chatMessages=await cloud.listChatMessages(state.activeChatThreadId).catch(()=>[]);}
      render();showUnreadPopup();
    }catch(error){await cloud.signOut();renderLogin(error.message);}
  }


  async function refreshPatientCloud(){
    if(state.mode!=='cloud'||!cloud?.auth?.access_token||!state.patient||state.current||modalRoot.children.length)return;
    const requestId=++patientRefreshSequence;
    try{
      const before=new Set(state.notifications.filter(n=>!(n.read_at||n.readAt)).map(n=>n.id));
      const [appointments,assignments,notifications,threads,branding]=await Promise.all([
        fetchPatientAppointments(state.patient.id,state.appointments),cloud.listMyAssignments(),cloud.listNotifications(),cloud.listChatThreads().catch(()=>state.chatThreads),cloud.getClinicBranding(window.HUMANEVO_CONFIG?.DEFAULT_CLINIC_ID||'').catch(()=>null)
      ]);
      if(branding&&Object.prototype.hasOwnProperty.call(branding,'logo_data'))state.brandingLogo=String(branding.logo_data||'');
      if(requestId!==patientRefreshSequence)return;
      state.appointments=(appointments||[]).map(normalizePatientAppointment).sort((a,b)=>String(a.start).localeCompare(String(b.start)));state.assignments=assignments.map(normalizeCloudAssignment);state.notifications=notifications;state.chatThreads=(threads||[]).map(normalizePatientThread);
      if(state.activeChatThreadId){
        const activeId=state.activeChatThreadId;const messages=await cloud.listChatMessages(activeId).catch(()=>null);
        if(requestId!==patientRefreshSequence||String(state.activeChatThreadId)!==String(activeId))return;
        if(Array.isArray(messages))state.chatMessages=[...(state.chatMessages||[]).filter(m=>String(m.thread_id)!==String(activeId)),...messages];
      }
      renderPortalSafely();
      const next=state.notifications.find(n=>!(n.read_at||n.readAt)&&!before.has(n.id));if(next)showUnreadPopup();
    }catch(error){if(requestId===patientRefreshSequence)console.warn('Atualização do portal:',error);}
  }

  function renderLogin(error='',notice=''){
    const login=state.authMode==='login';
    const invitedEmail=params.get('email')||'';
    app.innerHTML=`<main class="login-shell"><section class="login-card"><div class="portal-mark"><img src="${esc(brandLogo())}" alt="Logo Humanevo" width="48" height="48"></div><h1>Portal do Paciente</h1><p>Acesse seu espaço para acompanhar comunicações, conversar com a equipe e responder aos formulários enviados pelo profissional.</p><div class="portal-auth-tabs"><button type="button" data-action="auth-mode" data-mode="login" class="${login?'active':''}">Entrar</button><button type="button" data-action="auth-mode" data-mode="signup" class="${!login?'active':''}">Primeiro acesso</button></div>${error?`<div class="portal-auth-message error">${esc(error)}</div>`:''}${notice?`<div class="portal-auth-message success">${esc(notice)}</div>`:''}${login?`<form id="patient-login"><div class="field"><label>E-mail</label><input name="email" type="email" required autocomplete="email" value="${esc(invitedEmail)}"></div><div class="field"><label>Senha</label><input name="password" type="password" required autocomplete="current-password"></div><button class="btn btn-primary" style="width:100%;margin-top:18px" type="submit">Entrar no meu espaço</button></form>`:`<form id="patient-signup"><div class="field"><label>Nome completo</label><input name="fullName" required autocomplete="name"></div><div class="field"><label>E-mail usado no cadastro da clínica</label><input name="email" type="email" required autocomplete="email" value="${esc(invitedEmail)}"></div><div class="field"><label>Telefone</label><input name="phone" data-phone-mask inputmode="tel" maxlength="15" autocomplete="tel" placeholder="(00) 00000-0000"></div><div class="field"><label>Crie uma senha</label><input name="password" type="password" minlength="8" required autocomplete="new-password"></div><button class="btn btn-primary" style="width:100%;margin-top:18px" type="submit">Criar meu acesso</button><p class="portal-auth-helper">Use o mesmo e-mail informado à clínica. O vínculo com seu cadastro será realizado automaticamente e poderá aguardar aprovação administrativa.</p></form>`}</section></main>`;
    requestAnimationFrame(() => { app.querySelector('input[type="password"]')?.focus(); });
  }
  function assignmentStatus(a){return ({assigned:'Disponível',opened:'Aberto',in_progress:'Em preenchimento',submitted:'Enviado',reviewed:'Revisado',cancelled:'Cancelado'}[a.status]||a.status);}
  function render(){
    if(!state.patient){app.innerHTML=`<main class="login-shell"><section class="login-card"><h1>Paciente não localizado</h1><p>O vínculo deste acesso ainda não foi concluído.</p></section></main>`;return;}
    const pending=state.assignments.filter(a=>['assigned','opened','in_progress'].includes(a.status));
    const submitted=state.assignments.filter(a=>['submitted','reviewed'].includes(a.status));
    const name=state.patient.name||state.patient.full_name||state.context?.profile?.full_name||'Paciente';
    const threads=Array.isArray(state.chatThreads)?state.chatThreads:[];
    const appointments=[...(state.appointments||[])].sort((a,b)=>String(a.start).localeCompare(String(b.start)));
    const futureAppointments=appointments.filter(a=>new Date(a.end||a.start)>=new Date(Date.now()-3600000)&&a.status!=='cancelled');
    const active=threads.find(t=>String(t.id)===String(state.activeChatThreadId))||threads[0]||null;
    if(active&&!state.activeChatThreadId)state.activeChatThreadId=active.id;
    const appointmentWarning=state.appointmentsError?`<div class="patient-appointment-warning"><strong>Agenda temporariamente sem sincronização</strong><span>${esc(state.appointmentsError)}</span></div>`:'';
    app.innerHTML=`<div class="portal-shell"><header class="portal-header"><div class="portal-brand"><span class="portal-mark"><img src="${esc(brandLogo())}" alt="Logo Humanevo" width="48" height="48"></span><div><strong>Humanevo</strong><small>Psicologia e Desenvolvimento Humano · v3.10.9</small></div></div><div class="portal-user"><div><strong>${esc(name)}</strong><small style="display:block;color:var(--muted)">${state.mode==='demo'?'Visualização demonstrativa':'Portal protegido'}</small></div><span class="portal-avatar">${initials(name)}</span><button class="btn btn-secondary" data-action="logout">${state.mode==='demo'?'Sair do teste':'Sair'}</button></div></header><nav class="portal-quick-nav" aria-label="Navegação do portal"><button type="button" data-action="portal-scroll" data-target="inicio">Visão geral</button><button type="button" class="portal-nav-appointments" data-action="portal-scroll" data-target="meus-agendamentos"><span>Meus agendamentos</span><b>${futureAppointments.length}</b></button><button type="button" data-action="portal-scroll" data-target="formularios">Formulários</button><button type="button" data-action="portal-scroll" data-target="chat-equipe">Chat</button></nav><main class="portal-main" id="inicio"><section class="portal-hero"><div class="portal-hero-copy"><div><h1>Olá, ${esc(String(name).split(' ')[0])}.</h1><p>Este é o seu espaço de acompanhamento. Seus próximos atendimentos ficam sempre disponíveis na área <strong>Meus agendamentos</strong>.</p></div><button type="button" class="portal-hero-agenda-btn" data-action="portal-scroll" data-target="meus-agendamentos"><span>Ver meus agendamentos</span><b>${futureAppointments.length} próximo(s)</b></button></div><div class="portal-kpis"><button type="button" class="portal-kpi portal-kpi-button" data-action="portal-scroll" data-target="meus-agendamentos"><strong>${futureAppointments.length}</strong><span>Próximos agendamentos</span></button><div class="portal-kpi"><strong>${pending.length}</strong><span>Formulários disponíveis</span></div><div class="portal-kpi"><strong>${submitted.length}</strong><span>Respostas enviadas</span></div><div class="portal-kpi"><strong>${threads.reduce((n,t)=>n+Number(t.unread_count||0),0)}</strong><span>Mensagens não lidas</span></div></div></section><section id="meus-agendamentos" class="portal-section patient-appointments-section portal-anchor-section"><div class="portal-section-head"><div><span class="portal-section-eyebrow">AGENDA DO PACIENTE</span><h2>Meus agendamentos</h2><p>Consultas registradas pela Gestão de Acolhimento, Psicólogo ou Administrador.</p></div><span class="patient-appointment-count">${appointments.length} registro(s)</span></div>${appointmentWarning}${renderPatientAppointments(appointments)}</section><section id="formularios" class="portal-section portal-anchor-section"><div class="portal-section-head"><div><h2>Formulários para responder</h2><p>Abra um formulário, salve o rascunho e envie quando estiver pronto.</p></div></div>${pending.length?`<div class="assignment-grid">${pending.map(renderAssignmentCard).join('')}</div>`:'<div class="empty-card">Nenhum formulário pendente no momento.</div>'}</section><section id="chat-equipe" class="portal-section portal-anchor-section"><div class="portal-section-head"><div><h2>Chat com a equipe</h2><p>Mensagens protegidas vinculadas ao seu atendimento.</p></div></div>${renderPatientChat(active,threads)}</section><section id="historico" class="portal-section portal-anchor-section"><div class="portal-section-head"><div><h2>Histórico de envios</h2><p>Formulários já encaminhados para análise profissional.</p></div></div>${submitted.length?`<div class="assignment-grid">${submitted.map(renderAssignmentCard).join('')}</div>`:'<div class="empty-card">Seu histórico aparecerá aqui após o primeiro envio.</div>'}</section></main></div>`;
    requestAnimationFrame(()=>{const box=document.querySelector('.portal-chat-messages');if(box)box.scrollTop=box.scrollHeight;const requested=params.get('section')==='agendamentos'?'meus-agendamentos':location.hash.replace('#','');if(requested)document.getElementById(requested)?.scrollIntoView({block:'start'});});
  }
  function renderPatientAppointments(appointments=[]){
    if(!appointments.length)return '<div class="empty-card">Nenhum agendamento foi registrado para o seu perfil.</div>';
    const now=Date.now();const ordered=[...appointments].sort((a,b)=>{const af=new Date(a.start).getTime()>=now?0:1;const bf=new Date(b.start).getTime()>=now?0:1;return af-bf||(af===0?new Date(a.start)-new Date(b.start):new Date(b.start)-new Date(a.start));}).slice(0,12);
    return `<div class="patient-appointment-grid">${ordered.map(item=>{const status=patientAppointmentStatus[item.status]||patientAppointmentStatus.pending;const modeTone=patientAppointmentMode[item.mode]||'neutral';const typeTone=patientAppointmentType[item.type]||'neutral';const online=/^https?:\/\//i.test(item.location||'');return `<article class="patient-appointment-card appointment-${item.status}"><header><div class="patient-appointment-date"><strong>${patientDateTime(item.start)}</strong><small>${item.end?`Término: ${new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(new Date(item.end))}`:''}</small></div><span class="patient-neon-status tone-${status.tone}"><i></i>${status.label}</span></header><div class="patient-appointment-badges"><span class="tone-${typeTone}">${esc(item.type)}</span><span class="tone-${modeTone}">${esc(item.mode)}</span></div><div class="patient-appointment-details"><span><b>Profissional</b>${esc(item.professional||'Equipe Humanevo')}</span><span><b>${online?'Link':'Local'}</b>${online?`<a href="${esc(item.location)}" target="_blank" rel="noopener">Abrir atendimento online</a>`:esc(item.location||'A confirmar')}</span></div>${item.notes?`<p>${esc(item.notes)}</p>`:''}</article>`;}).join('')}</div>`;
  }
  function chatOthers(thread={}){const me=state.context?.user?.id||'';return (thread.participants||[]).filter(p=>String(p.user_id)!==String(me));}
  function chatTitle(thread={}){const normalized=normalizePatientThread(thread);const meta=patientChannelMeta(normalized);if(normalized.channelType==='general')return normalized.title||meta.label;const others=chatOthers(normalized);if(normalized.channelType==='intake')return normalized.title||`Acolhimento${others.length?` · ${others.map(p=>p.full_name||p.email).filter(Boolean).join(', ')}`:''}`;return normalized.title||others.map(p=>p.full_name||p.email).filter(Boolean).join(', ')||'Equipe Humanevo';}
  function renderPatientAttachments(attachments=[]){if(!Array.isArray(attachments)||!attachments.length)return '';return `<div class="portal-chat-attachments">${attachments.map(file=>`<button type="button" data-action="patient-download-chat-attachment" data-id="${esc(file.id||'')}"><span>📎</span><span><strong>${esc(file.file_name||'Anexo')}</strong><small>${esc(formatFileSize(file.size_bytes))}</small></span><b>Baixar</b></button>`).join('')}</div>`;}
  function patientChannelAvatar(thread={},profile={},className='portal-chat-avatar'){const type=normalizePatientThread(thread).channelType;if(type==='general')return `<span class="${className} portal-channel-avatar channel-general">📣</span>`;if(type==='intake')return `<span class="${className} portal-channel-avatar channel-intake">♡</span>`;return avatarMarkup(profile,className);}
  function renderPatientChat(active,threads){
    const normalizedThreads=(threads||[]).map(normalizePatientThread).filter(thread=>thread.channelType!=='internal');
    if(!normalizedThreads.length)return '<div class="empty-card">Nenhuma conversa iniciada. O Canal Geral e o Acolhimento aparecerão após a sincronização.</div>';
    active=normalizedThreads.find(t=>String(t.id)===String(active?.id||state.activeChatThreadId))||normalizedThreads[0]||null;
    const messages=active?(state.chatMessages||[]).filter(m=>String(m.thread_id)===String(active.id)):[];const me=state.context?.user?.id||'';const primary=active?chatOthers(active)[0]||{}:{};const meta=active?patientChannelMeta(active):null;
    const notifyButton=typeof Notification!=='undefined'&&Notification.permission!=='granted'?'<button type="button" class="portal-chat-notify" data-action="patient-enable-chat-notifications">Ativar notificações</button>':'';
    const composer=active?.canPost!==false?`<form id="patient-chat-form"><input type="hidden" name="threadId" value="${active.id}"><div id="patient-chat-file-preview" class="portal-chat-file-preview"></div><div class="portal-chat-composer-row"><label class="portal-chat-attach" title="Inserir anexos">📎<input id="patient-chat-files" name="files" type="file" multiple hidden accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"></label><button type="button" class="portal-chat-voice" data-action="patient-chat-voice" aria-label="Iniciar digitação por voz" aria-pressed="false">🎙</button><textarea id="patient-chat-input" name="body" dir="ltr" maxlength="2000" placeholder="Escreva uma mensagem ou use o ditado..."></textarea><button type="button" class="btn btn-primary" data-action="patient-send-chat">Enviar</button></div><small class="portal-chat-help"><span>Enter envia · Shift/Alt + Enter quebra linha · Ctrl + Z desfaz</span><span>Até 5 arquivos, 15 MB cada.</span></small></form>`:`<div class="portal-chat-readonly"><strong>Canal somente para leitura</strong><span>Você pode acompanhar os comunicados publicados pela equipe.</span></div>`;
    return `<div class="portal-chat"><aside>${normalizedThreads.map(t=>{const p=chatOthers(t)[0]||{};const tm=patientChannelMeta(t);return `<button data-action="patient-chat-thread" data-id="${t.id}" class="${active&&String(active.id)===String(t.id)?'active':''}">${patientChannelAvatar(t,p,'portal-chat-avatar')}<div><span class="portal-chat-title"><strong>${esc(chatTitle(t))}</strong><em class="portal-channel-badge channel-${t.channelType}">${esc(tm.short)}</em></span><small>${esc(t.last_message||tm.description)}</small></div>${Number(t.unread_count||0)?`<b>${Number(t.unread_count)}</b>`:''}</button>`;}).join('')}</aside><div class="portal-chat-main">${active?`<header><div class="portal-chat-person">${patientChannelAvatar(active,primary,'portal-chat-header-avatar')}<div><strong>${esc(chatTitle(active))}</strong><span>${esc(meta.description)}</span></div></div>${notifyButton}</header><div class="portal-chat-messages">${messages.length?messages.map(m=>{const mine=String(m.sender_id)===String(me);const name=mine?'Você':m.sender_name||'Equipe';return `<article class="${mine?'mine':''}">${avatarMarkup({full_name:name,avatar_path:mine?state.context?.profile?.avatar_path:m.sender_avatar},'portal-chat-message-avatar')}<div><strong>${esc(name)}</strong>${m.body?`<p>${esc(m.body)}</p>`:''}${renderPatientAttachments(m.attachments||[])}<time>${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(m.created_at))}</time></div></article>`;}).join(''):'<div class="empty-card">A conversa está aberta. As mensagens aparecerão aqui.</div>'}</div>${composer}`:''}</div></div>`;
  }

  function renderAssignmentCard(a){const f=a.formSnapshot||{};const canOpen=['assigned','opened','in_progress'].includes(a.status);return `<article class="assignment-card"><span class="tag">${esc(assignmentStatus(a))}</span><h3>${esc(f.title||'Formulário')}</h3><p>${esc(a.message||f.description||'Orientação enviada pelo profissional.')}</p><div class="assignment-meta"><span>${esc(f.category||'Avaliação')}</span><span>${f.duration||10} min</span><span>Prazo: ${dateFmt(a.dueAt)}</span></div><div class="assignment-actions">${canOpen?`<button class="btn btn-primary" data-action="open-form" data-id="${a.id}">${a.status==='in_progress'?'Continuar':'Responder'}</button>`:`<button class="btn btn-secondary" data-action="open-form" data-id="${a.id}">Ver respostas</button>`}</div></article>`;}

  function renderQuestion(q,index,answers,readonly=false){const name=`q_${q.id||index}`;const value=answers[name];const disabled=readonly?'disabled':'';const title=`<label class="question-title">${index+1}. ${esc(q.label||q.title||'Pergunta')}${q.required?' *':''}</label>${q.help?`<span class="help">${esc(q.help)}</span>`:''}`;if(q.type==='section')return `<div class="patient-question"><h3>${esc(q.label||'Seção')}</h3></div>`;if(q.type==='info')return `<div class="patient-question"><p>${esc(q.label||'Informação')}</p></div>`;if(q.type==='longText')return `<div class="patient-question">${title}<textarea name="${name}" ${disabled}>${esc(value||'')}</textarea></div>`;if(['shortText','email','phone','number','date','time'].includes(q.type)){const inputType=({shortText:'text',email:'email',phone:'tel',number:'number',date:'date',time:'time'})[q.type];return `<div class="patient-question">${title}<input name="${name}" type="${inputType}" value="${esc(value||'')}" ${q.type==='phone'?'inputmode="tel" data-phone-mask':''} ${disabled}></div>`;}if(q.type==='scale')return `<div class="patient-question">${title}<input name="${name}" type="range" min="${q.min??0}" max="${q.max??10}" value="${esc(value??q.min??0)}" ${disabled}><div style="display:flex;justify-content:space-between;color:var(--muted);font-size:.8rem"><span>${esc(q.minLabel||'Mínimo')}</span><span>${esc(q.maxLabel||'Máximo')}</span></div></div>`;if(q.type==='rating'){const max=Math.max(1,Math.min(10,Number(q.max)||5));return `<div class="patient-question">${title}<div class="patient-rating-input">${Array.from({length:max},(_,i)=>`<label><input type="radio" name="${name}" value="${i+1}" ${String(value)===String(i+1)?'checked':''} ${disabled}><span>★</span><small>${i+1}</small></label>`).join('')}</div></div>`;}if(q.type==='yesNo')q={...q,type:'singleChoice',options:['Sim','Não']};if(q.type==='dropdown')return `<div class="patient-question">${title}<select name="${name}" ${disabled}><option value="">Selecione</option>${(q.options||[]).map(o=>`<option value="${esc(o)}" ${value===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;const multiple=q.type==='multipleChoice';const selected=Array.isArray(value)?value:[value].filter(Boolean);return `<div class="patient-question">${title}<div class="option-list">${(q.options||[]).map(o=>`<label class="option-item"><input type="${multiple?'checkbox':'radio'}" name="${name}" value="${esc(o)}" ${selected.includes(o)?'checked':''} ${disabled}><span>${esc(o)}</span></label>`).join('')}</div></div>`;}
  function openForm(id){const a=state.assignments.find(x=>x.id===id);if(!a)return;state.pendingAnswers=null;state.current=a;const form=a.formSnapshot||{};const readonly=['submitted','reviewed'].includes(a.status);const questions=form.questions||[];const actualQuestions=questions.filter(q=>!['section','info'].includes(q.type));const answers=a.answers||{};const answered=actualQuestions.filter((q,i)=>{const value=answers[`q_${q.id||i}`];return Array.isArray(value)?value.length>0:String(value??'').trim()!=='';}).length;const percent=readonly?100:Math.round((answered/Math.max(1,actualQuestions.length))*100);modalRoot.innerHTML=`<div class="patient-modal-backdrop"><section class="patient-modal-card"><header class="patient-modal-head"><div><h2>${esc(form.title||'Formulário')}</h2><p>${esc(form.description||a.message||'Responda com tranquilidade e revise antes do envio.')}</p></div><button class="close-btn" data-action="close-modal">×</button></header><form id="patient-response-form"><div class="patient-modal-body"><div class="form-progress-label"><span>${answered} de ${actualQuestions.length} questões respondidas</span><strong>${percent}%</strong></div><div class="form-progress"><i style="width:${percent}%"></i></div>${questions.map((q,i)=>renderQuestion(q,i,a.answers||{},readonly)).join('')||'<div class="empty-card">O formulário não possui questões configuradas.</div>'}</div><footer class="patient-modal-footer"><button type="button" class="btn btn-secondary" data-action="close-modal">Fechar</button>${!readonly?'<button type="button" class="btn btn-secondary" data-action="save-draft">Salvar rascunho</button><button type="button" class="btn btn-primary" data-action="submit-response">Enviar respostas</button>':''}</footer></form></section></div>`;}
  function updatePatientFormProgress(){
    const form=document.getElementById('patient-response-form');
    if(!form||!state.current)return;
    const questions=(state.current.formSnapshot?.questions||[]).filter(q=>!['section','info'].includes(q.type));
    const fd=new FormData(form);
    let answered=0;
    questions.forEach((q,i)=>{
      const key=`q_${q.id||i}`;
      const values=fd.getAll(key).filter(value=>String(value??'').trim()!=='');
      if(values.length) answered++;
    });
    const percent=Math.round((answered/Math.max(1,questions.length))*100);
    const label=form.querySelector('.form-progress-label span');
    const value=form.querySelector('.form-progress-label strong');
    const bar=form.querySelector('.form-progress i');
    if(label)label.textContent=`${answered} de ${questions.length} questões respondidas`;
    if(value)value.textContent=`${percent}%`;
    if(bar)bar.style.width=`${percent}%`;
  }

  function collectAnswers(){const form=document.getElementById('patient-response-form');const fd=new FormData(form);const out={};for(const [k,v] of fd.entries()){if(k in out)out[k]=Array.isArray(out[k])?[...out[k],v]:[out[k],v];else out[k]=v;}return out;}
  function showSubmitConfirmation(){
    if(!state.current)return;
    const responseForm=document.getElementById('patient-response-form');
    if(responseForm&&!responseForm.reportValidity())return;
    state.pendingAnswers=collectAnswers();
    state.current.answers=structuredClone(state.pendingAnswers);
    const currentAssignment=state.assignments.find(item=>item.id===state.current.id);
    if(currentAssignment)currentAssignment.answers=structuredClone(state.pendingAnswers);
    const form=state.current.formSnapshot||{};
    modalRoot.innerHTML=`<div class="patient-modal-backdrop submit-confirm-backdrop"><section class="submit-confirm-card" role="dialog" aria-modal="true" aria-labelledby="submit-confirm-title"><button class="submit-confirm-close" data-action="review-submit-response" aria-label="Fechar">×</button><div class="submit-confirm-visual"><span class="submit-confirm-glow"></span><span class="submit-confirm-shield"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 5 6v5c0 4.4 2.8 8 7 9.5 4.2-1.5 7-5.1 7-9.5V6l-7-3Z"/><path d="m8.8 12.1 2.1 2.1 4.5-5"/></svg></span></div><div class="submit-confirm-copy"><span class="submit-confirm-kicker">Envio protegido</span><h2 id="submit-confirm-title">Enviar respostas para análise profissional?</h2><p>Suas respostas serão encaminhadas com segurança para a equipe clínica da Humanevo.</p></div><div class="submit-confirm-info"><span>i</span><p>O formulário <strong>${esc(form.title||'selecionado')}</strong> ficará disponível no cockpit do profissional para revisão.</p></div><div class="submit-confirm-actions"><button class="btn submit-review-btn" data-action="review-submit-response"><span>◉</span> Revisar respostas</button><button class="btn submit-confirm-btn" data-action="confirm-submit-response"><span>➤</span> Confirmar envio</button></div></section></div>`;
  }
  function showSubmitSuccess(title='Formulário'){
    const demo=state.mode==='demo';
    modalRoot.innerHTML=`<div class="patient-modal-backdrop submit-confirm-backdrop"><section class="submit-success-card" role="dialog" aria-modal="true"><div class="success-orbit"><span class="success-check">✓</span></div><span class="submit-confirm-kicker">${demo?'Teste concluído':'Envio concluído'}</span><h2>Respostas enviadas com sucesso</h2><p>${demo?`O formulário <strong>${esc(title)}</strong> foi salvo somente nesta sessão demonstrativa. Nenhum dado real foi enviado ao Supabase.`:`O formulário <strong>${esc(title)}</strong> foi encaminhado para análise profissional.`}</p><div class="success-details"><span>✓ ${demo?'Sessão de teste atualizada':'Dados registrados com segurança'}</span><span>✓ ${demo?'Sem gravação de usuário real':'Profissional notificado'}</span><span>✓ Histórico atualizado no portal</span></div><button class="btn submit-confirm-btn" data-action="close-submit-success">Voltar ao portal</button></section></div>`;
  }
  async function saveDraft(submit=false){
    if(!state.current)return;
    const answers=submit&&state.pendingAnswers?structuredClone(state.pendingAnswers):collectAnswers();
    const submittedTitle=state.current.formSnapshot?.title||'Formulário';
    try{
      if(state.mode==='demo'){
        const data=readLocal();
        if(!data) throw new Error('Sessão demonstrativa inexistente. Reinicie o teste pelo Portal de Acesso.');
        const item=(data.formAssignments||[]).find(x=>x.id===state.current.id);
        if(!item) throw new Error('Formulário demonstrativo inexistente nesta sessão. Reinicie o teste para gerar uma nova amostra.');
        item.answers=answers;
        item.status=submit?'submitted':'in_progress';
        item.submittedAt=submit?new Date().toISOString():item.submittedAt;
        item.updatedAt=new Date().toISOString();
        if(submit){
          data.notifications=data.notifications||[];
          data.notifications.unshift({id:`note-${Date.now()}`,patientId:item.patientId,recipientRole:'psychologist',type:'form_submitted_demo',title:'Formulário respondido no modo teste',message:`${state.patient.name||'Paciente demonstrativo'} concluiu ${item.formSnapshot?.title||'um formulário'} na sessão de teste.`,createdAt:new Date().toISOString(),readAt:null,assignmentId:item.id,demo:true});
        }
        writeLocal(data);
        state.assignments=(data.formAssignments||[]).filter(a=>a.patientId===demoPatientId);
        state.notifications=(data.notifications||[]).filter(n=>n.patientId===demoPatientId);
      }else{
        if(!cloud?.auth?.access_token) throw Object.assign(new Error('Sessão expirada.'),{status:401});
        if(!state.current?.id) throw Object.assign(new Error('Formulário não encontrado.'),{status:404});
        submit?await cloud.submitResponse(state.current.id,answers):await cloud.saveDraft(state.current.id,answers);
        state.assignments=(await cloud.listMyAssignments()).map(normalizeCloudAssignment);
        state.notifications=await cloud.listNotifications();
      }
      state.pendingAnswers=null;
      render();
      if(submit)showSubmitSuccess(submittedTitle);else{modalRoot.innerHTML='';toast(state.mode==='demo'?'Rascunho salvo somente nesta sessão de teste.':'Rascunho salvo.');}
    }catch(error){
      toast(state.mode==='demo'?String(error.message||error):technicalFormError(error),'error');
    }
  }
  function scrollPatientChatLatest(behavior='auto'){requestAnimationFrame(()=>{const box=document.querySelector('.portal-chat-messages');if(box)box.scrollTo({top:box.scrollHeight,behavior});});}
  function setPatientVoiceState(active=false){const button=document.querySelector('[data-action="patient-chat-voice"]');if(!button)return;button.classList.toggle('listening',active);button.setAttribute('aria-pressed',String(active));}
  function insertPatientDictation(text=''){const field=patientSpeechTarget||document.getElementById('patient-chat-input');if(!field||!text)return;field.focus({preventScroll:true});const prefix=field.value&&field.selectionStart>0&&!/\s$/.test(field.value.slice(0,field.selectionStart))?' ':'';const value=`${prefix}${text}`;try{if(document.queryCommandSupported?.('insertText'))document.execCommand('insertText',false,value);else field.setRangeText(value,field.selectionStart??field.value.length,field.selectionEnd??field.value.length,'end');}catch(_){field.setRangeText(value,field.selectionStart??field.value.length,field.selectionEnd??field.value.length,'end');}field.dispatchEvent(new Event('input',{bubbles:true}));}
  function startPatientVoice(){const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Recognition)return toast('A digitação por voz requer Chrome ou Edge atualizado.','error');if(patientSpeechRecognition){try{patientSpeechRecognition.stop();}catch(_){}return;}const field=document.getElementById('patient-chat-input');if(!field)return;patientSpeechTarget=field;const recognition=new Recognition();patientSpeechRecognition=recognition;recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;recognition.onstart=()=>setPatientVoiceState(true);recognition.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)insertPatientDictation(String(event.results[i][0]?.transcript||'').trim());};recognition.onerror=event=>{if(!['aborted','no-speech'].includes(event.error))toast(`Não foi possível reconhecer a voz: ${event.error}.`,'error');};recognition.onend=()=>{patientSpeechRecognition=null;patientSpeechTarget=null;setPatientVoiceState(false);};try{recognition.start();}catch(error){patientSpeechRecognition=null;patientSpeechTarget=null;setPatientVoiceState(false);toast(error.message,'error');}}
  async function loadPatientChat(threadId){
    const requestId=++patientChatRequestSequence;state.activeChatThreadId=threadId;render();
    try{
      if(state.mode==='cloud'){
        const messages=await cloud.listChatMessages(threadId);if(requestId!==patientChatRequestSequence||String(state.activeChatThreadId)!==String(threadId))return;
        state.chatMessages=[...(state.chatMessages||[]).filter(m=>String(m.thread_id)!==String(threadId)),...messages];await cloud.markChatRead(threadId).catch(()=>{});
        const notifications=await cloud.listNotifications().catch(()=>state.notifications);if(requestId!==patientChatRequestSequence||String(state.activeChatThreadId)!==String(threadId))return;state.notifications=notifications;
      }
      render();scrollPatientChatLatest('auto');
    }catch(error){if(requestId===patientChatRequestSequence)toast(`Não foi possível abrir o chat: ${error.message}`,'error');}
  }
  function previewPatientChatFiles(input){const box=document.getElementById('patient-chat-file-preview');if(!box)return;box.innerHTML=[...(input?.files||[])].map(file=>`<span>📎 <strong>${esc(file.name)}</strong><small>${formatFileSize(file.size)}</small></span>`).join('');}
  async function sendPatientChat(){
    const form=document.getElementById('patient-chat-form');if(!form)return;const fd=new FormData(form);const body=String(fd.get('body')||'').trim();const threadId=String(fd.get('threadId')||'');const files=[...(form.querySelector('[name="files"]')?.files||[])];const active=(state.chatThreads||[]).map(normalizePatientThread).find(thread=>String(thread.id)===String(threadId));
    if(active?.canPost===false)return toast('Este canal é somente para leitura.','error');if(!body&&!files.length)return toast('Digite uma mensagem ou selecione um anexo.','error');if(files.length>5)return toast('Envie no máximo 5 anexos.','error');if(files.some(file=>file.size>15*1024*1024))return toast('Cada anexo deve ter no máximo 15 MB.','error');
    const button=form.querySelector('[data-action="patient-send-chat"]');if(button){button.disabled=true;button.textContent='Enviando...';}
    try{if(state.mode!=='cloud')throw new Error('O chat compartilhado não é enviado no modo demonstrativo.');if(files.length)await cloud.uploadChatAttachments(threadId,body,files);else await cloud.sendChatMessage(threadId,body);const [threads,messages,notifications]=await Promise.all([cloud.listChatThreads(),cloud.listChatMessages(threadId),cloud.listNotifications().catch(()=>state.notifications)]);if(String(state.activeChatThreadId)!==String(threadId))return;state.chatThreads=threads.map(normalizePatientThread);state.chatMessages=[...(state.chatMessages||[]).filter(m=>String(m.thread_id)!==String(threadId)),...messages];state.notifications=notifications;form.reset();render();scrollPatientChatLatest('smooth');toast(files.length?'Mensagem e anexos enviados.':'Mensagem enviada.');}catch(error){toast(String(error.message||error),'error');if(button){button.disabled=false;button.textContent='Enviar';}}
  }
  async function downloadPatientChatAttachment(id){try{const result=await cloud.downloadChatAttachment(id);downloadBlob(result.blob,result.filename||'anexo');toast('Download iniciado.');}catch(error){toast(`Não foi possível baixar o anexo: ${error.message}`,'error');}}
  async function enablePatientChatNotifications(){if(typeof Notification==='undefined')return toast('Este navegador não oferece notificações do sistema.','error');try{const permission=await Notification.requestPermission();renderPortalSafely();toast(permission==='granted'?'Notificações ativadas.':'Permissão não concedida.',permission==='granted'?'':'error');}catch(error){toast(error.message,'error');}}


  async function markNotification(n){if(state.mode==='cloud'&&!n.read_at)await cloud.markNotificationRead(n.id);else if(state.mode==='demo'&&!n.readAt){const data=readLocal();const found=(data.notifications||[]).find(x=>x.id===n.id);if(found)found.readAt=new Date().toISOString();writeLocal(data);} }
  function showUnreadPopup(){const n=state.notifications.find(item=>!(item.readAt||item.read_at));if(!n)return;const pop=document.createElement('div');pop.className='notification-pop';pop.innerHTML=`<strong>${esc(n.title||'Nova notificação')}</strong><p>${esc(n.message||'Você possui uma nova atualização.')}</p>`;document.body.appendChild(pop);if(typeof Notification!=='undefined'&&Notification.permission==='granted'){try{new Notification(n.title||'Humanevo',{body:n.message||'Você possui uma nova atualização.',icon:brandLogo(),tag:`humanevo-${n.id}`});}catch(_){}}markNotification(n).catch(()=>{});setTimeout(()=>pop.remove(),6500);}

  document.addEventListener('submit',async e=>{
    if(!['patient-login','patient-signup','patient-password-change'].includes(e.target.id))return;
    e.preventDefault();const fd=new FormData(e.target);
    if(e.target.id==='patient-password-change'){
      const password=String(fd.get('password')||'');const confirmation=String(fd.get('passwordConfirm')||'');
      if(password!==confirmation){toast('A confirmação da nova senha não confere.','error');return;}
      try{await cloud.completeRequiredPassword(password);await cloud.signOut();sessionStorage.removeItem('humanevo_access_granted');state.context=null;state.patient=null;state.authMode='login';renderLogin('', 'Senha atualizada. Entre novamente com a nova senha.');}catch(error){toast(technicalFormError(error),'error');}
      return;
    }
    if(e.target.id==='patient-signup'){
      try{await cloud.signUp(fd.get('email'),fd.get('password'),{full_name:fd.get('fullName'),phone:formatPhone(fd.get('phone')),requested_role:'patient'});state.authMode='login';renderLogin('', 'Cadastro recebido. Confirme o e-mail, quando solicitado, e aguarde a liberação do acesso pela clínica.');}
      catch(error){renderLogin(error.message);}
      return;
    }
    try{await cloud.signIn(fd.get('email'),fd.get('password'));sessionStorage.setItem('humanevo_access_granted',JSON.stringify({role:'patient',at:Date.now()}));app.innerHTML='<div class="patient-boot"><div><div class="patient-spinner"></div><p>Validando acesso...</p></div></div>';await initialize();}catch(error){renderLogin(error.message);}
  });
  document.addEventListener('click',async e=>{const t=e.target.closest('[data-action]');if(!t)return;const a=t.dataset.action;if(a==='auth-mode'){state.authMode=t.dataset.mode||'login';renderLogin();}else if(a==='open-form')openForm(t.dataset.id);else if(a==='close-modal'){if(e.target===t||t.tagName==='BUTTON')modalRoot.innerHTML='';}else if(a==='save-draft')await saveDraft(false);else if(a==='submit-response')showSubmitConfirmation();else if(a==='confirm-submit-response')await saveDraft(true);else if(a==='review-submit-response')openForm(state.current?.id);else if(a==='close-submit-success'){modalRoot.innerHTML='';state.current=null;state.pendingAnswers=null;render();}else if(a==='patient-chat-thread')await loadPatientChat(t.dataset.id);else if(a==='patient-send-chat')await sendPatientChat();else if(a==='patient-chat-voice')startPatientVoice();else if(a==='patient-download-chat-attachment')await downloadPatientChatAttachment(t.dataset.id);else if(a==='patient-enable-chat-notifications')await enablePatientChatNotifications();else if(a==='portal-scroll')scrollPortalTo(t.dataset.target);else if(a==='logout'){await cloud.signOut().catch(()=>{});sessionStorage.removeItem('humanevo_access_granted');sessionStorage.removeItem('humanevo_cloud_auth_v1');sessionStorage.removeItem('humanevo_demo_patient');sessionStorage.removeItem(DEMO_STORAGE_KEY);state.patient=null;state.assignments=[];location.replace('/');}});
  document.addEventListener('input',event=>{if(event.target.matches('[data-phone-mask]')){event.target.value=formatPhone(event.target.value);return;}if(event.target.closest('#patient-response-form'))updatePatientFormProgress();});
  document.addEventListener('change',event=>{if(event.target.id==='patient-chat-files')previewPatientChatFiles(event.target);if(event.target.closest('#patient-response-form'))updatePatientFormProgress();});
  document.addEventListener('keydown',event=>{if(event.target?.id==='patient-chat-input'&&event.key==='Enter'&&!event.isComposing){if(event.shiftKey||event.altKey)return;event.preventDefault();sendPatientChat();return;}if(event.key==='Enter'&&event.target.matches('input[type="password"]')){const form=event.target.closest('form');if(form){event.preventDefault();form.requestSubmit();}}});
  window.addEventListener('storage',()=>{if(state.mode==='demo')initialize();});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{}));
  }
  initialize();
  setInterval(()=>{ refreshPatientCloud(); }, Number(window.HUMANEVO_CONFIG?.POLL_INTERVAL_MS||30000));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshPatientCloud();});
})();
