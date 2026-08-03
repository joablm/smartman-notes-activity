(() => {
  'use strict';

  const cloud = window.HumanevoCloud;
  const config = window.HUMANEVO_CONFIG || {};
  const mobileMedia = window.matchMedia('(max-width: 820px), (pointer: coarse)');
  const applyDeviceMode = () => {
    const mobile = mobileMedia.matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    document.documentElement.dataset.device = mobile ? 'mobile' : 'desktop';
    document.body.classList.toggle('is-mobile', mobile);
  };
  applyDeviceMode();
  mobileMedia.addEventListener?.('change', applyDeviceMode);
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const passwordToggle = document.getElementById('password-toggle');
  const rememberEmail = document.getElementById('remember-email');
  const loginButton = document.getElementById('login-button');
  const message = document.getElementById('auth-message');
  const overlay = document.getElementById('status-overlay');
  const statusTitle = document.getElementById('status-title');
  const statusDescription = document.getElementById('status-description');
  const statusProfile = document.getElementById('status-profile');
  const statusLoader = document.getElementById('status-loader');
  const statusAction = document.getElementById('status-action');
  const version = document.getElementById('app-version');
  const forcedPasswordForm = document.getElementById('forced-password-form');
  const forcedPasswordInput = document.getElementById('forced-password');
  const forcedPasswordConfirm = document.getElementById('forced-password-confirm');
  const forcedPasswordButton = document.getElementById('forced-password-button');
  const globalBrandLogo = document.getElementById('global-brand-logo');

  async function loadGlobalBrandLogo() {
    if (!globalBrandLogo || !cloud?.configured || typeof cloud.getClinicBranding !== 'function') return;
    try {
      const row = await cloud.getClinicBranding(config.DEFAULT_CLINIC_ID || '');
      if (row && Object.prototype.hasOwnProperty.call(row, 'logo_data')) globalBrandLogo.src = row.logo_data || './assets/logo-humanevo.svg';
    } catch (_) {}
  }

  const roleLabels = {
    administrator: 'Administrador',
    psychologist: 'Psicólogo',
    intake_manager: 'Gestor de Acolhimento',
    patient: 'Paciente',
    admin: 'Administrador',
    professional: 'Psicólogo'
  };

  try {
    sessionStorage.removeItem('humanevo_access_granted');
    sessionStorage.removeItem('humanevo_cloud_auth_v1');
    localStorage.removeItem('humanevo_cloud_auth_v1');
    cloud?.saveAuth?.(null);
  } catch (_) {}

  const remembered = localStorage.getItem('humanevo_login_email') || '';
  if (remembered) {
    emailInput.value = remembered;
    rememberEmail.checked = true;
  }
  version.textContent = config.APP_VERSION || '3.10.9';
  loadGlobalBrandLogo();

  function showMessage(text, type = 'error') {
    message.textContent = text;
    message.className = `auth-message show ${type}`;
  }

  function clearMessage() {
    message.textContent = '';
    message.className = 'auth-message';
  }

  function setLoading(active) {
    loginButton.disabled = active;
    const label = loginButton.querySelector('span');
    if (label) label.textContent = active ? 'Validando acesso...' : 'Entrar com e-mail e senha';
  }

  function showStatus({ title, description, role = '', loading = true, action = false }) {
    statusTitle.textContent = title;
    statusDescription.textContent = description;
    statusProfile.hidden = !role;
    statusProfile.textContent = role;
    statusLoader.hidden = !loading;
    statusAction.hidden = !action;
    if (forcedPasswordForm) forcedPasswordForm.hidden = true;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function hideStatus() {
    overlay.classList.remove('show');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function friendlyError(error) {
    const raw = String(error?.message || error || '').toLowerCase();
    if (raw.includes('invalid login credentials')) return 'E-mail ou senha não conferem. Revise os dados e tente novamente.';
    if (raw.includes('email not confirmed')) return 'Seu e-mail ainda não foi confirmado. Verifique a caixa de entrada.';
    if (raw.includes('failed to fetch') || raw.includes('network')) return 'Não foi possível conectar agora. Verifique sua internet e tente novamente.';
    if (raw.includes('membership') || raw.includes('perfil')) return 'O usuário foi autenticado, mas o perfil ainda não está vinculado à plataforma.';
    return error?.message || 'Não foi possível concluir o acesso.';
  }

  function requiresPasswordChange(context) {
    return context?.user?.app_metadata?.force_password_change === true || context?.user?.user_metadata?.force_password_change === true;
  }

  function showForcedPasswordChange(context) {
    if (!forcedPasswordForm || !forcedPasswordInput || !forcedPasswordConfirm || !forcedPasswordButton) {
      throw new Error('A tela de troca obrigatória de senha não foi carregada. Atualize a página e tente novamente.');
    }
    const firstName = String(context?.profile?.full_name || context?.user?.email || 'usuário').split(' ')[0];
    statusTitle.textContent = `Olá, ${firstName}. Crie uma nova senha`;
    statusDescription.textContent = 'A senha temporária funcionou. Para concluir o primeiro acesso, substitua-a agora.';
    statusProfile.hidden = false;
    statusProfile.textContent = roleLabels[context?.membership?.role] || 'Perfil identificado';
    statusLoader.hidden = true;
    statusAction.hidden = true;
    forcedPasswordForm.hidden = false;
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    forcedPasswordInput.value = '';
    forcedPasswordConfirm.value = '';
    requestAnimationFrame(() => forcedPasswordInput.focus());
  }

  function routeForRole(role) {
    const normalized = ({admin:'administrator',professional:'psychologist'})[String(role||'').toLowerCase()] || String(role||'').toLowerCase();
    if (normalized === 'patient') return new URL('/portal-paciente', window.location.origin).href;
    if (['administrator', 'psychologist', 'intake_manager'].includes(normalized)) return new URL('/painel', window.location.origin).href;
    return '';
  }

  async function completeAccess(context, automatic = false) {
    const membership = context?.membership;
    if (!membership) {
      showStatus({
        title: 'Perfil ainda não vinculado',
        description: 'O acesso foi autenticado. Execute o arquivo de correção do vínculo incluído no pacote ou solicite a aprovação do perfil.',
        loading: false,
        action: true
      });
      return;
    }

    if (membership.status !== 'approved') {
      const statusText = membership.status === 'blocked' ? 'bloqueado' : membership.status === 'rejected' ? 'rejeitado' : membership.status === 'inactive' ? 'inativo' : 'aguardando aprovação';
      showStatus({
        title: 'Acesso ainda não liberado',
        description: `Seu cadastro está ${statusText}. Entre em contato com a administração da clínica.`,
        role: roleLabels[membership.role] || 'Perfil identificado',
        loading: false,
        action: true
      });
      return;
    }

    if (requiresPasswordChange(context)) {
      showForcedPasswordChange(context);
      return;
    }

    const destination = routeForRole(membership.role);
    if (!destination) {
      showStatus({
        title: 'Perfil não reconhecido',
        description: 'O acesso foi autenticado, mas o perfil não corresponde a um ambiente disponível.',
        loading: false,
        action: true
      });
      return;
    }

    sessionStorage.setItem('humanevo_access_granted', JSON.stringify({ userId: context?.user?.id || '', role: membership.role, at: Date.now() }));
    const firstName = String(context?.profile?.full_name || context?.user?.email || 'usuário').split(' ')[0];
    const roleLabel = roleLabels[membership.role] || membership.role;
    showStatus({
      title: automatic ? 'Sessão reconhecida' : `Bem-vindo, ${firstName}`,
      description: 'Seu perfil foi identificado. Estamos abrindo o ambiente correto.',
      role: roleLabel,
      loading: true
    });
    setTimeout(() => { window.location.replace(destination); }, 650);
  }

  async function tryExistingSession() {
    if (!cloud?.configured || !cloud.auth?.access_token) return;
    try {
      showStatus({ title: 'Reconhecendo sua sessão', description: 'Aguarde enquanto identificamos seu perfil.', loading: true });
      const context = await cloud.currentContext();
      await completeAccess(context, true);
    } catch (_) {
      await cloud.signOut().catch(() => {});
      hideStatus();
    }
  }

  passwordToggle.addEventListener('click', () => {
    const visible = passwordInput.type === 'text';
    passwordInput.type = visible ? 'password' : 'text';
    passwordToggle.setAttribute('aria-label', visible ? 'Exibir senha' : 'Ocultar senha');
    passwordInput.focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    if (!form.reportValidity()) return;
    if (!cloud?.configured) {
      showMessage('O serviço de acesso ainda não está configurado.', 'error');
      return;
    }
    setLoading(true);
    try {
      if (rememberEmail.checked) localStorage.setItem('humanevo_login_email', emailInput.value.trim().toLowerCase());
      else localStorage.removeItem('humanevo_login_email');
      await cloud.signIn(emailInput.value.trim(), passwordInput.value);
      showStatus({ title: 'Acesso autenticado', description: 'Agora estamos identificando o seu perfil.', loading: true });
      const context = await cloud.currentContext();
      await completeAccess(context);
    } catch (error) {
      await cloud.signOut().catch(() => {});
      hideStatus();
      showMessage(friendlyError(error), 'error');
      passwordInput.select();
    } finally {
      setLoading(false);
    }
  });

  forcedPasswordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    clearMessage();
    if (!forcedPasswordForm.reportValidity()) return;
    if (forcedPasswordInput.value !== forcedPasswordConfirm.value) {
      statusDescription.textContent = 'A confirmação não confere. Digite a mesma nova senha nos dois campos.';
      forcedPasswordConfirm.focus();
      return;
    }
    forcedPasswordButton.disabled = true;
    forcedPasswordButton.querySelector('span').textContent = 'Atualizando senha...';
    try {
      await cloud.completeRequiredPassword(forcedPasswordInput.value);
      await cloud.signOut().catch(() => {});
      forcedPasswordForm.hidden = true;
      statusTitle.textContent = 'Senha atualizada com sucesso';
      statusDescription.textContent = 'Entre novamente usando a nova senha para abrir seu ambiente.';
      statusProfile.hidden = true;
      statusLoader.hidden = true;
      statusAction.textContent = 'Entrar com a nova senha';
      statusAction.hidden = false;
      passwordInput.value = '';
    } catch (error) {
      statusDescription.textContent = friendlyError(error);
    } finally {
      forcedPasswordButton.disabled = false;
      forcedPasswordButton.querySelector('span').textContent = 'Salvar nova senha';
      forcedPasswordInput.value = '';
      forcedPasswordConfirm.value = '';
    }
  });

  statusAction?.addEventListener('click', async () => {
    await cloud.signOut().catch(() => {});
    hideStatus();
    statusAction.textContent = 'Voltar ao acesso';
    passwordInput.value = '';
    passwordInput.focus();
  });

  document.addEventListener('click', async event => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (!action) return;
    if (action === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (action === 'patient-signup') {
      window.location.assign('/portal-paciente?signup=1');
    } else if (action === 'demo-professional') {
      await cloud?.signOut?.().catch(() => {});
      sessionStorage.setItem('humanevo_demo_professional', '1');
      const target = new URL('/demo-profissional', window.location.origin);
      target.searchParams.set('demo', '1');
      target.searchParams.set('v', config.APP_VERSION || '3.10.9');
      window.location.replace(target.href);
    } else if (action === 'demo-patient') {
      await cloud?.signOut?.().catch(() => {});
      const now = new Date().toISOString();
      const demoState = {
        patients: [{ id:'p1', name:'Marina Alves', email:'marina.alves@email.com', phone:'(65) 99911-2034', status:'active', risk:'low' }],
        formAssignments: [{
          id:'demo-assignment-1', patientId:'p1', status:'assigned', dueAt:new Date(Date.now()+7*86400000).toISOString(),
          message:'Responda com tranquilidade. Você poderá salvar o rascunho antes de enviar.', createdAt:now, answers:{},
          formSnapshot:{ id:'demo-form-1', title:'Check-in de bem-estar', category:'Acompanhamento', description:'Uma breve percepção sobre como você está nesta semana.', duration:4, references:[], questions:[
            {id:'q1',type:'scale',label:'Como você avalia seu bem-estar geral hoje?',min:0,max:10,minLabel:'Muito baixo',maxLabel:'Muito alto',required:true},
            {id:'q2',type:'multipleChoice',label:'Quais aspectos mais influenciaram sua semana?',options:['Sono','Trabalho','Família','Relacionamentos','Saúde','Rotina'],required:false},
            {id:'q3',type:'longText',label:'Há algo importante que gostaria de compartilhar com o profissional?',required:false}
          ]}
        }],
        notifications: [{ id:'demo-note-1', patientId:'p1', title:'Novo formulário disponível', message:'O Check-in de bem-estar está pronto para ser respondido.', createdAt:now, readAt:null }]
      };
      sessionStorage.setItem('humanevo_demo_patient_state_v1', JSON.stringify(demoState));
      sessionStorage.setItem('humanevo_demo_patient', 'p1');
      const target = new URL('/demo-paciente', window.location.origin);
      target.searchParams.set('demo', 'p1');
      target.searchParams.set('v', config.APP_VERSION || '3.10.9');
      window.location.replace(target.href);
    }
  });

  passwordInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  requestAnimationFrame(() => {
    (remembered ? passwordInput : emailInput).focus();
  });
})();
