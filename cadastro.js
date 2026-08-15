const cfg = window.COSPLAYCHESS_CONFIG;
const db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
const form = document.getElementById('signupForm');
const eventSelect = document.getElementById('eventSelect');
const statusBox = document.getElementById('formStatus');
const photoInput = document.getElementById('characterPhoto');
const preview = document.getElementById('photoPreview');
let photoDataUrl = '';

function status(message, type=''){ statusBox.className=`form-status ${type}`; statusBox.textContent=message; }

async function loadEvents(){
  const {data,error}=await db.from('cosplay_events').select('id,title,start_at,venue,city,registration_open').eq('published',true).order('start_at');
  if(error){ eventSelect.innerHTML='<option value="">Erro ao carregar eventos</option>'; return; }
  const open=(data||[]).filter(e=>e.registration_open);
  eventSelect.innerHTML='<option value="">Selecione um evento</option>'+open.map(e=>`<option value="${e.id}">${e.title} — ${new Date(e.start_at).toLocaleDateString('pt-BR')}</option>`).join('');
  const selected=new URLSearchParams(location.search).get('event');
  if(selected && open.some(e=>e.id===selected)) eventSelect.value=selected;
}

function resizeImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image(); const reader=new FileReader();
    reader.onload=()=>{ img.onload=()=>{
      const max=1200; const scale=Math.min(1,max/Math.max(img.width,img.height));
      const canvas=document.createElement('canvas'); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale);
      canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);
      resolve(canvas.toDataURL('image/jpeg',.84));
    }; img.onerror=reject; img.src=reader.result; }; reader.onerror=reject; reader.readAsDataURL(file);
  });
}

photoInput.addEventListener('change',async()=>{
  const file=photoInput.files[0]; if(!file){ photoDataUrl=''; return; }
  status('Otimizando foto...');
  try{ photoDataUrl=await resizeImage(file); preview.style.backgroundImage=`url('${photoDataUrl}')`; preview.textContent=''; status('Foto pronta.','success'); }
  catch{ status('Não foi possível processar essa imagem.','error'); }
});

form.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!photoDataUrl){ status('Escolha uma foto do personagem.','error'); return; }
  const button=document.getElementById('submitButton'); button.disabled=true; status('Enviando inscrição...');
  const data=Object.fromEntries(new FormData(form));
  try{
    const response=await fetch(`${cfg.functionsBase}/cosplaychess-register`,{method:'POST',headers:{'Content-Type':'application/json','apikey':cfg.supabaseKey},body:JSON.stringify({eventId:data.eventId,participant:{fullName:data.fullName,nick:data.nick,email:data.email,whatsapp:data.whatsapp,city:data.city,age:data.age,chessLevel:data.chessLevel,participationType:data.participationType,sidePreference:data.sidePreference,availability:data.availability,characterName:data.characterName,notes:data.notes},photo:{dataUrl:photoDataUrl}})});
    const result=await response.json(); if(!response.ok) throw new Error(result.error||'Erro ao enviar inscrição.');
    status(result.message,'success'); form.reset(); preview.style.backgroundImage=''; preview.textContent='Prévia da foto'; photoDataUrl='';
  }catch(err){ status(err.message||String(err),'error'); }
  finally{ button.disabled=false; }
});

loadEvents();
