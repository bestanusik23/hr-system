/** CSS กลางของทุกหน้าจอในเมนู Bar Management (White + Hospital Blue) */
export const BAR_CSS = `
#barmgr{
  --b-blue:#0B4FC7; --b-blue-050:#EAF1FF; --b-cyan:#26A9E0;
  --b-ink:#152A4E; --b-muted:#6B7A99; --b-line:#E6EBF5; --b-bg:#F2F5FB;
  --b-green:#12A150; --b-amber:#E08C00; --b-red:#DC2626; --b-violet:#6D5BD0;
  font-family:'IBM Plex Sans Thai',system-ui,sans-serif; color:var(--b-ink);
}
#barmgr *{box-sizing:border-box;}
#barmgr .num{font-variant-numeric:tabular-nums;}
#barmgr .card{background:#fff;border:1px solid var(--b-line);border-radius:16px;box-shadow:0 4px 18px rgba(17,40,90,.06);overflow:hidden;margin-bottom:14px;}
#barmgr .card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 10px;flex-wrap:wrap;}
#barmgr .card-head h3{margin:0;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px;}
#barmgr .card-head h3 .n{width:20px;height:20px;border-radius:6px;background:var(--b-blue-050);color:var(--b-blue);font-size:11px;display:grid;place-items:center;font-weight:700;flex-shrink:0;}
#barmgr .card-body{padding:0 16px 16px;}
#barmgr .hint{font-size:11.5px;color:var(--b-muted);line-height:1.6;}
#barmgr .toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;background:#fff;border:1px solid var(--b-line);border-radius:14px;padding:12px;margin-bottom:14px;box-shadow:0 4px 14px rgba(20,40,90,.04);}
#barmgr label.fld{font-size:12.5px;color:var(--b-muted);font-weight:600;}
#barmgr select,#barmgr input[type=text],#barmgr input[type=number]{
  height:36px;border:1.5px solid var(--b-line);border-radius:9px;padding:0 10px;font-family:inherit;
  font-size:13px;color:var(--b-ink);background:#fbfcfe;outline:none;}
#barmgr select:focus,#barmgr input:focus{border-color:var(--b-blue);}
#barmgr textarea{border:1.5px solid var(--b-line);border-radius:9px;padding:7px 10px;font-family:inherit;font-size:12.5px;color:var(--b-ink);background:#fbfcfe;outline:none;resize:vertical;}
#barmgr .btn{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:9px;border:1.5px solid var(--b-line);
  background:#fff;color:var(--b-ink);font-family:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;}
#barmgr .btn:hover{background:var(--b-blue-050);border-color:#c9daf9;color:var(--b-blue);}
#barmgr .btn.primary{background:var(--b-blue);border-color:var(--b-blue);color:#fff;}
#barmgr .btn.primary:hover{background:#093C99;}
#barmgr .btn.ok{background:var(--b-green);border-color:var(--b-green);color:#fff;}
#barmgr .btn.danger{background:#fff;border-color:#f3c7c7;color:var(--b-red);}
#barmgr .btn.danger:hover{background:#fdecec;}
#barmgr .btn:disabled{opacity:.55;cursor:not-allowed;}
#barmgr .btn.sm{height:29px;padding:0 10px;font-size:11.5px;border-radius:7px;}

#barmgr .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:14px;}
#barmgr .kpi{background:#fff;border:1px solid var(--b-line);border-radius:14px;padding:13px 14px;box-shadow:0 4px 18px rgba(17,40,90,.06);position:relative;overflow:hidden;}
#barmgr .kpi::after{content:'';position:absolute;inset:0 auto 0 0;width:4px;background:var(--b-blue);}
#barmgr .kpi.green::after{background:var(--b-green);} #barmgr .kpi.red::after{background:var(--b-red);}
#barmgr .kpi.amber::after{background:var(--b-amber);} #barmgr .kpi.violet::after{background:var(--b-violet);}
#barmgr .kpi.with-icon::after{display:none;}
#barmgr .kpi .ic{width:32px;height:32px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:9px;background:var(--b-blue-050);color:var(--b-blue);}
#barmgr .kpi.green .ic{background:#E7F7EE;color:var(--b-green);}
#barmgr .kpi.red .ic{background:#FDECEC;color:var(--b-red);}
#barmgr .kpi.amber .ic{background:#FFF6E3;color:var(--b-amber);}
#barmgr .kpi.violet .ic{background:#F1EFFC;color:var(--b-violet);}
#barmgr .kpi .lbl{font-size:11.5px;color:var(--b-muted);font-weight:600;line-height:1.3;min-height:30px;}
#barmgr .kpi .val{font-size:24px;font-weight:800;letter-spacing:-.6px;line-height:1.15;}
#barmgr .kpi .val small{font-size:11.5px;font-weight:600;color:var(--b-muted);margin-left:4px;letter-spacing:0;}
#barmgr .kpi .foot{font-size:10.8px;color:var(--b-muted);margin-top:5px;line-height:1.45;}
#barmgr .up{color:var(--b-red);} #barmgr .down{color:var(--b-green);}

#barmgr table.dt{width:100%;border-collapse:collapse;font-size:12.5px;}
#barmgr table.dt th{text-align:right;font-weight:700;color:var(--b-muted);font-size:11px;padding:8px 7px;border-bottom:1.5px solid var(--b-line);white-space:nowrap;background:#FAFBFE;}
#barmgr table.dt th:first-child,#barmgr table.dt td:first-child{text-align:left;}
#barmgr table.dt td{padding:7px;border-bottom:1px solid #F1F4FA;text-align:right;}
#barmgr table.dt tbody tr.over td{background:#FEF6F6;}
#barmgr table.dt tfoot td{font-weight:800;background:#F4F7FE;border-top:2px solid var(--b-line);padding:9px 7px;}
#barmgr .tbl-wrap{overflow-x:auto;}
#barmgr .chip{display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;white-space:nowrap;}
#barmgr .chip.service{background:var(--b-blue-050);color:var(--b-blue);}
#barmgr .chip.support{background:#E7F7EE;color:var(--b-green);}
#barmgr .chip.back{background:#F1EFFC;color:var(--b-violet);}
#barmgr .chip.pending{background:#FFF6E3;color:#B8590A;}
#barmgr .chip.approved{background:#E7F7EE;color:var(--b-green);}
#barmgr .chip.rejected{background:#FDECEC;color:var(--b-red);}
#barmgr .chip.none{background:#F1F4FA;color:var(--b-muted);}
#barmgr .mini-bar{display:inline-block;width:44px;height:6px;border-radius:99px;background:#EDF1F8;overflow:hidden;vertical-align:middle;margin-right:6px;}
#barmgr .mini-bar i{display:block;height:100%;border-radius:99px;}
#barmgr .rank{display:inline-grid;place-items:center;width:18px;height:18px;border-radius:5px;background:#F1F4FA;color:var(--b-muted);font-size:10px;font-weight:700;margin-right:6px;flex-shrink:0;}
#barmgr .band-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:10px;}
#barmgr .band{border-radius:10px;padding:7px 6px;text-align:center;font-size:10.5px;font-weight:700;line-height:1.4;}
#barmgr .band small{display:block;font-weight:500;font-size:9.5px;opacity:.85;}

#barmgr .insight{background:linear-gradient(100deg,#0A2C6B 0%,#0B4FC7 55%,#1470D8 100%);border-radius:16px;padding:15px 18px 17px;color:#fff;margin-bottom:14px;box-shadow:0 10px 30px rgba(17,40,90,.09);}
#barmgr .insight h3{margin:0 0 12px;font-size:15px;font-weight:800;display:flex;align-items:center;gap:9px;flex-wrap:wrap;}
#barmgr .insight .tag{font-size:10.5px;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.25);padding:3px 9px;border-radius:99px;font-weight:600;}
#barmgr .insight-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;}
#barmgr .ins{background:rgba(255,255,255,.11);border:1px solid rgba(255,255,255,.19);border-radius:12px;padding:11px 13px;display:flex;gap:10px;align-items:flex-start;}
#barmgr .ins .dot{width:8px;height:8px;border-radius:50%;margin-top:6px;flex-shrink:0;background:#7ee2a8;}
#barmgr .ins.warn .dot{background:#FFC24D;} #barmgr .ins.crit .dot{background:#FF8080;}
#barmgr .ins b{display:block;font-size:12.8px;font-weight:700;line-height:1.4;margin-bottom:2px;}
#barmgr .ins span{font-size:11.3px;opacity:.86;line-height:1.5;display:block;}

#barmgr .hm{width:100%;border-collapse:separate;border-spacing:3px;font-size:10.5px;}
#barmgr .hm th{color:var(--b-muted);font-weight:700;font-size:10px;padding:2px;}
#barmgr .hm td.lbl{text-align:left;font-weight:600;font-size:11px;white-space:nowrap;padding-right:4px;}
#barmgr .hm td.cell{border-radius:6px;height:24px;text-align:center;color:#fff;font-weight:700;font-size:10px;}
#barmgr .legend{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;align-items:center;}
#barmgr .legend span{display:inline-flex;align-items:center;gap:6px;}
#barmgr .legend i{width:16px;height:9px;border-radius:3px;display:inline-block;}
#barmgr .empty{padding:26px 16px;text-align:center;color:var(--b-muted);font-size:12.5px;line-height:1.8;}
#barmgr .warnbox{background:#FFF6E3;border:1px solid #F3D18B;color:#8a5a00;border-radius:10px;padding:10px 13px;font-size:12px;line-height:1.65;margin-bottom:12px;}
#barmgr .msg-ok{color:var(--b-green);font-size:11.5px;font-weight:600;}
#barmgr .msg-err{color:var(--b-red);font-size:11.5px;font-weight:600;}

#barmgr .grid-a{display:grid;grid-template-columns:1.15fr 1.2fr 1fr;gap:14px;margin-bottom:14px;align-items:start;}
#barmgr .grid-b{display:grid;grid-template-columns:1fr 1.5fr;gap:14px;margin-bottom:14px;align-items:start;}
#barmgr .grid-a>.card,#barmgr .grid-b>.card{margin-bottom:0;height:100%;}
#barmgr .pending-box{border:1px solid var(--b-line);border-radius:10px;padding:9px 11px;background:#FAFBFE;}
#barmgr .pending-row{display:flex;justify-content:space-between;gap:8px;font-size:11.8px;padding:5px 0;border-bottom:1px dashed var(--b-line);}
#barmgr .pending-row:last-child{border-bottom:none;}

@media(max-width:1100px){#barmgr .kpis{grid-template-columns:repeat(2,1fr);}}
@media(max-width:1300px){#barmgr .grid-a,#barmgr .grid-b{grid-template-columns:1fr 1fr;}}
@media(max-width:900px){#barmgr .grid-a,#barmgr .grid-b{grid-template-columns:1fr;}}
@media(max-width:700px){#barmgr .kpis{grid-template-columns:1fr;}}
`;
