(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const i of document.querySelectorAll('link[rel="modulepreload"]'))s(i);new MutationObserver(i=>{for(const r of i)if(r.type==="childList")for(const p of r.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&s(p)}).observe(document,{childList:!0,subtree:!0});function a(i){const r={};return i.integrity&&(r.integrity=i.integrity),i.referrerPolicy&&(r.referrerPolicy=i.referrerPolicy),i.crossOrigin==="use-credentials"?r.credentials="include":i.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function s(i){if(i.ep)return;i.ep=!0;const r=a(i);fetch(i.href,r)}})();const m="http://127.0.0.1:8000";async function y(t){const e=await fetch(`${m}/predict`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(!e.ok)throw new Error("Prediction request failed. Make sure the FastAPI backend is running.");return e.json()}async function b(t){const e=new FormData;e.append("file",t);const a=await fetch(`${m}/predict-image`,{method:"POST",body:e});if(!a.ok){const s=await h(a);throw new Error(s||"Image prediction failed.")}return a.json()}async function g(t,e=[]){const a=await fetch(`${m}/chat`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:t,history:e})});if(!a.ok){const s=await h(a);throw new Error(s||"Chat request failed.")}return a.json()}async function h(t){try{const e=await t.json();return e.detail||e.message}catch{return""}}const f=[{machine_id:"M-101",temperature:78,vibration:.31,pressure:42,rpm:1450,load:64},{machine_id:"M-204",temperature:91,vibration:.55,pressure:51,rpm:1320,load:83},{machine_id:"M-318",temperature:69,vibration:.22,pressure:38,rpm:1510,load:57}],n={latestPrediction:null,rows:[...f],chatMessages:[{role:"assistant",text:"Ready to answer maintenance questions when the API is running."}]},v=document.querySelector("#root");function $(t){return String(t||"").toLowerCase()}function c(){var e;const t=((e=n.latestPrediction)==null?void 0:e.summary)||{totalMachines:n.rows.length,criticalMachines:0,healthyMachines:0,avgConfidence:0};v.innerHTML=`
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Smart Factory</p>
          <h1>Predictive Maintenance Dashboard</h1>
        </div>
        <div class="api-pill" id="api-status">Checking API</div>
      </header>

      <section class="metrics" aria-label="Factory metrics">
        ${l("Machines",t.totalMachines)}
        ${l("Critical",t.criticalMachines)}
        ${l("Healthy",t.healthyMachines)}
        ${l("Confidence",`${t.avgConfidence}%`)}
      </section>

      <section class="workspace">
        <section class="panel prediction-panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Failure Risk</p>
              <h2>Sensor Prediction</h2>
            </div>
            <button class="secondary" id="sample-data-btn" type="button">Reset Sample</button>
          </div>

          <form id="prediction-form" class="machine-grid">
            ${n.rows.map((a,s)=>w(a,s)).join("")}
            <div class="actions">
              <button type="button" class="secondary" id="add-machine-btn">Add Machine</button>
              <button type="submit">Run Prediction</button>
            </div>
          </form>

          <div class="results">
            ${M()}
          </div>
        </section>

        <aside class="side-stack">
          <section class="panel">
            <p class="eyebrow">Visual Inspection</p>
            <h2>Defect Classifier</h2>
            <form id="image-form" class="upload-form">
              <input id="image-input" type="file" accept="image/*" />
              <button type="submit">Analyze Image</button>
            </form>
            <div class="image-result" id="image-result">Upload an equipment photo to classify it.</div>
          </section>

          <section class="panel chat-panel">
            <p class="eyebrow">Assistant</p>
            <h2>Maintenance Chat</h2>
            <div class="chat-log">
              ${n.chatMessages.map(a=>`
                <div class="message ${a.role}">${o(a.text)}</div>
              `).join("")}
            </div>
            <form id="chat-form" class="chat-form">
              <input id="chat-input" placeholder="Ask about vibration, overheating, maintenance..." />
              <button type="submit">Send</button>
            </form>
          </section>
        </aside>
      </section>
    </main>
  `,S(),P()}function l(t,e){return`
    <article class="metric">
      <span>${t}</span>
      <strong>${e}</strong>
    </article>
  `}function w(t,e){return`
    <fieldset class="machine-card">
      <legend>${o(t.machine_id||`Machine ${e+1}`)}</legend>
      ${d(e,"machine_id","Machine ID",t.machine_id,"text")}
      ${d(e,"temperature","Temp",t.temperature)}
      ${d(e,"vibration","Vibration",t.vibration,"number","0.01")}
      ${d(e,"pressure","Pressure",t.pressure)}
      ${d(e,"rpm","RPM",t.rpm)}
      ${d(e,"load","Load",t.load)}
      <button type="button" class="icon-action" data-remove-row="${e}" aria-label="Remove machine">Remove</button>
    </fieldset>
  `}function d(t,e,a,s,i="number",r="1"){return`
    <label>
      <span>${a}</span>
      <input data-row="${t}" data-field="${e}" type="${i}" step="${r}" value="${o(s)}" />
    </label>
  `}function M(){const t=n.latestPrediction;return t?`
    <div class="model-note">Model: ${o(t.model)}</div>
    <table>
      <thead>
        <tr>
          <th>Machine</th>
          <th>Status</th>
          <th>Risk</th>
          <th>Lead Time</th>
          <th>Cause</th>
        </tr>
      </thead>
      <tbody>
        ${t.machineResults.map(e=>`
          <tr>
            <td>${o(e.machine)}</td>
            <td><span class="status ${$(e.status)}">${o(e.status)}</span></td>
            <td>${e.failureProbability}%</td>
            <td>${o(e.leadTime)}</td>
            <td>${o(e.cause)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    <div class="bars">
      ${t.anomalySeries.map(e=>`
        <div class="bar-row">
          <span>${o(e.sensor)}</span>
          <div><i style="width:${e.score}%"></i></div>
          <strong>${e.score}</strong>
        </div>
      `).join("")}
    </div>
  `:'<div class="empty">Run a prediction to see machine status, likely cause, and lead time.</div>'}function S(){document.querySelector("#prediction-form").addEventListener("input",t=>{const e=t.target.closest("[data-row][data-field]");if(!e)return;const a=Number(e.dataset.row),s=e.dataset.field;n.rows[a][s]=s==="machine_id"?e.value:Number(e.value)}),document.querySelector("#prediction-form").addEventListener("submit",async t=>{t.preventDefault();const e=t.submitter;u(e,!0);try{n.latestPrediction=await y({rows:n.rows,threshold:.5}),c()}catch(a){C(a.message)}finally{u(e,!1)}}),document.querySelector("#add-machine-btn").addEventListener("click",()=>{n.rows.push({machine_id:`M-${100+n.rows.length+1}`,temperature:72,vibration:.25,pressure:40,rpm:1480,load:60}),c()}),document.querySelector("#sample-data-btn").addEventListener("click",()=>{n.rows=[...f],n.latestPrediction=null,c()}),document.querySelectorAll("[data-remove-row]").forEach(t=>{t.addEventListener("click",()=>{n.rows.length!==1&&(n.rows.splice(Number(t.dataset.removeRow),1),c())})}),document.querySelector("#image-form").addEventListener("submit",async t=>{t.preventDefault();const e=document.querySelector("#image-input").files[0],a=document.querySelector("#image-result");if(!e){a.textContent="Choose an image first.";return}u(t.submitter,!0);try{const s=await b(e);a.innerHTML=`<strong>${o(s.label)}</strong><span>Confidence ${s.confidence}%</span><span>Defect probability ${s.defect_probability}%</span>`}catch(s){a.textContent=s.message}finally{u(t.submitter,!1)}}),document.querySelector("#chat-form").addEventListener("submit",async t=>{t.preventDefault();const e=document.querySelector("#chat-input"),a=e.value.trim();if(a){n.chatMessages.push({role:"user",text:a}),e.value="",c();try{const s=await g(a,n.chatMessages);n.chatMessages.push({role:"assistant",text:s.answer})}catch(s){n.chatMessages.push({role:"assistant",text:s.message})}c()}})}async function P(){const t=document.querySelector("#api-status");try{const e=await fetch("http://127.0.0.1:8000/health");if(!e.ok)throw new Error("API unavailable");const a=await e.json();t.textContent=a.xgb_loaded?"API connected":"API connected, heuristic mode",t.className="api-pill ok"}catch{t.textContent="Start backend on :8000",t.className="api-pill warn"}}function u(t,e){var a;t&&(t.disabled=e,(a=t.dataset).originalText||(a.originalText=t.textContent),t.textContent=e?"Working...":t.dataset.originalText)}function C(t){const e=document.createElement("div");e.className="toast",e.textContent=t,document.body.append(e),setTimeout(()=>e.remove(),3200)}function o(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}c();
