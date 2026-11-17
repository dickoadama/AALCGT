'use strict';

(function (global) {
    const RIGHTS = ['manage_settings', 'manage_members', 'manage_finance', 'manage_opportunities', 'view_audit', 'manage_data'];
    const DEFAULT_ASSOCIATION_NAME = 'AUBE des Anciens du Lycee Coffi Gadeau Tiebissou';
    let client;

    function getClient() {
        if (client) return client;
        const config = global.AALCGT_SUPABASE_CONFIG || {};
        if (!config.url || !config.anonKey) {
            const error = new Error('Renseignez l’URL Supabase et la clé anon dans supabase-config.js.');
            error.status = 503;
            throw error;
        }
        if (!global.supabase || typeof global.supabase.createClient !== 'function') {
            const error = new Error('La bibliothèque Supabase n’a pas pu être chargée. Vérifiez votre connexion Internet.');
            error.status = 503;
            throw error;
        }
        client = global.supabase.createClient(config.url, config.anonKey, {
            auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return client;
    }

    function fail(error) {
        const result = new Error(error && error.message ? error.message : 'La requête Supabase a échoué.');
        result.status = error && error.status ? error.status : 400;
        throw result;
    }

    async function dataOf(query) {
        const { data, error } = await query;
        if (error) fail(error);
        return data;
    }

    function bodyOf(request) {
        if (!request || request.body === undefined) return {};
        return typeof request.body === 'string' ? JSON.parse(request.body || '{}') : request.body;
    }

    function publicProfile(row) {
        return Object.assign({}, row.profile_json || row.profile_json_public || {}, {
            id: row.id,
            username: row.username,
            name: row.name,
            email: row.email,
            phone: row.phone,
            role: row.role,
            permissions: row.permissions_json || {},
            bureauRole: row.bureau_role || '',
            joinDate: row.created_at
        });
    }

    async function profileForAuthUser(authUser) {
        if (!authUser) {
            const error = new Error('Connexion requise.');
            error.status = 401;
            throw error;
        }
        const row = await dataOf(getClient().from('profiles').select('*')
            .eq('auth_user_id', authUser.id).eq('is_active', true).maybeSingle());
        if (!row) {
            await getClient().auth.signOut();
            const error = new Error('Ce compte n’a pas de profil actif. Contactez un administrateur.');
            error.status = 403;
            throw error;
        }
        return row;
    }

    async function currentAuthUser() {
        const { data, error } = await getClient().auth.getSession();
        if (error) fail(error);
        if (!data.session) {
            const missing = new Error('Connexion requise.');
            missing.status = 401;
            throw missing;
        }
        return data.session.user;
    }

    async function appData(key, fallback) {
        const row = await dataOf(getClient().from('app_data').select('data_json').eq('data_key', key).maybeSingle());
        return row ? row.data_json : fallback;
    }

    async function saveAppData(key, value) {
        await dataOf(getClient().from('app_data').upsert({ data_key: key, data_json: value }, { onConflict: 'data_key' }));
        return value;
    }

    async function archives() {
        const rows = await dataOf(getClient().from('archives').select('payload').order('id', { ascending: false }).limit(1000));
        return rows.map((row) => row.payload);
    }

    async function auditEntries() {
        const rows = await dataOf(getClient().from('audit_logs').select('payload').order('id', { ascending: false }).limit(500));
        return rows.map((row) => row.payload);
    }

    async function settingsName() {
        const row = await dataOf(getClient().from('app_settings').select('setting_value')
            .eq('setting_key', 'association_name').maybeSingle());
        return row ? row.setting_value : DEFAULT_ASSOCIATION_NAME;
    }

    async function readMessages() {
        const rows = await dataOf(getClient().from('messages').select('payload').order('id'));
        return rows.map((row) => row.payload);
    }

    async function appDataResponse(profile) {
        const [initialized, transactions, opportunities, groups, messages, archivesList, auditLog, name] = await Promise.all([
            appData('initialized', false),
            appData('transactions', []),
            appData('opportunities', []),
            appData('groups', []),
            readMessages(),
            archives(),
            hasPermission(profile, 'view_audit') ? auditEntries() : Promise.resolve([]),
            settingsName()
        ]);
        return {
            initialized,
            data: {
                transactions,
                opportunities,
                groups,
                messages,
                archives: archivesList,
                auditLog,
                settings: { name }
            }
        };
    }

    function hasPermission(profile, permission) {
        const permissions = profile && (profile.permissions_json || profile.permissions) || {};
        return !!profile && (profile.role === 'superadmin' ||
            (profile.role === 'admin' && permissions[permission] === true));
    }

    function requirePermission(profile, permission) {
        const bureauRole = profile && (profile.bureau_role || profile.bureauRole);
        if (!hasPermission(profile, permission) &&
            !(permission === 'manage_finance' && bureauRole === 'tresorier')) {
            const error = new Error('Cette action n’est pas autorisée pour votre compte.');
            error.status = 403;
            throw error;
        }
    }

    async function listProfiles(includePrivate = false) {
        const query = includePrivate
            ? getClient().from('profiles').select('*').eq('is_active', true).order('name')
            : getClient().from('member_directory').select('*').order('name');
        const rows = await dataOf(query);
        return rows.map(publicProfile);
    }

    async function currentProfile() {
        return profileForAuthUser(await currentAuthUser());
    }

    async function authRequest(path, request, currentUser) {
        const db = getClient();
        const body = bodyOf(request);
        if (path === '/auth/register') {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email) throw new Error('Une adresse e-mail est obligatoire pour créer un compte.');
            const { data, error } = await db.auth.signUp({
                email,
                password: body.password,
                options: {
                    emailRedirectTo: global.location.href,
                    data: { username: body.username, name: body.name, phone: body.phone }
                }
            });
            if (error) fail(error);
            return { requiresEmailConfirmation: !data.session };
        }
        if (path === '/auth/login') {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email || !body.password) throw new Error('Saisissez votre adresse e-mail et votre mot de passe.');
            const { data, error } = await db.auth.signInWithPassword({ email, password: body.password });
            if (error) fail(error);
            return { user: publicProfile(await profileForAuthUser(data.user)) };
        }
        if (path === '/auth/me') {
            return { user: publicProfile(await profileForAuthUser(await currentAuthUser())) };
        }
        if (path === '/auth/logout') {
            const { error } = await db.auth.signOut();
            if (error) fail(error);
            return null;
        }
        if (path === '/auth/forgot-password') {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email) throw new Error('Saisissez votre adresse e-mail.');
            const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: global.location.href });
            if (error) fail(error);
            return { sent: true };
        }
        if (path === '/auth/resend-confirmation') {
            const email = String(body.email || '').trim().toLowerCase();
            if (!email) throw new Error('Saisissez votre adresse e-mail.');
            const { error } = await db.auth.resend({
                type: 'signup',
                email,
                options: { emailRedirectTo: global.location.href }
            });
            if (error) fail(error);
            return { sent: true };
        }
        if (path === '/auth/password') {
            const email = String(currentUser && currentUser.email || '').trim().toLowerCase();
            if (body.oldPassword) {
                const { error: verifyError } = await db.auth.signInWithPassword({ email, password: body.oldPassword });
                if (verifyError) fail(verifyError);
            }
            const { data, error } = await db.auth.updateUser({ password: body.newPassword });
            if (error) fail(error);
            return { user: publicProfile(await profileForAuthUser(data.user)) };
        }
        if (path === '/auth/profile') {
            const profile = await currentProfile();
            const allowed = ['address', 'birth', 'gender', 'city', 'proStatus', 'job', 'company', 'sector', 'level', 'experience', 'skills', 'promo', 'bio', 'notes'];
            const nextProfile = Object.assign({}, profile.profile_json || {});
            for (const field of allowed) {
                if (typeof body[field] === 'string') nextProfile[field] = body[field];
            }
            const updates = {
                name: String(body.name || profile.name).trim(),
                phone: String(body.phone || '').trim(),
                profile_json: nextProfile
            };
            const newEmail = String(body.email || '').trim().toLowerCase();
            if (newEmail && newEmail !== profile.email.toLowerCase()) {
                const { error } = await db.auth.updateUser({ email: newEmail });
                if (error) fail(error);
            }
            const row = await dataOf(db.from('profiles').update(updates).eq('id', profile.id).select('*').single());
            return { user: publicProfile(row) };
        }
        throw new Error('Opération d’authentification inconnue.');
    }

    async function saveMessages(request, profile) {
        const submitted = bodyOf(request).messages;
        if (!Array.isArray(submitted)) throw new Error('La liste des messages est invalide.');
        const db = getClient();
        const existingRows = await dataOf(db.from('messages').select('id,sender_id,receiver_id,payload'));
        const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
        const normalized = submitted.map((message) => {
            if (!message || typeof message !== 'object' || !Number.isSafeInteger(message.id) ||
                !Number.isSafeInteger(message.senderId) || !Number.isSafeInteger(message.receiverId)) {
                throw new Error('Un message contient des identifiants invalides.');
            }
            const existing = existingById.get(message.id);
            const copy = Object.assign({}, message);
            if (!existing) copy.senderId = profile.id;
            if (copy.senderId !== profile.id && copy.receiverId !== profile.id) {
                const error = new Error('Vous ne pouvez modifier que vos conversations.');
                error.status = 403;
                throw error;
            }
            if (existing) {
                const old = existing.payload;
                for (const field of ['id', 'senderId', 'receiverId', 'content', 'timestamp', 'attachments']) {
                    if (JSON.stringify(old[field]) !== JSON.stringify(copy[field])) {
                        const error = new Error('Les informations principales d’un message ne sont pas modifiables.');
                        error.status = 403;
                        throw error;
                    }
                }
                if (old.read !== copy.read && Number(existing.receiver_id) !== profile.id) {
                    const error = new Error('Seul le destinataire peut marquer un message comme lu.');
                    error.status = 403;
                    throw error;
                }
            }
            return copy;
        });
        const submittedIds = new Set(normalized.map((message) => message.id));
        const removedIds = existingRows.filter((row) => !submittedIds.has(Number(row.id))).map((row) => row.id);
        if (removedIds.length) await dataOf(db.from('messages').delete().in('id', removedIds));
        const newMessages = normalized.filter((message) => !existingById.has(message.id));
        if (normalized.length) {
            const rows = normalized.map((payload) => ({
                id: payload.id,
                sender_id: payload.senderId,
                receiver_id: payload.receiverId,
                payload
            }));
            await dataOf(db.from('messages').upsert(rows, { onConflict: 'id' }));
        }
        if (newMessages.length) {
            const newArchives = newMessages.map((message) => ({
                id: message.id,
                owner_id: profile.id,
                recipient_id: message.receiverId,
                payload: {
                    id: message.id,
                    time: new Date(message.timestamp).toLocaleString('fr-FR'),
                    user: profile.username,
                    userId: profile.id,
                    recipientId: message.receiverId,
                    content: message.content,
                    target: message.receiverId,
                    type: 'message'
                }
            }));
            await dataOf(db.from('archives').upsert(newArchives, { onConflict: 'id', ignoreDuplicates: true }));
        }
        const updatedArchives = await archives();
        return {
            messages: normalized,
            archives: updatedArchives.filter((entry) => entry.userId === profile.id ||
                entry.recipientId === profile.id || Number(entry.target) === profile.id ||
                entry.user === profile.username)
        };
    }

    async function logAudit(request, profile) {
        const action = String(bodyOf(request).action || '').trim();
        if (!action || action.length > 500) throw new Error('L’action à journaliser est invalide.');
        const time = new Date().toLocaleString('fr-FR');
        const entry = { id: Date.now(), time, user: profile.username, userId: profile.id, action };
        const archive = Object.assign({ id: Date.now() + 1, type: 'system' }, entry);
        await dataOf(getClient().from('audit_logs').insert({ id: entry.id, user_id: profile.id, payload: entry }));
        await dataOf(getClient().from('archives').insert({ id: archive.id, owner_id: profile.id, payload: archive }));
        return { entry, archive };
    }

    async function importData(request, profile) {
        if (profile.role !== 'superadmin') {
            const error = new Error('Seul le super-administrateur peut restaurer une sauvegarde.');
            error.status = 403;
            throw error;
        }
        const data = bodyOf(request).data;
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Le fichier de données est invalide.');
        const db = getClient();
        for (const key of ['transactions', 'opportunities', 'groups']) {
            await saveAppData(key, Array.isArray(data[key]) ? data[key] : []);
        }
        const members = await dataOf(db.from('profiles').select('id,username,name,email,phone,profile_json'));
        let importedProfiles = 0;
        let skippedProfiles = 0;
        for (const oldProfile of data.profiles || []) {
            const existing = members.find((member) => member.username.toLowerCase() === String(oldProfile.username || '').toLowerCase());
            if (!existing) {
                skippedProfiles++;
                continue;
            }
            const { error } = await db.from('profiles').update({
                name: oldProfile.name || existing.name,
                phone: oldProfile.phone || existing.phone,
                profile_json: Object.assign({}, existing.profile_json || {}, oldProfile)
            }).eq('id', existing.id);
            if (error) fail(error);
            importedProfiles++;
        }
        await dataOf(db.from('messages').delete().gt('id', 0));
        const profilesById = new Map(members.map((member) => [Number(member.id), member]));
        const messageRows = (data.messages || []).filter((item) => profilesById.has(Number(item.senderId)) &&
            profilesById.has(Number(item.receiverId))).map((payload) => ({
            id: payload.id,
            sender_id: payload.senderId,
            receiver_id: payload.receiverId,
            payload
        }));
        if (messageRows.length) await dataOf(db.from('messages').insert(messageRows));
        await dataOf(db.from('audit_logs').delete().gt('id', 0));
        const auditRows = (data.auditLog || []).map((payload) => ({
            id: payload.id,
            user_id: Number(payload.userId) || profile.id,
            payload
        }));
        if (auditRows.length) await dataOf(db.from('audit_logs').insert(auditRows));
        await dataOf(db.from('archives').delete().gt('id', 0));
        const archiveRows = (data.archives || []).map((payload) => ({
            id: payload.id,
            owner_id: Number(payload.userId) || profile.id,
            recipient_id: Number(payload.recipientId || payload.target) || null,
            payload
        }));
        if (archiveRows.length) await dataOf(db.from('archives').insert(archiveRows));
        if (data.settings && typeof data.settings.name === 'string') {
            await dataOf(db.from('app_settings').upsert({
                setting_key: 'association_name',
                setting_value: data.settings.name.trim().slice(0, 120)
            }, { onConflict: 'setting_key' }));
        }
        await saveAppData('initialized', true);
        return { imported: true, importedProfiles, skippedProfiles };
    }

    async function request(path, request, currentUser) {
        const method = String(request && request.method || 'GET').toUpperCase();
        const body = bodyOf(request);
        const route = path.split('?')[0];
        const query = new URLSearchParams(path.split('?')[1] || '');
        const db = getClient();
        if (route.startsWith('/auth/')) return authRequest(route, request, currentUser);
        if (route === '/members') {
            const canManageMembers = currentUser && hasPermission(currentUser, 'manage_members');
            const profiles = await listProfiles(!!canManageMembers);
            if (canManageMembers) {
                const assignments = await dataOf(db.from('admin_member_assignments').select('member_id')
                    .eq('admin_id', currentUser.id));
                currentUser.managesMembers = assignments.map((row) => Number(row.member_id));
            }
            return { users: profiles };
        }
        if (route === '/admin/access') {
            const profile = currentUser || publicProfile(await currentProfile());
            const permission = query.get('permission');
            if (!permission && profile.role !== 'superadmin' &&
                !(profile.role === 'admin' && ['manage_settings', 'manage_members', 'view_audit', 'manage_data']
                    .some((right) => hasPermission(profile, right)))) {
                const error = new Error('Aucun droit d’administration ne vous a été attribué.');
                error.status = 403;
                throw error;
            }
            if (permission) requirePermission(profile, permission);
            return { authorized: true };
        }
        const profile = currentUser || publicProfile(await currentProfile());
        if (route === '/data' && method === 'GET') return appDataResponse(profile);
        if (route === '/data/transactions' && method === 'PUT') {
            const submitted = body.transactions;
            if (!Array.isArray(submitted)) throw new Error('La liste des transactions est invalide.');
            const existing = await appData('transactions', []);
            if (!hasPermission(profile, 'manage_finance') &&
                (profile.bureau_role || profile.bureauRole) !== 'tresorier') {
                const submittedById = new Map(submitted.map((item) => [item.id, item]));
                if (existing.some((item) => JSON.stringify(item) !== JSON.stringify(submittedById.get(item.id)))) {
                    const error = new Error('Vous ne pouvez que soumettre de nouvelles transactions en attente.');
                    error.status = 403;
                    throw error;
                }
                const oldIds = new Set(existing.map((item) => item.id));
                const additions = submitted.filter((item) => !oldIds.has(item.id));
                if (additions.some((item) => item.status !== 'pending')) {
                    const error = new Error('Seul un responsable de caisse peut valider une transaction.');
                    error.status = 403;
                    throw error;
                }
                const saved = existing.concat(additions.map((item) => Object.assign({}, item, {
                    status: 'pending', createdBy: profile.username
                })));
                await saveAppData('transactions', saved);
            } else {
                await saveAppData('transactions', submitted);
            }
            await saveAppData('initialized', true);
            return { transactions: await appData('transactions', []) };
        }
        if (route === '/data/opportunities' && method === 'PUT') {
            requirePermission(profile, 'manage_opportunities');
            await saveAppData('opportunities', body.opportunities);
            await saveAppData('initialized', true);
            return { opportunities: body.opportunities };
        }
        if (route === '/data/groups' && method === 'PUT') {
            requirePermission(profile, 'manage_members');
            await saveAppData('groups', body.groups);
            await saveAppData('initialized', true);
            return { groups: body.groups };
        }
        if (route === '/data/messages' && method === 'PUT') return saveMessages(request, profile);
        if (route === '/audit' && method === 'POST') return logAudit(request, profile);
        if (route === '/data/audit' && method === 'DELETE') {
            requirePermission(profile, 'view_audit');
            await dataOf(db.from('audit_logs').delete().gt('id', 0));
            return null;
        }
        if (route === '/data/archives' && method === 'DELETE') {
            requirePermission(profile, 'view_audit');
            await dataOf(db.from('archives').delete().gt('id', 0));
            return null;
        }
        if (route === '/admin/data/import' && method === 'POST') return importData(request, profile);
        if (route === '/admin/data/export' && method === 'GET') {
            requirePermission(profile, 'manage_data');
            const result = await appDataResponse(profile);
            const allMessages = await readMessages();
            return Object.assign({}, result.data, { messages: allMessages });
        }
        if (route === '/admin/settings' && method === 'GET') {
            requirePermission(profile, 'manage_settings');
            return { name: await settingsName() };
        }
        if (route === '/admin/settings' && method === 'PUT') {
            requirePermission(profile, 'manage_settings');
            const name = String(body.name || '').trim();
            if (name.length < 2 || name.length > 120) throw new Error('Le nom de l’association doit contenir entre 2 et 120 caractères.');
            await dataOf(db.from('app_settings').upsert({ setting_key: 'association_name', setting_value: name },
                { onConflict: 'setting_key' }));
            return { name };
        }
        if (route === '/admin/users' && method === 'GET') {
            requirePermission(profile, 'manage_members');
            return { users: await listProfiles(true) };
        }
        if (route === '/admin/users' && method === 'POST') {
            throw new Error('Le membre doit créer son compte depuis l’onglet Inscription; un administrateur pourra ensuite le gérer.');
        }
        if (route === '/admin/managed-members' && method === 'GET') {
            requirePermission(profile, 'manage_members');
            const rows = await dataOf(db.from('admin_member_assignments').select('member_id').eq('admin_id', profile.id));
            return { memberIds: rows.map((row) => Number(row.member_id)) };
        }
        const assignmentMatch = route.match(/^\/admin\/managed-members\/(\d+)$/);
        if (assignmentMatch && method === 'PUT') {
            requirePermission(profile, 'manage_members');
            const memberId = Number(assignmentMatch[1]);
            if (body.assigned) {
                await dataOf(db.from('admin_member_assignments').upsert({
                    admin_id: profile.id, member_id: memberId
                }, { onConflict: 'admin_id,member_id' }));
            } else {
                await dataOf(db.from('admin_member_assignments').delete().eq('admin_id', profile.id).eq('member_id', memberId));
            }
            const rows = await dataOf(db.from('admin_member_assignments').select('member_id').eq('admin_id', profile.id));
            return { memberIds: rows.map((row) => Number(row.member_id)) };
        }
        if (route === '/admin/permissions' && method === 'GET') {
            if (profile.role !== 'superadmin') throw new Error('Cette action est réservée au super-administrateur.');
            const rows = await dataOf(db.from('profiles').select('*').eq('role', 'admin').eq('is_active', true));
            return { rights: RIGHTS, admins: rows.map(publicProfile) };
        }
        const permissionMatch = route.match(/^\/admin\/users\/(\d+)\/permissions$/);
        if (permissionMatch && method === 'PATCH') {
            if (profile.role !== 'superadmin') throw new Error('Cette action est réservée au super-administrateur.');
            if (Object.keys(body.permissions || {}).some((right) => !RIGHTS.includes(right)) ||
                RIGHTS.some((right) => typeof body.permissions[right] !== 'boolean')) {
                throw new Error('Données d’autorisation invalides.');
            }
            const row = await dataOf(db.from('profiles').update({ permissions_json: body.permissions })
                .eq('id', Number(permissionMatch[1])).eq('role', 'admin').select('*').single());
            return { admin: publicProfile(row) };
        }
        const userMatch = route.match(/^\/admin\/users\/(\d+)$/);
        if (userMatch && method === 'PATCH') {
            requirePermission(profile, 'manage_members');
            if (body.password) throw new Error('Le membre doit réinitialiser son mot de passe depuis son adresse e-mail.');
            const id = Number(userMatch[1]);
            const old = await dataOf(db.from('profiles').select('*').eq('id', id).single());
            const profileJson = Object.assign({}, old.profile_json || {});
            for (const field of ['address', 'birth', 'gender', 'city', 'proStatus', 'job', 'company', 'sector', 'level', 'experience', 'skills', 'promo', 'bio', 'notes']) {
                if (typeof body[field] === 'string') profileJson[field] = body[field];
            }
            const changes = {
                username: body.username || old.username,
                name: body.name || old.name,
                phone: body.phone === undefined ? old.phone : body.phone,
                profile_json: profileJson
            };
            if (profile.role === 'superadmin') {
                if (body.role !== undefined) changes.role = body.role;
                if (body.bureauRole !== undefined) changes.bureau_role = body.bureauRole;
            }
            const row = await dataOf(db.from('profiles').update(changes).eq('id', id).select('*').single());
            return { user: publicProfile(row) };
        }
        if (userMatch && method === 'DELETE') {
            requirePermission(profile, 'manage_members');
            if (Number(userMatch[1]) === profile.id) throw new Error('Vous ne pouvez pas désactiver votre propre compte.');
            await dataOf(db.from('profiles').update({ is_active: false }).eq('id', Number(userMatch[1])));
            return null;
        }
        throw new Error('Opération Supabase inconnue : ' + method + ' ' + path);
    }

    global.SupabaseApi = { request, getClient };
})(window);
