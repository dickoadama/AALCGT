'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adapterSource = fs.readFileSync(path.join(__dirname, '..', 'supabase-api.js'), 'utf8');

function createApi(config, client) {
    const window = {
        AALCGT_SUPABASE_CONFIG: config || { url: 'https://project.supabase.co', anonKey: 'public-key' },
        location: { href: 'file:///E:/local/index.html' },
        supabase: { createClient: () => client || ({}) }
    };
    vm.runInNewContext(adapterSource, { window, URLSearchParams });
    return window.SupabaseApi;
}

test('browser API honors permissions on public profiles and denies missing rights', async () => {
    const api = createApi();

    const financeAdmin = await api.request('/admin/access?permission=manage_finance', {}, {
        role: 'admin',
        permissions: { manage_finance: true }
    });
    assert.equal(financeAdmin.authorized, true);

    const treasurer = await api.request('/admin/access?permission=manage_finance', {}, {
        role: 'membre',
        bureauRole: 'tresorier'
    });
    assert.equal(treasurer.authorized, true);

    await assert.rejects(
        api.request('/admin/access?permission=manage_members', {}, {
            role: 'admin',
            permissions: {}
        }),
        (error) => error.status === 403
    );
});

test('auth emails always use the configured GitHub Pages redirect', async () => {
    const calls = [];
    const client = {
        auth: {
            signUp: async (options) => { calls.push(options.options.emailRedirectTo); return { data: { session: null }, error: null }; },
            resend: async (options) => { calls.push(options.options.emailRedirectTo); return { error: null }; },
            resetPasswordForEmail: async (email, options) => { calls.push(options.redirectTo); return { error: null }; }
        }
    };
    const redirectUrl = 'https://dickoadama.github.io/AALCGT/';
    const api = createApi({ url: 'https://project.supabase.co', anonKey: 'public-key', redirectUrl }, client);

    await api.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email: 'member@example.com', password: 'secure-password' })
    }, null);
    await api.request('/auth/resend-confirmation', {
        method: 'POST',
        body: JSON.stringify({ email: 'member@example.com' })
    }, null);
    await api.request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: 'member@example.com' })
    }, null);

    assert.deepEqual(calls, [redirectUrl, redirectUrl, redirectUrl]);
});

test('browser API reports missing Supabase configuration explicitly', async () => {
    const api = createApi({ url: '', anonKey: '' });

    await assert.rejects(
        api.request('/auth/me', {}, null),
        (error) => error.status === 503 && error.message.includes('supabase-config.js')
    );
});
