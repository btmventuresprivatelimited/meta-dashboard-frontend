import React, { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = "https://meta-dashboard-backend-2wmr.onrender.com/api/meta";
const METRIC_KEYS = new Set(["spend","reach","impressions","clicks","ctr","cpc","roas"]);

function toNumber(value) {
  if (Array.isArray(value)) { const f = value[0]; if (f && typeof f==="object") { const n=Number(f.value); return isNaN(n)?0:n; } }
  const n=Number(value); return isNaN(n)?0:n;
}

function fmt(key, val) {
  if (!val && val!==0) return "—"; if (val===0) return "—";
  switch(key) {
    case "spend": return val.toLocaleString("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2});
    case "cpc":   return val.toLocaleString("en-IN",{style:"currency",currency:"INR",minimumFractionDigits:2,maximumFractionDigits:2});
    case "budget":return val.toLocaleString("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0});
    case "ctr":   return `${val.toFixed(2)}%`;
    case "roas":  return `${val.toFixed(2)}x`;
    case "reach": case "impressions": case "clicks": return val.toLocaleString("en-IN");
    default: return String(val);
  }
}

function sortRows(rows, {key, direction}) {
  return [...rows].sort((a,b) => {
    let av=METRIC_KEYS.has(key)?toNumber(a[key]):String(a[key]??"").toLowerCase();
    let bv=METRIC_KEYS.has(key)?toNumber(b[key]):String(b[key]??"").toLowerCase();
    if(av<bv) return direction==="asc"?-1:1;
    if(av>bv) return direction==="asc"?1:-1;
    return 0;
  });
}

async function fetchJson(url) {
  const res=await fetch(url); const result=await res.json();
  if(!res.ok||!result.success) throw new Error(result.message||"Request failed");
  return result.data||[];
}

const COUNTRY_NAMES={IN:"India",US:"United States",GB:"United Kingdom",AE:"UAE",SG:"Singapore",AU:"Australia",CA:"Canada",DE:"Germany",FR:"France",JP:"Japan",NL:"Netherlands",MY:"Malaysia",TH:"Thailand",PH:"Philippines",ID:"Indonesia",BD:"Bangladesh",PK:"Pakistan"};
const countryName=(c)=>COUNTRY_NAMES[c]||c;

function parseAudience(t) {
  if(!t) return null;
  const geo=t.geo_locations||{};
  const locations=[...(geo.countries?.map(countryName)||[]),...(geo.regions?.map(r=>r.name)||[]),...(geo.cities?.map(c=>c.name)||[])];
  const genders=t.genders;
  const gender=!genders||genders.length===0||genders.length===2?"All Genders":genders[0]===1?"Male Only":"Female Only";
  return {
    age:`${t.age_min||13}–${t.age_max||65}`, gender, locations,
    included: t.custom_audiences||[],
    excluded: t.excluded_custom_audiences||[],
    interests:(t.flexible_spec||[]).flatMap(s=>s.interests||[]),
    behaviors:(t.flexible_spec||[]).flatMap(s=>s.behaviors||[]),
    lookalikes:(t.flexible_spec||[]).flatMap(s=>s.lookalike_audience||[]),
  };
}

const ChevUp=()=><svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><path d="M4.5 2L8.5 7H0.5L4.5 2Z"/></svg>;
const ChevDown=()=><svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><path d="M4.5 7L0.5 2H8.5L4.5 7Z"/></svg>;
const ChevBoth=()=><svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" opacity=".3"><path d="M4.5 1.5L7 4H2L4.5 1.5Z"/><path d="M4.5 7.5L2 5H7L4.5 7.5Z"/></svg>;

function SortableHeader({label,sortKey,section,sortState,onSort,right}) {
  const active=sortState.key===sortKey;
  return (
    <th onClick={()=>onSort(section,sortKey)} className={`sheets-th ${right?"text-right":"text-left"} ${active?"active-col":""}`}>
      <span className="th-inner">
        {!right&&<span className="sort-icon">{active?(sortState.direction==="asc"?<ChevUp/>:<ChevDown/>):<ChevBoth/>}</span>}
        {label}
        {right&&<span className="sort-icon">{active?(sortState.direction==="asc"?<ChevUp/>:<ChevDown/>):<ChevBoth/>}</span>}
      </span>
    </th>
  );
}

function StatusBadge({status}) {
  const s=(status||"").toUpperCase();
  const cls={ACTIVE:"badge-active",PAUSED:"badge-paused",ARCHIVED:"badge-archived",DELETED:"badge-deleted"}[s]||"badge-other";
  return <span className={`status-badge ${cls}`}>{status||"—"}</span>;
}

function LoadingRow({colSpan}) { return <tr><td colSpan={colSpan} className="empty-cell"><span className="loader-dots"><span/><span/><span/></span></td></tr>; }
function EmptyRow({colSpan,msg}) { return <tr><td colSpan={colSpan} className="empty-cell">{msg}</td></tr>; }
function AudTag({label,type}) { return <span className={`aud-tag aud-${type}`} title={label}>{label}</span>; }

function AudiencePanel({adset}) {
  if(!adset) return (
    <div className="aud-panel aud-empty">
      <div className="aud-panel-title">🎯 Audience Targeting</div>
      <p className="aud-hint">Select an ad set to view its audience setup</p>
    </div>
  );
  const aud=parseAudience(adset.targeting);
  const budget=adset.daily_budget!=null ? `${fmt("budget",adset.daily_budget)}/day`
    : adset.lifetime_budget!=null ? `${fmt("budget",adset.lifetime_budget)} lifetime` : null;
  return (
    <div className="aud-panel">
      <div className="aud-panel-title">🎯 Audience Targeting</div>
      <div className="aud-adset-name">{adset.adset_name}</div>
      {(budget||adset.bid_strategy)&&(
        <div className="aud-section">
          <div className="aud-section-label">Budget & Bidding</div>
          <div className="aud-kv-grid">
            {budget&&<><span className="aud-kv-key">Budget</span><span className="aud-kv-val">{budget}</span></>}
            {adset.bid_strategy&&<><span className="aud-kv-key">Bid Strategy</span><span className="aud-kv-val">{adset.bid_strategy.replace(/_/g," ")}</span></>}
            {adset.optimization_goal&&<><span className="aud-kv-key">Optimize For</span><span className="aud-kv-val">{adset.optimization_goal.replace(/_/g," ")}</span></>}
          </div>
        </div>
      )}
      {aud?(
        <>
          <div className="aud-section">
            <div className="aud-section-label">Demographics</div>
            <div className="aud-kv-grid">
              <span className="aud-kv-key">Age</span><span className="aud-kv-val">{aud.age} yrs</span>
              <span className="aud-kv-key">Gender</span><span className="aud-kv-val">{aud.gender}</span>
            </div>
          </div>
          {aud.locations.length>0&&(<div className="aud-section"><div className="aud-section-label">📍 Locations</div><div className="aud-tags">{aud.locations.map((l,i)=><AudTag key={i} label={l} type="geo"/>)}</div></div>)}
          {aud.included.length>0&&(<div className="aud-section"><div className="aud-section-label">✅ Included Audiences</div><div className="aud-tags">{aud.included.map(a=><AudTag key={a.id} label={a.name} type="included"/>)}</div></div>)}
          {aud.excluded.length>0&&(<div className="aud-section"><div className="aud-section-label">🚫 Excluded Audiences</div><div className="aud-tags">{aud.excluded.map(a=><AudTag key={a.id} label={a.name} type="excluded"/>)}</div></div>)}
          {aud.lookalikes.length>0&&(<div className="aud-section"><div className="aud-section-label">🔍 Lookalike Audiences</div><div className="aud-tags">{aud.lookalikes.map((a,i)=><AudTag key={i} label={a.name||a.id} type="lookalike"/>)}</div></div>)}
          {aud.interests.length>0&&(<div className="aud-section"><div className="aud-section-label">💡 Interests</div><div className="aud-tags">{aud.interests.map(a=><AudTag key={a.id} label={a.name} type="interest"/>)}</div></div>)}
          {aud.behaviors.length>0&&(<div className="aud-section"><div className="aud-section-label">⚡ Behaviors</div><div className="aud-tags">{aud.behaviors.map(a=><AudTag key={a.id} label={a.name} type="behavior"/>)}</div></div>)}
          {aud.locations.length===0&&aud.included.length===0&&aud.interests.length===0&&aud.behaviors.length===0&&(
            <p className="aud-hint">No detailed targeting configured (Advantage+ or broad audience)</p>
          )}
        </>
      ):(
        <p className="aud-hint">No targeting data available for this ad set</p>
      )}
    </div>
  );
}

export default function MetaAccountSelectorPage() {
  const [accounts,setAccounts]=useState([]);
  const [accountsLoading,setAccountsLoading]=useState(true);
  const [accountsError,setAccountsError]=useState("");
  const [selectedPortfolioId,setSelectedPortfolioId]=useState("__all__");
  const [selectedAccountId,setSelectedAccountId]=useState("");
  const [accountSearch,setAccountSearch]=useState("");

  const [campaigns,setCampaigns]=useState([]);
  const [campaignsLoading,setCampaignsLoading]=useState(false);
  const [campaignsError,setCampaignsError]=useState("");
  const [selectedCampaignId,setSelectedCampaignId]=useState("");
  const [campaignSort,setCampaignSort]=useState({key:"spend",direction:"desc"});

  const [adsets,setAdsets]=useState([]);
  const [adsetsLoading,setAdsetsLoading]=useState(false);
  const [adsetsError,setAdsetsError]=useState("");
  const [selectedAdsetId,setSelectedAdsetId]=useState("");
  const [adsetSort,setAdsetSort]=useState({key:"spend",direction:"desc"});

  const [ads,setAds]=useState([]);
  const [adsLoading,setAdsLoading]=useState(false);
  const [adsError,setAdsError]=useState("");
  const [adSort,setAdSort]=useState({key:"spend",direction:"desc"});

  // Search/filter state for each table
  const [campaignSearch,setCampaignSearch]=useState("");
  const [adsetSearch,setAdsetSearch]=useState("");
  const [adSearch,setAdSearch]=useState("");

  const [dateRange,setDateRange]=useState({from:"2026-04-01",to:"2026-04-22"});

  // Load accounts (with business info for portfolio grouping)
  useEffect(()=>{
    let ignore=false;
    (async()=>{
      try {
        setAccountsLoading(true); setAccountsError("");
        const rows=await fetchJson(`${API_BASE}/accounts`);
        if(ignore) return;
        setAccounts(rows);
        if(rows.length>0) setSelectedAccountId(rows[0].id);
      } catch(e) { if(!ignore) setAccountsError(e.message||"Failed to load accounts"); }
      finally { if(!ignore) setAccountsLoading(false); }
    })();
    return()=>{ignore=true;};
  },[]);

  // Load campaigns + insights when account/date changes
  useEffect(()=>{
    let ignore=false;
    if(!selectedAccountId) { setCampaigns([]); setSelectedCampaignId(""); return; }
    (async()=>{
      try {
        setCampaignsLoading(true); setCampaignsError("");
        setAdsets([]); setAdsetsError(""); setSelectedCampaignId(""); setCampaignSearch("");
        setAds([]); setAdsError(""); setSelectedAdsetId(""); setAdsetSearch(""); setAdSearch("");
        const [meta,insights]=await Promise.all([
          fetchJson(`${API_BASE}/campaigns?accountId=${encodeURIComponent(selectedAccountId)}`),
          fetchJson(`${API_BASE}/insights/campaigns?accountId=${encodeURIComponent(selectedAccountId)}&from=${dateRange.from}&to=${dateRange.to}`),
        ]);
        if(ignore) return;
        const insightMap=new Map();
        for(const row of insights) {
          const k=row.campaign_id;
          const ex=insightMap.get(k)||{spend:0,reach:0,impressions:0,clicks:0,ctr:0,cpc:0,roas:0};
          ex.spend+=toNumber(row.spend); ex.reach+=toNumber(row.reach);
          ex.impressions+=toNumber(row.impressions); ex.clicks+=toNumber(row.clicks);
          ex.ctr=toNumber(row.ctr); ex.cpc=toNumber(row.cpc);
          ex.roas=toNumber(row.purchase_roas)||toNumber(row.website_purchase_roas);
          insightMap.set(k,ex);
        }
        const merged=meta.map(c=>{const m=insightMap.get(c.id)||{}; return {campaign_id:c.id,campaign_name:c.name,objective:c.objective||"—",status:c.effective_status||c.status||"—",spend:m.spend??0,reach:m.reach??0,impressions:m.impressions??0,clicks:m.clicks??0,ctr:m.ctr??0,cpc:m.cpc??0,roas:m.roas??0};});
        setCampaigns(merged);
        if(merged.length>0) setSelectedCampaignId(merged[0].campaign_id);
      } catch(e) { if(!ignore) setCampaignsError(e.message||"Failed to load campaigns"); }
      finally { if(!ignore) setCampaignsLoading(false); }
    })();
    return()=>{ignore=true;};
  },[selectedAccountId,dateRange.from,dateRange.to]);

  // Load adsets (meta + insights merged) when campaign selected
  useEffect(()=>{
    let ignore=false;
    if(!selectedAccountId||!selectedCampaignId) { setAdsets([]); setSelectedAdsetId(""); return; }
    (async()=>{
      try {
        setAdsetsLoading(true); setAdsetsError("");
        setAds([]); setAdsError(""); setSelectedAdsetId(""); setAdSearch(""); setAdsetSearch("");
        const [adsetMeta,adsetInsights]=await Promise.all([
          fetchJson(`${API_BASE}/adsets/detail?campaignId=${encodeURIComponent(selectedCampaignId)}`),
          fetchJson(`${API_BASE}/insights/adsets?accountId=${encodeURIComponent(selectedAccountId)}&from=${dateRange.from}&to=${dateRange.to}&campaignId=${encodeURIComponent(selectedCampaignId)}`),
        ]);
        if(ignore) return;
        const insightMap=new Map();
        for(const row of adsetInsights) {
          const k=row.adset_id;
          const ex=insightMap.get(k)||{spend:0,reach:0,impressions:0,clicks:0,ctr:0,cpc:0,roas:0};
          ex.spend+=toNumber(row.spend); ex.reach+=toNumber(row.reach);
          ex.impressions+=toNumber(row.impressions); ex.clicks+=toNumber(row.clicks);
          ex.ctr=toNumber(row.ctr); ex.cpc=toNumber(row.cpc);
          ex.roas=toNumber(row.purchase_roas)||toNumber(row.website_purchase_roas);
          insightMap.set(k,ex);
        }
        const merged=adsetMeta.map(a=>{const m=insightMap.get(a.id)||{}; return {adset_id:a.id,adset_name:a.name,status:a.effective_status||a.status||"—",daily_budget:a.daily_budget?toNumber(a.daily_budget)/100:null,lifetime_budget:a.lifetime_budget?toNumber(a.lifetime_budget)/100:null,bid_strategy:a.bid_strategy||null,optimization_goal:a.optimization_goal||null,targeting:a.targeting||null,spend:m.spend??0,reach:m.reach??0,impressions:m.impressions??0,clicks:m.clicks??0,ctr:m.ctr??0,cpc:m.cpc??0,roas:m.roas??0};});
        setAdsets(merged);
        if(merged.length>0) setSelectedAdsetId(merged[0].adset_id);
      } catch(e) { if(!ignore) setAdsetsError(e.message||"Failed to load ad sets"); }
      finally { if(!ignore) setAdsetsLoading(false); }
    })();
    return()=>{ignore=true;};
  },[selectedAccountId,selectedCampaignId,dateRange.from,dateRange.to]);

  // Load ads filtered by adsetId (server-side)
  useEffect(()=>{
    let ignore=false;
    if(!selectedAccountId||!selectedAdsetId) { setAds([]); return; }
    (async()=>{
      try {
        setAdsLoading(true); setAdsError("");
        const rows=await fetchJson(`${API_BASE}/insights/ads?accountId=${encodeURIComponent(selectedAccountId)}&from=${dateRange.from}&to=${dateRange.to}&adsetId=${encodeURIComponent(selectedAdsetId)}`);
        if(ignore) return;
        setAds(rows.map(r=>({ad_id:r.ad_id,ad_name:r.ad_name,adset_id:r.adset_id,adset_name:r.adset_name,spend:toNumber(r.spend),reach:toNumber(r.reach),impressions:toNumber(r.impressions),clicks:toNumber(r.clicks),ctr:toNumber(r.ctr),cpc:toNumber(r.cpc),roas:toNumber(r.purchase_roas)||toNumber(r.website_purchase_roas)})));
      } catch(e) { if(!ignore) setAdsError(e.message||"Failed to load ads"); }
      finally { if(!ignore) setAdsLoading(false); }
    })();
    return()=>{ignore=true;};
  },[selectedAccountId,selectedAdsetId,dateRange.from,dateRange.to]);

  // Derived: portfolios from accounts.
  // business{id,name} requires business_management scope so we group by
  // the account name prefix before the first " - " or first parenthesis,
  // which is a common naming convention (e.g. "Acme - Brand", "Acme - Retargeting").
  // Falls back to a single "All Accounts" group if no pattern is found.
  const portfolios=useMemo(()=>{
    const map=new Map();
    for(const acc of accounts) {
      const prefix = acc.name?.split(/\s[-–]\s|\s\(/)[0]?.trim() || "All Accounts";
      if(!map.has(prefix)) map.set(prefix,{id:prefix,name:prefix,accounts:[]});
      map.get(prefix).accounts.push(acc);
    }
    // Only expose groups if more than one account — otherwise a single group adds no value
    const groups = [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
    return groups.length > 1 ? groups : [];
  },[accounts]);

  const portfolioAccounts=useMemo(()=>{
    if(selectedPortfolioId==="__all__") return accounts;
    return portfolios.find(p=>p.id===selectedPortfolioId)?.accounts||[];
  },[accounts,portfolios,selectedPortfolioId]);

  const filteredAccounts=useMemo(()=>{
    const term=accountSearch.trim().toLowerCase();
    if(!term) return portfolioAccounts;
    return portfolioAccounts.filter(a=>a.name?.toLowerCase().includes(term)||a.id?.toLowerCase().includes(term));
  },[portfolioAccounts,accountSearch]);

  const selectedAccount=useMemo(()=>accounts.find(a=>a.id===selectedAccountId)??null,[accounts,selectedAccountId]);
  const selectedCampaign=useMemo(()=>campaigns.find(c=>c.campaign_id===selectedCampaignId)??null,[campaigns,selectedCampaignId]);
  const selectedAdset=useMemo(()=>adsets.find(a=>a.adset_id===selectedAdsetId)??null,[adsets,selectedAdsetId]);
  const selectedPortfolio=useMemo(()=>portfolios.find(p=>p.id===selectedPortfolioId)??null,[portfolios,selectedPortfolioId]);

  const sortedCampaigns=useMemo(()=>{
    const term=campaignSearch.trim().toLowerCase();
    const filtered=term?campaigns.filter(c=>c.campaign_name?.toLowerCase().includes(term)):campaigns;
    return sortRows(filtered,campaignSort);
  },[campaigns,campaignSort,campaignSearch]);

  const sortedAdsets=useMemo(()=>{
    const term=adsetSearch.trim().toLowerCase();
    const filtered=term?adsets.filter(a=>a.adset_name?.toLowerCase().includes(term)):adsets;
    return sortRows(filtered,adsetSort);
  },[adsets,adsetSort,adsetSearch]);

  const sortedAds=useMemo(()=>{
    const term=adSearch.trim().toLowerCase();
    const filtered=term?ads.filter(a=>a.ad_name?.toLowerCase().includes(term)):ads;
    return sortRows(filtered,adSort);
  },[ads,adSort,adSearch]);

  const campaignTotals=useMemo(()=>({spend:campaigns.reduce((s,c)=>s+c.spend,0),reach:campaigns.reduce((s,c)=>s+c.reach,0),impressions:campaigns.reduce((s,c)=>s+c.impressions,0),clicks:campaigns.reduce((s,c)=>s+c.clicks,0)}),[campaigns]);
  const adsetTotals=useMemo(()=>({spend:adsets.reduce((s,a)=>s+a.spend,0),reach:adsets.reduce((s,a)=>s+a.reach,0),impressions:adsets.reduce((s,a)=>s+a.impressions,0),clicks:adsets.reduce((s,a)=>s+a.clicks,0)}),[adsets]);
  const adTotals=useMemo(()=>({spend:ads.reduce((s,a)=>s+a.spend,0),reach:ads.reduce((s,a)=>s+a.reach,0),impressions:ads.reduce((s,a)=>s+a.impressions,0),clicks:ads.reduce((s,a)=>s+a.clicks,0)}),[ads]);

  const toggleSort=useCallback((section,key)=>{
    const setter=section==="campaign"?setCampaignSort:section==="adset"?setAdsetSort:setAdSort;
    setter(prev=>({key,direction:prev.key===key&&prev.direction==="asc"?"desc":"asc"}));
  },[]);

  const handlePortfolioChange=useCallback((portfolioId)=>{
    setSelectedPortfolioId(portfolioId);
    const accs=portfolioId==="__all__"?accounts:portfolios.find(p=>p.id===portfolioId)?.accounts||[];
    if(accs.length>0) setSelectedAccountId(accs[0].id);
  },[accounts,portfolios]);

  return (
    <>
      <style>{CSS}</style>
      <div className="page-root">

        {/* TOOLBAR */}
        <div className="toolbar">
          <div className="toolbar-left">
            <div className="app-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect width="20" height="20" rx="3" fill="#0F9D58"/>
                <rect x="3" y="4" width="14" height="2" rx="1" fill="white" opacity=".9"/>
                <rect x="3" y="8" width="14" height="2" rx="1" fill="white" opacity=".7"/>
                <rect x="3" y="12" width="9" height="2" rx="1" fill="white" opacity=".6"/>
              </svg>
            </div>
            <span className="toolbar-title">Meta Performance Dashboard</span>
          </div>
          <div className="toolbar-controls">
            <div className="ctrl-group">
              <label className="ctrl-label">Portfolio</label>
              <select value={selectedPortfolioId} onChange={e=>handlePortfolioChange(e.target.value)} disabled={accountsLoading} className="ctrl-input ctrl-select">
                <option value="__all__">All Portfolios ({accounts.length})</option>
                {portfolios.map(p=><option key={p.id} value={p.id}>{p.name} ({p.accounts.length})</option>)}
              </select>
            </div>
            <div className="ctrl-group">
              <label className="ctrl-label">Account</label>
              <input type="text" value={accountSearch} onChange={e=>setAccountSearch(e.target.value)} placeholder="Search…" className="ctrl-input search-input"/>
              <select value={selectedAccountId} onChange={e=>setSelectedAccountId(e.target.value)} disabled={accountsLoading||filteredAccounts.length===0} className="ctrl-input ctrl-select">
                {accountsLoading?<option>Loading…</option>:filteredAccounts.length===0?<option>No accounts</option>:filteredAccounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.id})</option>)}
              </select>
            </div>
            <div className="ctrl-group">
              <label className="ctrl-label">Date range</label>
              <input type="date" value={dateRange.from} onChange={e=>setDateRange(p=>({...p,from:e.target.value}))} className="ctrl-input date-input"/>
              <span className="date-sep">→</span>
              <input type="date" value={dateRange.to} onChange={e=>setDateRange(p=>({...p,to:e.target.value}))} className="ctrl-input date-input"/>
            </div>
          </div>
        </div>

        {accountsError&&<div className="error-banner">{accountsError}</div>}

        {/* PORTFOLIO OVERVIEW */}
        <div className="section-block">
          <div className="section-title-row">
            <span className="section-chip">Portfolio</span>
            <span className="section-heading">{selectedPortfolio?selectedPortfolio.name:"All Portfolios"}</span>
          </div>
          <div className="kpi-grid">
            <div className="kpi-card"><div className="kpi-value">{portfolioAccounts.length}</div><div className="kpi-label">Ad Accounts</div></div>
            <div className="kpi-card"><div className="kpi-value">{campaigns.length}</div><div className="kpi-label">Campaigns (loaded)</div></div>
            <div className="kpi-card"><div className="kpi-value metric-green">{fmt("spend",campaignTotals.spend)}</div><div className="kpi-label">Total Spend</div></div>
            <div className="kpi-card"><div className="kpi-value">{fmt("impressions",campaignTotals.impressions)}</div><div className="kpi-label">Impressions</div></div>
            <div className="kpi-card"><div className="kpi-value">{fmt("clicks",campaignTotals.clicks)}</div><div className="kpi-label">Clicks</div></div>
            <div className="kpi-card"><div className="kpi-value">{fmt("reach",campaignTotals.reach)}</div><div className="kpi-label">Reach</div></div>
          </div>
          <div className="portfolio-accounts">
            {portfolioAccounts.map(acc=>(
              <button key={acc.id} onClick={()=>setSelectedAccountId(acc.id)} className={`account-pill ${acc.id===selectedAccountId?"account-pill-active":""}`}>
                <span className="pill-name">{acc.name}</span>
                <span className="pill-currency">{acc.currency||"—"}</span>
              </button>
            ))}
          </div>
        </div>

        {/* SUMMARY STRIP */}
        {selectedCampaign&&(
          <div className="summary-strip">
            <div className="summary-item"><span className="summary-label">Account</span><span className="summary-value">{selectedAccount?.name}</span></div>
            <div className="summary-divider"/>
            <div className="summary-item"><span className="summary-label">Campaign</span><span className="summary-value campaign-name-strip">{selectedCampaign.campaign_name}</span></div>
            {selectedAdset&&<><div className="summary-divider"/><div className="summary-item"><span className="summary-label">Ad Set</span><span className="summary-value campaign-name-strip">{selectedAdset.adset_name}</span></div></>}
            <div className="summary-divider"/>
            <div className="summary-item"><span className="summary-label">Spend</span><span className="summary-value metric-green">{fmt("spend",selectedCampaign.spend)}</span></div>
            <div className="summary-item"><span className="summary-label">ROAS</span><span className="summary-value metric-green">{fmt("roas",selectedCampaign.roas)}</span></div>
            <div className="summary-item"><span className="summary-label">Clicks</span><span className="summary-value">{fmt("clicks",selectedCampaign.clicks)}</span></div>
            <div className="summary-item"><span className="summary-label">CTR</span><span className="summary-value">{fmt("ctr",selectedCampaign.ctr)}</span></div>
          </div>
        )}

        {/* CAMPAIGNS */}
        <div className="sheet-wrapper">
          <div className="sheet-header">
            <span className="section-chip chip-sm">Campaigns</span>
            <span className="sheet-tab active-tab">{selectedAccount?selectedAccount.name:"Select an account"}</span>
            <span className="sheet-count">{campaigns.length} rows</span>
          </div>
          {campaignsError&&<div className="error-banner">{campaignsError}</div>}
          <div className="table-search-bar">
            <input type="text" value={campaignSearch} onChange={e=>{setCampaignSearch(e.target.value);}} placeholder="🔍 Filter campaigns by name…" className="table-search-input"/>
            {campaignSearch&&<button className="clear-search" onClick={()=>setCampaignSearch("")}>✕</button>}
            {campaignSearch&&<span className="search-result-count">{sortedCampaigns.length} of {campaigns.length}</span>}
          </div>
          <div className="sheet-scroll">
            <table className="sheet-table">
              <thead><tr>
                <th className="sheets-th row-num-th">#</th>
                <SortableHeader label="Campaign" sortKey="campaign_name" section="campaign" sortState={campaignSort} onSort={toggleSort}/>
                <SortableHeader label="Objective" sortKey="objective" section="campaign" sortState={campaignSort} onSort={toggleSort}/>
                <SortableHeader label="Status" sortKey="status" section="campaign" sortState={campaignSort} onSort={toggleSort}/>
                <SortableHeader label="Spend" sortKey="spend" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="Reach" sortKey="reach" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="Impressions" sortKey="impressions" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="Clicks" sortKey="clicks" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="CTR" sortKey="ctr" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="CPC" sortKey="cpc" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
                <SortableHeader label="ROAS" sortKey="roas" section="campaign" sortState={campaignSort} onSort={toggleSort} right/>
              </tr></thead>
              <tbody>
                {campaignsLoading?<LoadingRow colSpan={11}/>:sortedCampaigns.length===0?<EmptyRow colSpan={11} msg="No campaigns found."/>:sortedCampaigns.map((c,i)=>{
                  const sel=c.campaign_id===selectedCampaignId;
                  return(<tr key={c.campaign_id} onClick={()=>setSelectedCampaignId(c.campaign_id)} className={`data-row ${sel?"selected-row":""}`}>
                    <td className="cell row-num">{i+1}</td>
                    <td className="cell cell-name">{c.campaign_name}</td>
                    <td className="cell">{c.objective}</td>
                    <td className="cell"><StatusBadge status={c.status}/></td>
                    <td className="cell cell-num metric-spend">{fmt("spend",c.spend)}</td>
                    <td className="cell cell-num">{fmt("reach",c.reach)}</td>
                    <td className="cell cell-num">{fmt("impressions",c.impressions)}</td>
                    <td className="cell cell-num">{fmt("clicks",c.clicks)}</td>
                    <td className="cell cell-num">{fmt("ctr",c.ctr)}</td>
                    <td className="cell cell-num">{fmt("cpc",c.cpc)}</td>
                    <td className="cell cell-num">{fmt("roas",c.roas)}</td>
                  </tr>);
                })}
              </tbody>
              {campaigns.length>0&&(<tfoot><tr className="totals-row">
                <td className="cell row-num"/><td className="cell totals-label" colSpan={3}>Totals</td>
                <td className="cell cell-num">{fmt("spend",campaignTotals.spend)}</td>
                <td className="cell cell-num">{fmt("reach",campaignTotals.reach)}</td>
                <td className="cell cell-num">{fmt("impressions",campaignTotals.impressions)}</td>
                <td className="cell cell-num">{fmt("clicks",campaignTotals.clicks)}</td>
                <td className="cell cell-num"/><td className="cell cell-num"/><td className="cell cell-num"/>
              </tr></tfoot>)}
            </table>
          </div>
        </div>

        {/* AD SETS */}
        {selectedCampaignId&&(
          <div className="sheet-wrapper">
            <div className="sheet-header">
              <span className="section-chip chip-sm chip-blue">Ad Sets</span>
              <span className="sheet-tab active-tab">{selectedCampaign?.campaign_name||"Campaign"}</span>
              <span className="sheet-count">{adsets.length} rows</span>
            </div>
            {adsetsError&&<div className="error-banner">{adsetsError}</div>}
            <div className="table-search-bar">
              <input type="text" value={adsetSearch} onChange={e=>setAdsetSearch(e.target.value)} placeholder="🔍 Filter ad sets by name…" className="table-search-input"/>
              {adsetSearch&&<button className="clear-search" onClick={()=>setAdsetSearch("")}>✕</button>}
              {adsetSearch&&<span className="search-result-count">{sortedAdsets.length} of {adsets.length}</span>}
            </div>
            <div className="sheet-scroll">
              <table className="sheet-table">
                <thead><tr>
                  <th className="sheets-th row-num-th">#</th>
                  <SortableHeader label="Ad Set" sortKey="adset_name" section="adset" sortState={adsetSort} onSort={toggleSort}/>
                  <SortableHeader label="Status" sortKey="status" section="adset" sortState={adsetSort} onSort={toggleSort}/>
                  <th className="sheets-th text-right">Budget</th>
                  <th className="sheets-th">Bid Strategy</th>
                  <SortableHeader label="Spend" sortKey="spend" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="Reach" sortKey="reach" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="Impressions" sortKey="impressions" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="Clicks" sortKey="clicks" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="CTR" sortKey="ctr" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="CPC" sortKey="cpc" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                  <SortableHeader label="ROAS" sortKey="roas" section="adset" sortState={adsetSort} onSort={toggleSort} right/>
                </tr></thead>
                <tbody>
                  {adsetsLoading?<LoadingRow colSpan={12}/>:sortedAdsets.length===0?<EmptyRow colSpan={12} msg="No ad sets found."/>:sortedAdsets.map((a,i)=>{
                    const sel=a.adset_id===selectedAdsetId;
                    const budget=a.daily_budget!=null?`${fmt("budget",a.daily_budget)}/day`:a.lifetime_budget!=null?`${fmt("budget",a.lifetime_budget)} life`:"—";
                    return(<tr key={a.adset_id} onClick={()=>setSelectedAdsetId(a.adset_id)} className={`data-row ${sel?"selected-row":""}`}>
                      <td className="cell row-num">{i+1}</td>
                      <td className="cell cell-name">{a.adset_name}</td>
                      <td className="cell"><StatusBadge status={a.status}/></td>
                      <td className="cell cell-num">{budget}</td>
                      <td className="cell"><span className="bid-chip">{a.bid_strategy?.replace(/_/g," ")||"—"}</span></td>
                      <td className="cell cell-num metric-spend">{fmt("spend",a.spend)}</td>
                      <td className="cell cell-num">{fmt("reach",a.reach)}</td>
                      <td className="cell cell-num">{fmt("impressions",a.impressions)}</td>
                      <td className="cell cell-num">{fmt("clicks",a.clicks)}</td>
                      <td className="cell cell-num">{fmt("ctr",a.ctr)}</td>
                      <td className="cell cell-num">{fmt("cpc",a.cpc)}</td>
                      <td className="cell cell-num">{fmt("roas",a.roas)}</td>
                    </tr>);
                  })}
                </tbody>
                {adsets.length>0&&(<tfoot><tr className="totals-row">
                  <td className="cell row-num"/><td className="cell totals-label" colSpan={4}>Totals</td>
                  <td className="cell cell-num">{fmt("spend",adsetTotals.spend)}</td>
                  <td className="cell cell-num">{fmt("reach",adsetTotals.reach)}</td>
                  <td className="cell cell-num">{fmt("impressions",adsetTotals.impressions)}</td>
                  <td className="cell cell-num">{fmt("clicks",adsetTotals.clicks)}</td>
                  <td className="cell cell-num"/><td className="cell cell-num"/><td className="cell cell-num"/>
                </tr></tfoot>)}
              </table>
            </div>
          </div>
        )}

        {/* ADS + AUDIENCE PANEL */}
        {selectedAdsetId&&(
          <div className="ads-audience-wrapper">
            <div className="sheet-wrapper ads-sheet">
              <div className="sheet-header">
                <span className="section-chip chip-sm chip-purple">Ads</span>
                <span className="sheet-tab active-tab">{selectedAdset?.adset_name||"Ad Set"}</span>
                <span className="sheet-count">{ads.length} rows</span>
              </div>
              {adsError&&<div className="error-banner">{adsError}</div>}
              <div className="table-search-bar">
                <input type="text" value={adSearch} onChange={e=>setAdSearch(e.target.value)} placeholder="🔍 Filter ads by name…" className="table-search-input"/>
                {adSearch&&<button className="clear-search" onClick={()=>setAdSearch("")}>✕</button>}
                {adSearch&&<span className="search-result-count">{sortedAds.length} of {ads.length}</span>}
              </div>
              <div className="sheet-scroll">
                <table className="sheet-table">
                  <thead><tr>
                    <th className="sheets-th row-num-th">#</th>
                    <SortableHeader label="Ad Name" sortKey="ad_name" section="ad" sortState={adSort} onSort={toggleSort}/>
                    <SortableHeader label="Spend" sortKey="spend" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="Reach" sortKey="reach" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="Impressions" sortKey="impressions" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="Clicks" sortKey="clicks" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="CTR" sortKey="ctr" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="CPC" sortKey="cpc" section="ad" sortState={adSort} onSort={toggleSort} right/>
                    <SortableHeader label="ROAS" sortKey="roas" section="ad" sortState={adSort} onSort={toggleSort} right/>
                  </tr></thead>
                  <tbody>
                    {adsLoading?<LoadingRow colSpan={9}/>:sortedAds.length===0?<EmptyRow colSpan={9} msg="No ads found for this ad set and date range."/>:sortedAds.map((ad,i)=>(
                      <tr key={`${ad.ad_id}-${ad.adset_id}`} className="data-row">
                        <td className="cell row-num">{i+1}</td>
                        <td className="cell cell-name">{ad.ad_name}</td>
                        <td className="cell cell-num metric-spend">{fmt("spend",ad.spend)}</td>
                        <td className="cell cell-num">{fmt("reach",ad.reach)}</td>
                        <td className="cell cell-num">{fmt("impressions",ad.impressions)}</td>
                        <td className="cell cell-num">{fmt("clicks",ad.clicks)}</td>
                        <td className="cell cell-num">{fmt("ctr",ad.ctr)}</td>
                        <td className="cell cell-num">{fmt("cpc",ad.cpc)}</td>
                        <td className="cell cell-num">{fmt("roas",ad.roas)}</td>
                      </tr>
                    ))}
                  </tbody>
                  {ads.length>0&&(<tfoot><tr className="totals-row">
                    <td className="cell row-num"/><td className="cell totals-label">Totals</td>
                    <td className="cell cell-num">{fmt("spend",adTotals.spend)}</td>
                    <td className="cell cell-num">{fmt("reach",adTotals.reach)}</td>
                    <td className="cell cell-num">{fmt("impressions",adTotals.impressions)}</td>
                    <td className="cell cell-num">{fmt("clicks",adTotals.clicks)}</td>
                    <td className="cell cell-num"/><td className="cell cell-num"/><td className="cell cell-num"/>
                  </tr></tfoot>)}
                </table>
              </div>
            </div>
            <AudiencePanel adset={selectedAdset}/>
          </div>
        )}

      </div>
    </>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&family=Roboto+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.page-root{min-height:100vh;background:#f8f9fa;font-family:'Google Sans','Segoe UI',sans-serif;font-size:13px;color:#202124;display:flex;flex-direction:column}
.toolbar{position:sticky;top:0;z-index:100;background:#fff;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 16px;height:56px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.toolbar-left{display:flex;align-items:center;gap:10px}
.toolbar-title{font-size:15px;font-weight:500;color:#202124;white-space:nowrap}
.toolbar-controls{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.ctrl-group{display:flex;align-items:center;gap:6px}
.ctrl-label{font-size:11px;font-weight:600;color:#5f6368;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap}
.ctrl-input{height:32px;border:1px solid #dadce0;border-radius:4px;padding:0 10px;font-size:13px;font-family:inherit;color:#202124;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}
.ctrl-input:focus{border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,.18)}
.ctrl-select{padding-right:24px;appearance:auto;cursor:pointer;min-width:150px}
.search-input{width:130px}.date-input{width:132px}.date-sep{color:#5f6368;font-size:13px}
.error-banner{background:#fce8e6;color:#c5221f;border-bottom:1px solid #f5c6c4;padding:8px 16px;font-size:12px}
.section-block{background:#fff;border-bottom:1px solid #e0e0e0;padding:16px 20px}
.section-title-row{display:flex;align-items:center;gap:10px;margin-bottom:14px}
.section-heading{font-size:15px;font-weight:600;color:#202124}
.section-chip{display:inline-flex;align-items:center;padding:2px 9px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;background:#e6f4ea;color:#137333;flex-shrink:0}
.chip-sm{font-size:10px;padding:1px 7px}.chip-blue{background:#e8f0fe;color:#1a73e8}.chip-purple{background:#f3e8fd;color:#7b1fa2}
.kpi-grid{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.kpi-card{background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:12px 16px;min-width:120px;flex:1}
.kpi-value{font-size:18px;font-weight:600;color:#202124;font-family:'Roboto Mono',monospace;letter-spacing:-.5px}
.kpi-label{font-size:11px;color:#5f6368;margin-top:3px;font-weight:500}
.metric-green{color:#0f9d58}
.portfolio-accounts{display:flex;gap:8px;flex-wrap:wrap}
.account-pill{display:inline-flex;align-items:center;gap:8px;border:1px solid #dadce0;border-radius:20px;padding:5px 12px;background:#fff;cursor:pointer;font-family:inherit;font-size:12px;color:#3c4043;transition:all .15s}
.account-pill:hover{border-color:#1a73e8;color:#1a73e8;background:#e8f0fe}
.account-pill-active{border-color:#0f9d58;background:#e6f4ea;color:#137333;font-weight:600}
.pill-name{font-weight:500}.pill-currency{font-size:10px;color:#9aa0a6;font-family:'Roboto Mono',monospace}
.account-pill-active .pill-currency{color:#137333}
.summary-strip{display:flex;align-items:center;background:#fff;border-bottom:1px solid #e0e0e0;padding:0 16px;height:40px;overflow-x:auto;flex-shrink:0}
.summary-item{display:flex;align-items:center;gap:6px;padding:0 12px;flex-shrink:0}
.summary-divider{width:1px;height:18px;background:#e0e0e0;flex-shrink:0}
.summary-label{font-size:10px;color:#5f6368;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.summary-value{font-size:13px;font-weight:600;color:#202124}
.campaign-name-strip{max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sheet-wrapper{background:#fff;border-bottom:1px solid #e0e0e0;display:flex;flex-direction:column;min-width:0}
.sheet-header{display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:2px solid #e0e0e0;background:#f8f9fa;height:36px}
.sheet-tab{font-size:12px;font-weight:600;color:#5f6368;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:380px}
.active-tab{color:#0f9d58;border-bottom:2px solid #0f9d58;margin-bottom:-2px;padding-bottom:2px}
.sheet-count{font-size:11px;color:#9aa0a6;margin-left:auto;flex-shrink:0}
.sheet-scroll{overflow:auto;max-height:360px}
.sheet-table{width:100%;border-collapse:collapse;table-layout:auto;font-size:13px}
.sheets-th{position:sticky;top:0;z-index:10;background:#f8f9fa;border-right:1px solid #e0e0e0;border-bottom:2px solid #c6c9cc;padding:0 10px;height:28px;font-size:11px;font-weight:600;color:#5f6368;cursor:pointer;white-space:nowrap;user-select:none;transition:background .1s}
.sheets-th:hover{background:#e8f0fe;color:#1a73e8}
.sheets-th.active-col{background:#e8f0fe;color:#1a73e8}
.row-num-th{width:36px;text-align:center;color:#9aa0a6 !important;cursor:default}
.row-num-th:hover{background:#f8f9fa !important;color:#9aa0a6 !important}
.th-inner{display:flex;align-items:center;gap:4px;justify-content:inherit}
.sort-icon{display:flex;align-items:center;flex-shrink:0}
.text-right .th-inner{justify-content:flex-end}
.cell{border-right:1px solid #e0e0e0;border-bottom:1px solid #f0f0f0;padding:0 10px;height:28px;color:#3c4043;white-space:nowrap;vertical-align:middle}
.row-num{text-align:center;color:#9aa0a6;font-size:11px;background:#f8f9fa;border-right:2px solid #e0e0e0;user-select:none}
.cell-name{font-weight:500;color:#202124;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.cell-num{text-align:right;font-family:'Roboto Mono','Courier New',monospace;font-size:12px;font-variant-numeric:tabular-nums;color:#3c4043}
.metric-spend{color:#0f9d58;font-weight:500}
.data-row{transition:background .08s;cursor:pointer}
.data-row:hover .cell{background:#f1f3f4 !important}
.data-row:hover .row-num{background:#e8f0fe;color:#1a73e8}
.selected-row .cell{background:#e8f0fe !important}
.selected-row .row-num{background:#1a73e8 !important;color:#fff !important}
.selected-row .cell-name{color:#1a73e8}
.totals-row .cell{background:#f8f9fa;border-top:2px solid #c6c9cc;font-weight:600;color:#202124}
.totals-row .cell-num{color:#0f9d58}
.totals-label{color:#5f6368;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.empty-cell{text-align:center;color:#9aa0a6;padding:28px 16px;font-size:13px}
.loader-dots{display:inline-flex;gap:5px;align-items:center}
.loader-dots span{width:7px;height:7px;border-radius:50%;background:#0f9d58;animation:bounce 1s ease-in-out infinite}
.loader-dots span:nth-child(2){animation-delay:.15s;background:#1a73e8}
.loader-dots span:nth-child(3){animation-delay:.3s;background:#fbbc04}
@keyframes bounce{0%,80%,100%{transform:scale(.7);opacity:.5}40%{transform:scale(1);opacity:1}}
.status-badge{display:inline-flex;align-items:center;padding:1px 7px;border-radius:10px;font-size:10px;font-weight:700;letter-spacing:.02em;text-transform:uppercase}
.badge-active{background:#e6f4ea;color:#137333}.badge-paused{background:#fef7e0;color:#b06000}
.badge-archived{background:#f1f3f4;color:#5f6368}.badge-deleted{background:#fce8e6;color:#c5221f}.badge-other{background:#e8eaed;color:#3c4043}
.bid-chip{font-size:10px;color:#5f6368;text-transform:capitalize;letter-spacing:.03em}
.ads-audience-wrapper{display:grid;grid-template-columns:1fr 300px;border-bottom:1px solid #e0e0e0;background:#fff}
.ads-sheet{border-right:1px solid #e0e0e0;border-bottom:none}
.aud-panel{padding:16px;overflow-y:auto;max-height:420px;background:#fff;display:flex;flex-direction:column;gap:12px;border-left:1px solid #e0e0e0}
.aud-empty{align-items:center;justify-content:center;color:#9aa0a6;text-align:center}
.aud-panel-title{font-size:13px;font-weight:700;color:#202124;letter-spacing:.01em}
.aud-adset-name{font-size:12px;color:#1a73e8;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aud-hint{font-size:12px;color:#9aa0a6;line-height:1.5}
.aud-section{display:flex;flex-direction:column;gap:6px}
.aud-section-label{font-size:10px;font-weight:700;color:#5f6368;text-transform:uppercase;letter-spacing:.06em;border-top:1px solid #f0f0f0;padding-top:8px}
.aud-section:first-of-type .aud-section-label{border-top:none;padding-top:0}
.aud-kv-grid{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center}
.aud-kv-key{font-size:11px;color:#9aa0a6;font-weight:500;white-space:nowrap}
.aud-kv-val{font-size:12px;color:#202124;font-weight:500;text-transform:capitalize}
.aud-tags{display:flex;flex-wrap:wrap;gap:5px}
.aud-tag{display:inline-flex;align-items:center;padding:2px 9px;border-radius:12px;font-size:11px;font-weight:500;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:default}
.aud-included{background:#e6f4ea;color:#137333}.aud-excluded{background:#fce8e6;color:#c5221f}
.aud-lookalike{background:#e8f0fe;color:#1a73e8}.aud-interest{background:#fef7e0;color:#b06000}
.aud-behavior{background:#f3e8fd;color:#7b1fa2}.aud-geo{background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9}
.table-search-bar{display:flex;align-items:center;gap:8px;padding:7px 12px;background:#fff;border-bottom:1px solid #e0e0e0;flex-shrink:0}
.table-search-input{flex:1;height:28px;border:1px solid #dadce0;border-radius:4px;padding:0 10px;font-size:12px;font-family:inherit;color:#202124;background:#fafafa;outline:none;transition:border-color .15s,box-shadow .15s;min-width:0}
.table-search-input:focus{border-color:#1a73e8;box-shadow:0 0 0 2px rgba(26,115,232,.15);background:#fff}
.clear-search{display:flex;align-items:center;justify-content:center;width:20px;height:20px;border:none;border-radius:50%;background:#e0e0e0;color:#5f6368;font-size:11px;cursor:pointer;flex-shrink:0;padding:0;line-height:1}
.clear-search:hover{background:#dadce0;color:#202124}
.search-result-count{font-size:11px;color:#9aa0a6;white-space:nowrap;flex-shrink:0}
.sheet-scroll::-webkit-scrollbar,.aud-panel::-webkit-scrollbar{width:7px;height:7px}
.sheet-scroll::-webkit-scrollbar-track,.aud-panel::-webkit-scrollbar-track{background:#f8f9fa}
.sheet-scroll::-webkit-scrollbar-thumb,.aud-panel::-webkit-scrollbar-thumb{background:#dadce0;border-radius:4px}
.sheet-scroll::-webkit-scrollbar-thumb:hover,.aud-panel::-webkit-scrollbar-thumb:hover{background:#bdc1c6}
@media(max-width:900px){.ads-audience-wrapper{grid-template-columns:1fr}.ads-sheet{border-right:none}.toolbar-controls{gap:10px}}
`;
