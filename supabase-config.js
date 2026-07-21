// supabase-config.js
// এটি সাধারণ JavaScript ফাইল, module নয়

(function() {
    const supabaseUrl = 'https://dpdicusxlrdydajkcgev.supabase.co';
    const supabaseAnonKey = 'sb_publishable_vIexTeuEoBjiFoA0F2w2Ag_3GUn_SMX';

    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded!');
        return;
    }
    
    window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        realtime: { autoConnect: false }
    });
    
    console.log('✅ Supabase client initialized (global)');
})();