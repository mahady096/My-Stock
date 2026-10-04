// StockPulse Supabase market-data compatibility layer
// Legacy UI modules still call db.collection(...). This adapter routes legacy
// MARKET reads to Supabase without moving Firebase Auth/FCM to Supabase.
(function () {
  function install() {
    if (!window.supabase || typeof db === 'undefined' || !db || db.__stockpulseSupabaseCompat) return;
    const firebaseDb = db;
    const marketCollections = new Set(['daily_prices','cse_detailed_data','dse_market_data','stock_metadata']);
    const tableMap = {
      daily_prices: 'history_dse',
      cse_detailed_data: 'cse_market_data',
      dse_market_data: 'dsex_index',
      stock_metadata: 'stock_metadata'
    };
    const fieldMap = {
      daily_prices: { price:'ltp', close:'ltp' },
      cse_detailed_data: {},
      dse_market_data: { dsex_index:'value', date:'date' },
      stock_metadata: {}
    };
    const reverseMap = {
      daily_prices: { ltp:'price' },
      dse_market_data: { value:'dsex_index' }
    };
    const mapField=(collection, field)=>fieldMap[collection]?.[field] || field;
    const transform=(collection,row)=>{
      const out={...(row||{})};
      for(const [legacy,real] of Object.entries(fieldMap[collection]||{})){
        if(out[real] !== undefined && out[legacy] === undefined) out[legacy]=out[real];
      }
      if(collection==='daily_prices') { out.price=out.price ?? out.ltp; out.close=out.close ?? out.ltp; }
      if(collection==='dse_market_data') { out.dsex_index=out.dsex_index ?? out.value; }
      return out;
    };
    function builder(collection, id=null){
      const state={filters:[], orders:[], lim:null};
      const q={
        where(field,op,value){ state.filters.push([mapField(collection,field),op,value]); return q; },
        orderBy(field,direction='asc'){ state.orders.push([mapField(collection,field),direction]); return q; },
        limit(n){ state.lim=n; return q; },
        async get(){
          let query=window.supabase.from(tableMap[collection]).select('*');
          for(const [f,op,v] of state.filters){
            if(op==='==') query=query.eq(f,v);
            else if(op==='!=') query=query.neq(f,v);
            else if(op==='>=') query=query.gte(f,v);
            else if(op==='>') query=query.gt(f,v);
            else if(op==='<') query=query.lt(f,v);
            else if(op==='<=') query=query.lte(f,v);
            else if(op==='in') query=query.in(f,v);
          }
          for(const [f,d] of state.orders) query=query.order(f,{ascending:String(d).toLowerCase()!=='desc'});
          if(state.lim!=null) query=query.limit(state.lim);
          if(id!=null) query=query.eq('ticker',id).limit(1);
          const {data,error}=await query;
          if(error) throw error;
          const rows=(data||[]).map(r=>transform(collection,r));
          return {empty:rows.length===0,size:rows.length,docs:rows.map((data,i)=>({id:data.id??data.ticker??String(i),data:()=>data}))};
        }
      };
      return q;
    }
    db = new Proxy(firebaseDb, {
      get(target, prop){
        if(prop==='__stockpulseSupabaseCompat') return true;
        if(prop==='collection') return function(name){
          if(marketCollections.has(name)){
            return { ...builder(name), doc(id){ return builder(name,id); } };
          }
          return target.collection(name);
        };
        return Reflect.get(target,prop);
      }
    });
    window.db = db;
    console.log('✅ Legacy market-data reads routed to Supabase');
  }
  window.installStockPulseSupabaseCompat = install;
  if (window.supabase) install(); else setTimeout(install,0);
})();
