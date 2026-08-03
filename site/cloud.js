(() => {
  'use strict';
  const cfg = window.HUMANEVO_CONFIG || {};
  const AUTH_KEY = 'humanevo_cloud_auth_v1';

  class HumanevoCloudClient {
    constructor() {
      this.url = String(cfg.SUPABASE_URL || '').replace(/\/$/, '');
      this.key = String(cfg.SUPABASE_PUBLISHABLE_KEY || '');
      try { localStorage.removeItem(AUTH_KEY); } catch (_) {}
      this.auth = this.loadAuth();
      this.refreshing = null;
    }
    get configured() { return /^https:\/\/.+\.supabase\.co$/i.test(this.url) && this.key.length > 30; }
    loadAuth() { try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); } catch (_) { return null; } }
    saveAuth(value) { this.auth = value || null; value ? sessionStorage.setItem(AUTH_KEY, JSON.stringify(value)) : sessionStorage.removeItem(AUTH_KEY); }
    headers(auth = true, extra = {}, json = true) {
      const headers = { apikey: this.key, ...extra };
      if (auth && this.auth?.access_token) headers.Authorization = `Bearer ${this.auth.access_token}`;
      if (json && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
      return headers;
    }
    async parse(response) {
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = raw; }
      if (!response.ok) {
        const message = data?.message || data?.msg || data?.error_description || data?.hint || `Falha ${response.status}`;
        const error = new Error(message); error.status = response.status; error.data = data; throw error;
      }
      return data;
    }
    async raw(path, options = {}) {
      if (!this.configured) throw new Error('Banco central não configurado.');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(options.timeout || 12000));
      try {
        const response = await fetch(`${this.url}${path}`, {
          method: options.method || 'GET',
          headers: this.headers(options.auth !== false, options.headers || {}, options.json !== false),
          body: options.body,
          signal: controller.signal,
          mode: 'cors',
          cache: 'no-store'
        });
        return await this.parse(response);
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error('O Supabase demorou para responder. Verifique a disponibilidade do projeto e tente novamente.');
          timeoutError.code = 'SUPABASE_TIMEOUT'; timeoutError.path = path; throw timeoutError;
        }
        const message = String(error?.message || '');
        if (error instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
          const networkError = new Error('Não foi possível comunicar com o Supabase. Verifique a URL do projeto, a conexão e as regras de rede.');
          networkError.code = 'SUPABASE_NETWORK'; networkError.path = path; networkError.cause = error; throw networkError;
        }
        throw error;
      } finally { clearTimeout(timer); }
    }
    async refresh() {
      if (!this.auth?.refresh_token) throw new Error('Sessão expirada.');
      if (!this.refreshing) {
        this.refreshing = this.raw('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST', auth: false, body: JSON.stringify({ refresh_token: this.auth.refresh_token })
        }).then(data => { this.saveAuth(data); return data; }).finally(() => { this.refreshing = null; });
      }
      return this.refreshing;
    }
    async request(path, options = {}, retry = true) {
      try { return await this.raw(path, options); }
      catch (error) {
        if (retry && error.status === 401 && this.auth?.refresh_token && options.auth !== false) {
          await this.refresh(); return this.request(path, options, false);
        }
        throw error;
      }
    }
    async signIn(email, password) {
      const data = await this.raw('/auth/v1/token?grant_type=password', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password })
      });
      this.saveAuth(data); return data;
    }
    async signUp(email, password, metadata = {}) {
      return this.raw('/auth/v1/signup', {
        method: 'POST', auth: false, body: JSON.stringify({ email, password, data: metadata })
      });
    }
    async adminApi(body = {}, options = {}, retry = true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(options.timeout || 20000));
      const headers = { 'Content-Type': 'application/json' };
      if (options.auth !== false && this.auth?.access_token) headers.Authorization = `Bearer ${this.auth.access_token}`;
      try {
        const response = await fetch('/api/humanevo-user', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'same-origin'
        });
        return await this.parse(response);
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error('O serviço administrativo do Cloudflare demorou para responder. Tente novamente.');
          timeoutError.code = 'CLOUDFLARE_ADMIN_TIMEOUT'; throw timeoutError;
        }
        if (retry && error?.status === 401 && this.auth?.refresh_token && options.auth !== false) {
          await this.refresh();
          return this.adminApi(body, options, false);
        }
        const message = String(error?.message || '');
        if (error instanceof TypeError || /failed to fetch|networkerror|load failed|network request failed/i.test(message)) {
          const networkError = new Error('O serviço administrativo do Cloudflare não respondeu. Publique o pacote completo com o arquivo _worker.js.');
          networkError.code = 'CLOUDFLARE_ADMIN_API_UNREACHABLE'; networkError.cause = error; throw networkError;
        }
        if (error?.status === 404) {
          const missing = new Error('A rota administrativa do Cloudflare não foi encontrada. Confirme que o arquivo _worker.js foi publicado na raiz do projeto.');
          missing.status = 404; missing.code = 'CLOUDFLARE_WORKER_NOT_FOUND'; missing.data = error?.data; throw missing;
        }
        if (error?.status === 401) {
          const authError = new Error('A sessão administrativa expirou. Entre novamente e repita a operação.');
          authError.status = 401; authError.code = 'ADMIN_API_UNAUTHORIZED'; authError.data = error?.data; throw authError;
        }
        throw error;
      } finally { clearTimeout(timer); }
    }
    async managedUserFunctionHealth() {
      return this.adminApi({ action: 'health' }, { auth: false, timeout: 12000 });
    }
    async managedUserSessionCheck() {
      return this.adminApi({ action: 'session_check' });
    }
    async createManagedUser(payload = {}) {
      return this.adminApi({ action:'manage_user', ...payload });
    }
    async completeRequiredPassword(password) {
      const result=await this.adminApi({ action:'complete_password_change', password });
      if(this.auth?.user&&result?.user){this.auth.user={...this.auth.user,...result.user};this.saveAuth(this.auth);}
      return result;
    }
    async signOut() {
      try { if (this.auth?.access_token) await this.raw('/auth/v1/logout', { method: 'POST' }); } catch (_) {}
      this.saveAuth(null);
    }
    async user() {
      if (!this.auth?.access_token) return null;
      const user = await this.request('/auth/v1/user');
      if (this.auth) { this.auth.user = user; this.saveAuth(this.auth); }
      return user;
    }
    async rest(table, query = '', options = {}) {
      const method = options.method || 'GET';
      const headers = { Prefer: options.prefer || (method === 'POST' ? 'return=representation' : method === 'PATCH' ? 'return=representation' : '') };
      if (!headers.Prefer) delete headers.Prefer;
      return this.request(`/rest/v1/${table}${query ? `?${query}` : ''}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
      });
    }
    async rpc(name, body = {}) {
      return this.request(`/rest/v1/rpc/${name}`, { method: 'POST', body: JSON.stringify(body) });
    }
    async upload(bucket, path, file) {
      return this.request(`/storage/v1/object/${bucket}/${encodeURI(path)}`, {
        method: 'POST', json: false,
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' },
        body: file
      });
    }
    async download(bucket, path) {
      const response = await fetch(`${this.url}/storage/v1/object/authenticated/${bucket}/${encodeURI(path)}`, { headers: this.headers(true, {}, false) });
      if (!response.ok) throw new Error('Não foi possível baixar o arquivo.');
      return response.blob();
    }
    normalizeRole(role) {
      const value = String(role || '').toLowerCase();
      return ({ admin:'administrator', professional:'psychologist', acolhimento:'intake_manager', secretary:'intake_manager' })[value] || value;
    }
    async ensureMyAccess() {
      try { return await this.rpc('humanevo_ensure_my_access', {}); }
      catch (error) {
        // A função pode ainda não ter sido instalada. O login continua com fallback local para o administrador padrão.
        if (![404, 400].includes(error?.status)) console.warn('Não foi possível reparar o vínculo automaticamente.', error);
        return null;
      }
    }
    async currentContext() {
      const user = await this.user();
      if (!user) return null;
      const loadMembership = async () => {
        const rows = await this.rest('humanevo_memberships', `user_id=eq.${encodeURIComponent(user.id)}&select=id,clinic_id,user_id,role,status,professional_registration,approved_at,created_at&limit=1`);
        return rows?.[0] || null;
      };
      const loadProfile = async () => {
        const rows = await this.rest('humanevo_profiles', `id=eq.${encodeURIComponent(user.id)}&select=id,full_name,email,phone,avatar_path&limit=1`);
        return rows?.[0] || {};
      };
      let membership = await loadMembership();
      if (!membership) {
        await this.ensureMyAccess();
        membership = await loadMembership();
      }
      let profile = {};
      try { profile = await loadProfile(); } catch (_) {}
      if (membership) {
        membership.role = this.normalizeRole(membership.role);
        return { user, membership, profile };
      }
      const defaultAdmin = String(cfg.DEFAULT_ADMIN_EMAIL || '').trim().toLowerCase();
      if (defaultAdmin && String(user.email || '').trim().toLowerCase() === defaultAdmin) {
        return {
          user,
          profile: { id:user.id, full_name:user.user_metadata?.full_name || 'Joab Lopes Mata', email:user.email || defaultAdmin, phone:'' },
          membership: {
            id:'local-admin-fallback', clinic_id:cfg.DEFAULT_CLINIC_ID, user_id:user.id,
            role:'administrator', status:'approved', synthetic:true
          }
        };
      }
      return { user, membership:null, profile };
    }
    async getClinicBranding(clinicId = '') {
      const target = String(clinicId || cfg.DEFAULT_CLINIC_ID || '').trim();
      if (!target) return null;
      try {
        const rows = await this.raw('/rest/v1/rpc/humanevo_get_clinic_branding', {
          method: 'POST', auth: false, body: JSON.stringify({ target_clinic: target })
        });
        return Array.isArray(rows) ? (rows[0] || null) : (rows || null);
      } catch (error) {
        if ([400, 404].includes(Number(error?.status || 0))) return null;
        throw error;
      }
    }
    async saveClinicBranding({ clinicId = '', logoData = '', logoMime = '', logoName = '' } = {}) {
      const target = String(clinicId || cfg.DEFAULT_CLINIC_ID || '').trim();
      if (!target) throw new Error('A clínica não foi identificada para salvar a logo.');
      return this.rpc('humanevo_set_clinic_branding', {
        target_clinic: target,
        logo_data_value: String(logoData || ''),
        logo_mime_value: String(logoMime || ''),
        logo_name_value: String(logoName || '')
      });
    }
    async listPatients() {
      try {
        const rows=await this.rpc('humanevo_list_patients_safe', {});
        return Array.isArray(rows)?rows:[];
      } catch (error) {
        if ([400,404].includes(Number(error?.status||0))) {
          const migrationError=new Error('A atualização de privacidade V3.9.0 ainda não foi instalada no Supabase. Execute o arquivo HUMANEVO_V3_9_0_DADOS_CHAT.sql antes de sincronizar pacientes.');
          migrationError.code='HUMANEVO_V390_MIGRATION_REQUIRED';
          migrationError.status=error?.status;
          migrationError.cause=error;
          throw migrationError;
        }
        throw error;
      }
    }
    async listAppointments() {
      return this.rest('humanevo_appointments', 'select=*&order=starts_at.asc');
    }
    async listMyAppointments(patientId='') {
      const filter=patientId?`patient_id=eq.${encodeURIComponent(patientId)}&`:'';
      return this.rest('humanevo_appointments', `${filter}select=*&order=starts_at.asc`);
    }
    async upsertAppointment(appointment={}) {
      const body={clinic_id:appointment.clinicId,patient_id:appointment.patientId,professional_id:appointment.professionalId||null,starts_at:new Date(appointment.start).toISOString(),ends_at:new Date(appointment.end).toISOString(),session_type:appointment.type||'Consulta',mode:appointment.mode||'Presencial',status:appointment.status||'pending',location:appointment.location||'',notes:appointment.notes||'',reminder:appointment.reminder||'24h',updated_at:new Date().toISOString()};
      if(appointment.cloudId)return this.rest('humanevo_appointments',`id=eq.${encodeURIComponent(appointment.cloudId)}`,{method:'PATCH',body});
      delete body.updated_at;return this.rest('humanevo_appointments','',{method:'POST',body});
    }
    async deleteAppointment(appointmentId) {
      return this.rest('humanevo_appointments',`id=eq.${encodeURIComponent(appointmentId)}`,{method:'DELETE',prefer:'return=representation'});
    }
    async listForms() {
      return this.rest('humanevo_forms', 'select=*&status=eq.active&order=updated_at.desc');
    }
    async listAssignmentsForStaff() {
      return this.rest('humanevo_form_assignments', 'select=*,humanevo_forms(*),humanevo_patients(*)&order=created_at.desc');
    }
    async listMyAssignments() {
      return this.rest('humanevo_form_assignments', 'select=*,humanevo_forms(*),humanevo_form_responses(*)&order=created_at.desc');
    }
    async listNotifications() {
      return this.rest('humanevo_notifications', 'select=*&order=created_at.desc&limit=100');
    }
    async listMemberships() {
      return this.rest('humanevo_memberships', 'select=id,user_id,role,status,professional_registration,created_at,humanevo_profiles(full_name,email,phone,avatar_path)&order=created_at.desc');
    }
    async upsertPatient(patient) {
      return this.rpc('humanevo_upsert_patient', {
        target_patient_id: patient.cloudId || null,
        target_full_name: patient.name || '',
        target_email: patient.email || '',
        target_phone: patient.phone || '',
        target_birth_date: patient.birth || null,
        target_address_zip: patient.addressZip || '',
        target_address_street: patient.addressStreet || '',
        target_address_number: patient.addressNumber || '',
        target_address_complement: patient.addressComplement || '',
        target_address_neighborhood: patient.addressNeighborhood || '',
        target_address_city: patient.addressCity || '',
        target_address_state: patient.addressState || '',
        target_demand: patient.demand || '',
        target_process_status: patient.status || 'active',
        target_risk_level: patient.risk || 'none',
        target_diagnosis: patient.diagnosis || '',
        target_prognosis: patient.prognosis || '',
        target_recommendation: patient.recommendation || '',
        target_referral: patient.referral || '',
        target_treatment_progress: Number(patient.treatmentProgress) || 0,
        target_block_reason: patient.blockReason || '',
        target_tags: Array.isArray(patient.tags) ? patient.tags : []
      });
    }
    async deleteSinglePatient(patientId) {
      return this.rpc('humanevo_delete_patient', { target_patient_id:patientId });
    }
    async deletePatients(patientIds = []) {
      const ids=[...new Set((patientIds||[]).filter(Boolean))];
      if(!ids.length) return [];
      return this.rpc('humanevo_delete_patients_bulk', { target_patient_ids:ids });
    }
    async setMembershipStatus(userId, status, role = null) {
      return this.rpc('humanevo_set_membership_status', { target_user_id:userId, new_status:status, new_role:role });
    }
    async getMyPermissions() {
      return this.rpc('humanevo_my_permissions', {});
    }
    async listAccessControl() {
      const [roles,users]=await Promise.all([
        this.rest('humanevo_role_permissions','select=role,permission_key,allowed,updated_at&order=role,permission_key'),
        this.rest('humanevo_user_permission_exceptions','select=user_id,permission_key,allowed,updated_at&order=user_id,permission_key')
      ]);
      return {roles:roles||[],users:users||[]};
    }
    async upsertRolePermission(role, permissionKey, allowed) {
      const body={clinic_id:cfg.DEFAULT_CLINIC_ID,role,permission_key:permissionKey,allowed:!!allowed};
      return this.rest('humanevo_role_permissions','on_conflict=clinic_id,role,permission_key',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body});
    }
    async setUserPermission(userId, permissionKey, allowed) {
      const query=`clinic_id=eq.${encodeURIComponent(cfg.DEFAULT_CLINIC_ID)}&user_id=eq.${encodeURIComponent(userId)}&permission_key=eq.${encodeURIComponent(permissionKey)}`;
      if(allowed===null) return this.rest('humanevo_user_permission_exceptions',query,{method:'DELETE',prefer:'return=representation'});
      const body={clinic_id:cfg.DEFAULT_CLINIC_ID,user_id:userId,permission_key:permissionKey,allowed:!!allowed};
      return this.rest('humanevo_user_permission_exceptions','on_conflict=clinic_id,user_id,permission_key',{method:'POST',prefer:'resolution=merge-duplicates,return=representation',body});
    }
    async assignForm(patientId, formId, dueAt, message) {
      return this.rpc('humanevo_assign_form', { target_patient_id: patientId, target_form_id: formId, target_due_at: dueAt || null, target_message: message || '' });
    }
    async saveDraft(assignmentId, answers) {
      return this.rpc('humanevo_save_form_draft', { assignment_uuid: assignmentId, response_answers: answers || {} });
    }
    async submitResponse(assignmentId, answers) {
      return this.rpc('humanevo_submit_form_response', { assignment_uuid: assignmentId, response_answers: answers || {} });
    }
    async markNotificationRead(notificationId) {
      return this.rpc('humanevo_mark_notification_read', { notification_uuid: notificationId });
    }
    async listChatUsers() {
      const rows=await this.rpc('humanevo_chat_users', {});
      return Array.isArray(rows)?rows:[];
    }
    async listChatThreads() {
      const rows=await this.rpc('humanevo_list_my_chat_threads', {});
      return Array.isArray(rows)?rows:[];
    }
    async listChatMessages(threadId) {
      const rows=await this.rpc('humanevo_list_chat_messages', { thread_uuid:threadId });
      return Array.isArray(rows)?rows:[];
    }
    async ensureChatChannels() {
      return this.rpc('humanevo_sync_system_chat_channels', {});
    }
    async openIntakeChat(patientUserId=null) {
      return this.rpc('humanevo_open_intake_chat', { target_patient_user_id:patientUserId||null });
    }
    async createChatThread(userIds=[], title='', patientId=null, channelType='private') {
      return this.rpc('humanevo_create_chat_channel', { target_user_ids:userIds, target_title:title||'', target_patient_id:patientId||null, target_channel_type:channelType||'private' });
    }
    async sendChatMessage(threadId, body) {
      return this.rpc('humanevo_send_chat_message', { thread_uuid:threadId, message_body:body });
    }
    async markChatRead(threadId) {
      return this.rpc('humanevo_mark_chat_read', { thread_uuid:threadId });
    }
    async chatApi(body = {}, options = {}, retry = true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(options.timeout || 30000));
      try {
        const response = await fetch('/api/humanevo-chat', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', ...(this.auth?.access_token?{Authorization:`Bearer ${this.auth.access_token}`}:{}) },
          body:JSON.stringify(body), signal:controller.signal, cache:'no-store', credentials:'same-origin'
        });
        return await this.parse(response);
      } catch(error) {
        if(error?.name==='AbortError'){const e=new Error('O serviço do chat demorou para responder.');e.code='CHAT_API_TIMEOUT';throw e;}
        if(retry&&error?.status===401&&this.auth?.refresh_token){await this.refresh();return this.chatApi(body,options,false);}
        throw error;
      } finally { clearTimeout(timer); }
    }
    async uploadChatAttachments(threadId, body = '', files = [], retry = true) {
      const form=new FormData();form.append('threadId',threadId);form.append('body',body||'');
      [...files].forEach(file=>form.append('files',file,file.name));
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
      try {
        const response=await fetch('/api/humanevo-chat',{method:'POST',headers:{...(this.auth?.access_token?{Authorization:`Bearer ${this.auth.access_token}`}:{})},body:form,signal:controller.signal,cache:'no-store',credentials:'same-origin'});
        return await this.parse(response);
      } catch(error) {
        if(error?.name==='AbortError'){const e=new Error('O envio do anexo excedeu o tempo limite.');e.code='CHAT_UPLOAD_TIMEOUT';throw e;}
        if(retry&&error?.status===401&&this.auth?.refresh_token){await this.refresh();return this.uploadChatAttachments(threadId,body,files,false);}
        throw error;
      } finally {clearTimeout(timer);}
    }
    async downloadChatAttachment(attachmentId, retry = true) {
      const response=await fetch(`/api/humanevo-chat?attachment=${encodeURIComponent(attachmentId)}`,{headers:{...(this.auth?.access_token?{Authorization:`Bearer ${this.auth.access_token}`}:{})},cache:'no-store',credentials:'same-origin'});
      if(response.status===401&&retry&&this.auth?.refresh_token){await this.refresh();return this.downloadChatAttachment(attachmentId,false);}
      if(!response.ok){const raw=await response.text();let data=null;try{data=JSON.parse(raw);}catch(_){}const error=new Error(data?.error||data?.message||`Falha ${response.status}`);error.status=response.status;error.data=data;throw error;}
      const disposition=response.headers.get('Content-Disposition')||'';
      let filename='anexo';const utf=disposition.match(/filename\*=UTF-8''([^;]+)/i);const basic=disposition.match(/filename="?([^";]+)"?/i);
      try{filename=decodeURIComponent(utf?.[1]||basic?.[1]||filename);}catch(_){}
      return {blob:await response.blob(),filename};
    }
    async chatHealth() {
      return this.chatApi({action:'health'},{timeout:15000});
    }
    async clearAllChatConversations() {
      return this.chatApi({action:'clear_all'},{timeout:60000});
    }
    async backupApi(body = {}, options = {}, retry = true) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Number(options.timeout || 120000));
      try {
        const method=options.method||'POST';
        const query=options.query?`?${options.query}`:'';
        const response = await fetch(`/api/humanevo-backups${query}`, {
          method,
          headers:{ 'Content-Type':'application/json', ...(this.auth?.access_token?{Authorization:`Bearer ${this.auth.access_token}`}:{}) },
          body:method==='GET'?undefined:JSON.stringify(body), signal:controller.signal, cache:'no-store', credentials:'same-origin'
        });
        if(options.raw){
          if(!response.ok){const raw=await response.text();let data=null;try{data=JSON.parse(raw);}catch(_){}const error=new Error(data?.error||data?.message||`Falha ${response.status}`);error.status=response.status;throw error;}
          return response;
        }
        return await this.parse(response);
      } catch(error) {
        if(error?.name==='AbortError'){const e=new Error('A rotina de backup excedeu o tempo limite.');e.code='BACKUP_API_TIMEOUT';throw e;}
        if(retry&&error?.status===401&&this.auth?.refresh_token){await this.refresh();return this.backupApi(body,options,false);}
        throw error;
      } finally { clearTimeout(timer); }
    }
    async listBackups(){ return this.backupApi({}, {method:'GET',timeout:30000}); }
    async createBackup(){ return this.backupApi({action:'create'}, {timeout:180000}); }
    async restoreBackup(backupId){ return this.backupApi({action:'restore',backupId}, {timeout:240000}); }
    async downloadBackup(backupId){
      const response=await this.backupApi({}, {method:'GET',query:`download=${encodeURIComponent(backupId)}`,raw:true,timeout:120000});
      const disposition=response.headers.get('Content-Disposition')||'';let filename='Backup_Humanevo.json';const match=disposition.match(/filename\*=UTF-8''([^;]+)/i)||disposition.match(/filename="?([^";]+)"?/i);try{filename=decodeURIComponent(match?.[1]||filename);}catch(_){}
      return {blob:await response.blob(),filename};
    }

  }

  window.HumanevoCloud = new HumanevoCloudClient();
})();
