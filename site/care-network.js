(() => {
  'use strict';
  const VERSION='4.1.0';
  const state={context:null,modal:null,email:'',patientName:'',data:{education:{},caregivers:[]},saving:false};
  const qs=(sel,root=document)=>root.querySelector(sel);
  const qsa=(sel,root=document)=>[...root.querySelectorAll(sel)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function fieldByLabel(root, words){
    const labels=qsa('label',root);
    for(const label of labels){
      const t=normalize(label.textContent);
      if(words.some(w=>t.includes(normalize(w)))){
        const forId=label.getAttribute('for');
        const input=forId?document.getElementById(forId):label.querySelector('input,select,textarea')||label.parentElement?.querySelector('input,select,textarea');
        if(input)return input;
      }
    }
    return null;
  }
  function patientModal(){
    return qsa('[role="dialog"],.modal,.dialog,.modal-content,.drawer').find(el=>{
      const t=normalize(el.textContent).slice(0,500);
      return (t.includes('novo paciente')||t.includes('editar paciente')||t.includes('detalhes do paciente'))&&el.offsetParent!==null;
    })||null;
  }
  async function getContext(){
    if(state.context)return state.context;
    try{state.context=await window.HumanevoCloud?.currentContext();}catch(_){state.context=null;}
    return state.context;
  }
  async function canUse(){
    const ctx=await getContext();
    return ['administrator','psychologist'].includes(ctx?.membership?.role);
  }
  function patientIdentity(root){
    const email=fieldByLabel(root,['e-mail','email'])?.value?.trim()||'';
    const name=fieldByLabel(root,['nome completo','nome do paciente','nome'])?.value?.trim()||'';
    return {email,name};
  }
  function emptyCaregiver(type='responsible'){
    return {id:null,relationship:type,relationshipOther:'',fullName:'',cpf:'',rg:'',birthDate:'',phone:'',whatsapp:'',email:'',profession:'',sameAddress:true,address:'',legalGuardian:type==='mother'||type==='father'||type==='responsible',financialResponsible:false,mainContact:false,emergencyContact:false,authorizedClinicalInfo:false,authorizedPickup:false,status:'active',notes:''};
  }
  function addDefaultCaregivers(){
    if(state.data.caregivers.length)return;
    state.data.caregivers=[emptyCaregiver('mother'),emptyCaregiver('father'),emptyCaregiver('responsible')];
  }
  function readInput(root,name){const el=qs(`[name="${name}"]`,root);return el?.type==='checkbox'?!!el.checked:(el?.value||'');}
  function collect(){
    if(!state.modal)return;
    const edu={};
    ['schoolName','educationLevel','educationStage','schoolYear','className','schoolShift','schoolType','schoolCity','schoolState','schoolPhone','schoolEmail','teacherName','coordinatorName','enrollmentDate','learningDifficulties','schoolHistory','specialSupport','schoolContactAuthorized','schoolNotes'].forEach(k=>edu[k]=readInput(state.modal,k));
    state.data.education=edu;
    state.data.caregivers=qsa('.hv-person-card',state.modal).map(card=>{
      const d={id:card.dataset.id||null};
      ['relationship','relationshipOther','fullName','cpf','rg','birthDate','phone','whatsapp','email','profession','sameAddress','address','legalGuardian','financialResponsible','mainContact','emergencyContact','authorizedClinicalInfo','authorizedPickup','status','notes'].forEach(k=>d[k]=readInput(card,k));
      return d;
    });
  }
  function options(list,value){return list.map(([v,l])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`).join('');}
  function caregiverCard(c,i){
    const relationships=[['mother','Mãe'],['father','Pai'],['responsible','Responsável legal'],['grandmother','Avó'],['grandfather','Avô'],['aunt','Tia'],['uncle','Tio'],['stepmother','Madrasta'],['stepfather','Padrasto'],['sibling','Irmão ou irmã'],['judicial_tutor','Tutor judicial'],['caregiver','Cuidador'],['institution','Instituição de acolhimento'],['other','Outro']];
    return `<article class="hv-person-card" data-index="${i}" data-id="${esc(c.id||'')}">
      <div class="hv-person-card-head"><strong>${esc(c.fullName||relationships.find(x=>x[0]===c.relationship)?.[1]||'Vínculo familiar')}</strong><button type="button" class="hv-remove">Remover</button></div>
      <div class="hv-grid hv-grid-3">
        <div class="hv-field"><label>Vínculo</label><select name="relationship">${options(relationships,c.relationship)}</select></div>
        <div class="hv-field"><label>Nome completo</label><input name="fullName" value="${esc(c.fullName)}" autocomplete="name"></div>
        <div class="hv-field"><label>Outro vínculo</label><input name="relationshipOther" value="${esc(c.relationshipOther)}" placeholder="Descreva quando necessário"></div>
        <div class="hv-field"><label>CPF</label><input name="cpf" value="${esc(c.cpf)}" inputmode="numeric"></div>
        <div class="hv-field"><label>RG</label><input name="rg" value="${esc(c.rg)}"></div>
        <div class="hv-field"><label>Data de nascimento</label><input name="birthDate" type="date" value="${esc(c.birthDate)}"></div>
        <div class="hv-field"><label>Telefone</label><input name="phone" value="${esc(c.phone)}" inputmode="tel"></div>
        <div class="hv-field"><label>WhatsApp</label><input name="whatsapp" value="${esc(c.whatsapp)}" inputmode="tel"></div>
        <div class="hv-field"><label>E-mail</label><input name="email" type="email" value="${esc(c.email)}"></div>
        <div class="hv-field"><label>Profissão</label><input name="profession" value="${esc(c.profession)}"></div>
        <div class="hv-field"><label>Situação</label><select name="status">${options([['active','Ativo'],['inactive','Inativo'],['deceased','Falecido']],c.status||'active')}</select></div>
        <div class="hv-field"><label>Endereço</label><input name="address" value="${esc(c.address)}" placeholder="Preencha se diferente do paciente"></div>
        <div class="hv-field full"><div class="hv-flags">
          ${[['sameAddress','Mesmo endereço do paciente'],['legalGuardian','Responsável legal'],['financialResponsible','Responsável financeiro'],['mainContact','Contato principal'],['emergencyContact','Contato de emergência'],['authorizedClinicalInfo','Pode receber informações autorizadas'],['authorizedPickup','Pode acompanhar ou buscar o menor']].map(([k,l])=>`<label class="hv-check"><input type="checkbox" name="${k}" ${c[k]?'checked':''}>${l}</label>`).join('')}
        </div></div>
        <div class="hv-field full"><label>Observações de guarda, convivência ou restrições</label><textarea name="notes">${esc(c.notes)}</textarea></div>
      </div>
    </article>`;
  }
  function renderCaregivers(){
    const host=qs('#hv-caregivers',state.modal);if(!host)return;
    host.innerHTML=state.data.caregivers.map(caregiverCard).join('');
    qsa('.hv-remove',host).forEach(btn=>btn.addEventListener('click',()=>{collect();const card=btn.closest('.hv-person-card');state.data.caregivers.splice(Number(card.dataset.index),1);renderCaregivers();}));
  }
  function modalHtml(){
    const e=state.data.education||{};
    return `<div class="hv-care-backdrop" aria-hidden="true"><section class="hv-care-modal" role="dialog" aria-modal="true" aria-label="Rede de cuidado">
      <header class="hv-care-head"><div><h2>Rede de cuidado do paciente</h2><p>${esc(state.patientName||state.email||'Paciente')} · dados familiares, responsáveis e escolares</p></div><button type="button" class="hv-care-close" aria-label="Fechar">×</button></header>
      <nav class="hv-care-tabs"><button class="hv-care-tab active" data-tab="family">Família e responsáveis</button><button class="hv-care-tab" data-tab="school">Escola e escolaridade</button><button class="hv-care-tab" data-tab="privacy">Privacidade</button></nav>
      <main class="hv-care-body">
        <section class="hv-care-panel active" data-panel="family"><div class="hv-section-title"><h3>Vínculos familiares e responsáveis</h3><button type="button" class="hv-add">+ Adicionar vínculo</button></div><div class="hv-care-note">Cadastre mãe, pai e qualquer outra pessoa responsável. Marque separadamente quem possui responsabilidade legal, financeira, contato principal ou emergência.</div><div id="hv-caregivers"></div></section>
        <section class="hv-care-panel" data-panel="school"><div class="hv-section-title"><h3>Informações escolares e educacionais</h3></div><div class="hv-grid hv-grid-3">
          <div class="hv-field"><label>Nome da escola</label><input name="schoolName" value="${esc(e.schoolName)}"></div>
          <div class="hv-field"><label>Escolaridade</label><select name="educationLevel">${options([['','Selecione'],['early_childhood','Educação infantil'],['elementary_1','Ensino fundamental I'],['elementary_2','Ensino fundamental II'],['high_school','Ensino médio'],['higher_education','Ensino superior'],['special_education','Educação especial'],['eja','EJA'],['not_schooled','Não escolarizado'],['other','Outro']],e.educationLevel)}</select></div>
          <div class="hv-field"><label>Etapa de ensino</label><input name="educationStage" value="${esc(e.educationStage)}" placeholder="Ex.: alfabetização"></div>
          <div class="hv-field"><label>Ano ou série</label><input name="schoolYear" value="${esc(e.schoolYear)}"></div>
          <div class="hv-field"><label>Turma</label><input name="className" value="${esc(e.className)}"></div>
          <div class="hv-field"><label>Turno</label><select name="schoolShift">${options([['','Selecione'],['morning','Matutino'],['afternoon','Vespertino'],['night','Noturno'],['full_time','Integral']],e.schoolShift)}</select></div>
          <div class="hv-field"><label>Tipo de escola</label><select name="schoolType">${options([['','Selecione'],['municipal','Pública municipal'],['state','Pública estadual'],['federal','Federal'],['private','Privada'],['specialized','Especializada']],e.schoolType)}</select></div>
          <div class="hv-field"><label>Cidade</label><input name="schoolCity" value="${esc(e.schoolCity)}"></div>
          <div class="hv-field"><label>UF</label><input name="schoolState" maxlength="2" value="${esc(e.schoolState)}"></div>
          <div class="hv-field"><label>Telefone da escola</label><input name="schoolPhone" value="${esc(e.schoolPhone)}"></div>
          <div class="hv-field"><label>E-mail da escola</label><input name="schoolEmail" type="email" value="${esc(e.schoolEmail)}"></div>
          <div class="hv-field"><label>Data de ingresso</label><input name="enrollmentDate" type="date" value="${esc(e.enrollmentDate)}"></div>
          <div class="hv-field"><label>Professor(a)</label><input name="teacherName" value="${esc(e.teacherName)}"></div>
          <div class="hv-field"><label>Coordenador(a) ou orientador(a)</label><input name="coordinatorName" value="${esc(e.coordinatorName)}"></div>
          <div class="hv-field"><label>Necessidade de apoio especializado</label><input name="specialSupport" value="${esc(e.specialSupport)}"></div>
          <div class="hv-field full"><label>Dificuldades escolares relatadas</label><textarea name="learningDifficulties">${esc(e.learningDifficulties)}</textarea></div>
          <div class="hv-field full"><label>Histórico escolar relevante</label><textarea name="schoolHistory">${esc(e.schoolHistory)}</textarea></div>
          <div class="hv-field full"><label class="hv-check"><input type="checkbox" name="schoolContactAuthorized" ${e.schoolContactAuthorized?'checked':''}>Responsável autoriza contato com a escola</label></div>
          <div class="hv-field full"><label>Observações educacionais</label><textarea name="schoolNotes">${esc(e.schoolNotes)}</textarea></div>
        </div></section>
        <section class="hv-care-panel" data-panel="privacy"><div class="hv-care-note"><strong>Acesso protegido:</strong> esta área é exibida apenas para Administrador e Psicólogo. Gestor de Acolhimento, pacientes e demais perfis não recebem estes dados pelas políticas do Supabase.</div><p>As alterações são registradas com usuário, data e hora. Informações de guarda, vínculo e escola entram na exportação completa e no backup.</p></section>
      </main>
      <footer class="hv-care-footer"><span class="hv-care-status"></span><button type="button" class="hv-btn secondary hv-care-cancel">Cancelar</button><button type="button" class="hv-btn primary hv-care-save">Salvar rede de cuidado</button></footer>
    </section></div>`;
  }
  function close(){
    if(!state.modal)return;collect();const b=state.modal;b.classList.remove('is-open');setTimeout(()=>{b.remove();state.modal=null;},220);
  }
  async function load(){
    if(!state.email)return;
    const status=qs('.hv-care-status',state.modal);status.textContent='Carregando...';
    try{
      const result=await window.HumanevoCloud.rpc('humanevo_get_patient_care_network',{target_patient_email:state.email});
      const row=Array.isArray(result)?result[0]:result;
      if(row){state.data.education=row.education||{};state.data.caregivers=Array.isArray(row.caregivers)?row.caregivers:[];}
      addDefaultCaregivers();renderCaregivers();status.textContent='Dados sincronizados.';
    }catch(error){addDefaultCaregivers();renderCaregivers();status.textContent=error?.status===404?'Execute o SQL V4.1.0 no Supabase.':'Não foi possível carregar agora.';}
  }
  async function save(){
    if(state.saving)return;collect();state.saving=true;
    const btn=qs('.hv-care-save',state.modal),status=qs('.hv-care-status',state.modal);btn.disabled=true;status.textContent='Salvando...';
    try{
      await window.HumanevoCloud.rpc('humanevo_save_patient_care_network',{target_patient_email:state.email,education_data:state.data.education,caregivers_data:state.data.caregivers});
      status.textContent='Salvo com sucesso.';setTimeout(close,650);
    }catch(error){status.textContent=error?.message||'Falha ao salvar.';}finally{state.saving=false;btn.disabled=false;}
  }
  async function open(root){
    if(!(await canUse()))return;
    const id=patientIdentity(root);if(!id.email){alert('Informe e salve o e-mail do paciente antes de abrir a Rede de cuidado.');return;}
    state.email=id.email;state.patientName=id.name;state.data={education:{},caregivers:[]};
    document.body.insertAdjacentHTML('beforeend',modalHtml());state.modal=qs('.hv-care-backdrop:last-of-type');requestAnimationFrame(()=>state.modal.classList.add('is-open'));
    qs('.hv-care-close',state.modal).addEventListener('click',close);qs('.hv-care-cancel',state.modal).addEventListener('click',close);qs('.hv-care-save',state.modal).addEventListener('click',save);
    qs('.hv-add',state.modal).addEventListener('click',()=>{collect();state.data.caregivers.push(emptyCaregiver('other'));renderCaregivers();});
    qsa('.hv-care-tab',state.modal).forEach(tab=>tab.addEventListener('click',()=>{qsa('.hv-care-tab',state.modal).forEach(x=>x.classList.toggle('active',x===tab));qsa('.hv-care-panel',state.modal).forEach(x=>x.classList.toggle('active',x.dataset.panel===tab.dataset.tab));}));
    state.modal.addEventListener('click',e=>{if(e.target===state.modal)close();});
    await load();
  }
  async function enhance(root){
    if(root.dataset.hvCareEnhanced==='1'||!(await canUse()))return;
    root.dataset.hvCareEnhanced='1';
    const footer=qsa('button',root).map(b=>b.parentElement).find(p=>p&&/salvar|cadastrar|atualizar/i.test(p.textContent||''))||root;
    const button=document.createElement('button');button.type='button';button.className='hv-care-launch';button.innerHTML='<span aria-hidden="true">◎</span> Rede de cuidado e escola';button.addEventListener('click',()=>open(root));footer.insertBefore(button,footer.firstChild||null);
  }
  let timer=0;const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{const m=patientModal();if(m)enhance(m);},80);});
  document.addEventListener('DOMContentLoaded',()=>{observer.observe(document.documentElement,{childList:true,subtree:true});const m=patientModal();if(m)enhance(m);});
  window.HumanevoCareNetwork={version:VERSION,open};
})();
