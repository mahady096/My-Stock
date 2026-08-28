// supabase-config.js
// Firebase Auth -> Supabase JWT bridge.
// IMPORTANT: create exactly ONE Supabase client per page.
// The current Firebase->Supabase JWT is injected dynamically into requests
// so repeated token refreshes do not create multiple GoTrueClient instances.
(function () {
    const appConfig = window.APP_CONFIG;
    if (!appConfig || !appConfig.API || !appConfig.API.SUPABASE_URL || !appConfig.API.SUPABASE_ANON_KEY) {
        console.error('❌ Supabase configuration is missing. Check config.js and script order.');
        return;
    }

    const supabaseLibrary = window.supabase;
    if (!supabaseLibrary || typeof supabaseLibrary.createClient !== 'function') {
        console.error('❌ Supabase library not loaded!');
        return;
    }

    // Prevent accidental duplicate initialization if this file is included twice.
    if (window.supabase && window.supabase.__stockPulseClient === true) {
        console.warn('⚠️ StockPulse Supabase client already initialized; reusing it.');
        return;
    }

    let currentAccessToken = null;

    const dynamicFetch = async (input, init = {}) => {
        const headers = new Headers(init.headers || {});
        if (currentAccessToken) {
            headers.set('Authorization', `Bearer ${currentAccessToken}`);
        } else {
            headers.delete('Authorization');
        }
        return fetch(input, { ...init, headers });
    };

    const client = supabaseLibrary.createClient(
        appConfig.API.SUPABASE_URL,
        appConfig.API.SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            },
            realtime: { autoConnect: false },
            global: {
                fetch: dynamicFetch
            }
        }
    );

    // Marker used only to prevent duplicate initialization in the same page.
    Object.defineProperty(client, '__stockPulseClient', {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });

    window.supabase = client;
    window.__supabaseAccessToken = null;

    window.setSupabaseAuthToken = function (accessToken) {
        currentAccessToken = accessToken || null;
        window.__supabaseAccessToken = currentAccessToken;
        return client;
    };

    window.clearSupabaseAuth = function () {
        currentAccessToken = null;
        window.__supabaseAccessToken = null;
        return client;
    };

    window.getSupabaseAuthToken = function () {
        return currentAccessToken;
    };

    console.log('✅ Supabase client initialized once (Firebase JWT bridge ready)');
})();
