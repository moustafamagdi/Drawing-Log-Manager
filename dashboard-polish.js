(() => {
  if (document.getElementById('dashboardPolishStyles')) return;
  const style = document.createElement('style');
  style.id = 'dashboardPolishStyles';
  style.textContent = `
    #advancedDashboard .insight-grid{
      display:grid;
      grid-template-columns:repeat(3,minmax(0,1fr));
      gap:14px;
      margin-top:14px;
      align-items:stretch;
    }
    #advancedDashboard .insight-grid > .panel{
      min-height:150px;
      padding:18px 18px 16px;
      display:flex;
      flex-direction:column;
      justify-content:flex-start;
      overflow:hidden;
    }
    #advancedDashboard .insight-grid h3{
      margin:0 0 14px;
      font-size:16px;
      line-height:1.2;
    }
    #advancedDashboard #dashByDiscipline,
    #advancedDashboard #dashByStage,
    #advancedDashboard #dashByStatus{
      display:flex;
      flex-direction:column;
      gap:9px;
      width:100%;
    }
    #advancedDashboard .bar-row{
      display:grid;
      grid-template-columns:minmax(78px,auto) minmax(90px,1fr) 42px;
      gap:10px;
      align-items:center;
      margin:0;
      min-height:24px;
      font-size:12px;
    }
    #advancedDashboard .bar-row > strong{
      font-size:12px;
      font-weight:700;
      white-space:nowrap;
      overflow:hidden;
      text-overflow:ellipsis;
    }
    #advancedDashboard .bar-row > span{
      text-align:right;
      font-variant-numeric:tabular-nums;
      color:#5f6b7a;
      font-weight:600;
    }
    #advancedDashboard .bar-track{
      height:9px;
      background:#e8edf5;
      border-radius:999px;
      overflow:hidden;
      min-width:0;
    }
    #advancedDashboard .bar-fill{
      height:100%;
      border-radius:999px;
      background:#376fd5;
      min-width:4px;
    }
    @media(max-width:1100px){
      #advancedDashboard .insight-grid{grid-template-columns:1fr;}
      #advancedDashboard .insight-grid > .panel{min-height:auto;}
      #advancedDashboard .bar-row{grid-template-columns:100px 1fr 42px;}
    }
    @media(max-width:640px){
      #advancedDashboard .bar-row{grid-template-columns:74px 1fr 36px;gap:8px;}
    }
  `;
  document.head.appendChild(style);
})();
