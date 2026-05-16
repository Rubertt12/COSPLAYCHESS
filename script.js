const peoes = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const nobres = ['T1','C1','B1','Q1','K1','B2','C2','T2'];
const pieceNames = { 'P': 'INFANTARIA', 'T': 'TORRE', 'C': 'CAVALARIA', 'B': 'BISPO', 'Q': 'RAINHA', 'K': 'REI' };
const pieceIcons = { 'P': 'shield', 'T': 'castle', 'C': 'swords', 'B': 'eye', 'Q': 'crown', 'K': 'target' };

const getInitialBoard = () => [
    ...nobres.map(id => id + '_P'), ...peoes.map(id => id + '_P'),
    ...Array(32).fill(null),
    ...peoes.map(id => id + '_B'), ...nobres.map(id => id + '_B')
];

let db, store = { 
    p: {}, g: {killsB:0, killsP:0, avatarB:'', avatarP:''}, 
    board: getInitialBoard(), graveyard: [] 
};

let ambientAudios = { Ambiente: new Audio(), Entrada: new Audio(), Intro1: new Audio(), Intro2: new Audio() };
let fadeIntervals = { Ambiente: null, Entrada: null, Intro1: null, Intro2: null };
let isLive = false, turn = 'B', sel = null, pending = null, gySel = null;

const req = indexedDB.open("WarEngine_v33_2", 1);
req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
req.onsuccess = e => { db = e.target.result; loadData(); };

function loadData() {
    db.transaction("assets").objectStore("assets").get("all").onsuccess = e => {
        if(e.target.result) store = e.target.result;
        if(!store.board) store.board = getInitialBoard();
        if(!store.graveyard) store.graveyard = [];
        renderBoard(); renderGraveyard(); updateUI(); renderConfigLists(); setupAmbientUI();
    };
}

function triggerQuickUpload(id) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        if (file) {
            const r = new FileReader();
            r.onload = ev => {
                if(!store.p[id]) store.p[id] = {};
                store.p[id].img = ev.target.result;
                save();
                renderBoard(); 
                renderConfigLists();
            };
            r.readAsDataURL(file);
        }
    };
    input.click();
}

function showUnitID(id, callback) {
    const isWhite = id.endsWith('_B');
    const modal = document.createElement('div');
    modal.id = "unit-modal-overlay";
    modal.style = "position:fixed; inset:0; background:rgba(0,0,0,0.9); z-index:5000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px); cursor:pointer;";
    
    const currentName = store.p[id]?.name || pieceNames[id.charAt(0)];

    modal.innerHTML = `
        <div id="unit-modal-content" style="background:#0a0a0c; border:1px solid ${isWhite?'#fff':'#ff0055'}; padding:40px; border-radius:4px; text-align:center; box-shadow: 0 0 30px rgba(0,0,0,0.5); cursor:default;">
            <div style="width:150px; height:150px; margin:0 auto 20px; background:url(${store.p[id]?.img || ''}) center/cover #111; border:1px solid #333; border-radius:4px;"></div>
            <h2 style="letter-spacing:2px; margin-bottom:5px;">${currentName}</h2>
            <p style="color:#00f2ff; font-size:10px; margin-bottom:25px; opacity:0.7;">UNIT_ID: ${id}</p>
            <button id="confirm-move" class="btn" style="background:#00f2ff; color:#000; width:100%; padding:12px; font-weight:900; cursor:pointer; border:none; margin-bottom:10px;">INICIAR OPERAÇÃO</button>
            <button id="cancel-move" class="btn" style="background:transparent; color:#fff; width:100%; padding:8px; font-size:10px; cursor:pointer; border:1px solid #333; opacity:0.5;">ABORTAR</button>
        </div>
    `;

    document.body.appendChild(modal);

    modal.onclick = (e) => { if(e.target.id === "unit-modal-overlay") { modal.remove(); sel = null; renderBoard(); } };
    document.getElementById('confirm-move').onclick = () => { modal.remove(); callback(); };
    document.getElementById('cancel-move').onclick = () => { modal.remove(); sel = null; renderBoard(); };
}

function renderBoard() {
    const b = document.getElementById('board'); b.innerHTML = '';
    const edit = document.getElementById('edit-mode').checked;
    store.board.forEach((id, i) => {
        const sq = document.createElement('div'); 
        sq.className = `sq ${(Math.floor(i/8) + i%8) % 2 == 0 ? 'l' : 'd'}`;
        sq.onclick = () => handleSq(i);
        
        if(id) {
            const c = document.createElement('div'); c.className='piece-container';
            const p = document.createElement('div'); p.className='piece';
            if(store.p[id]?.img) p.style.backgroundImage = `url(${store.p[id].img})`;
            else { 
                p.classList.add('no-img'); 
                if (id.endsWith('_B')) {
                    p.style.backgroundColor = '#fff';
                    p.style.color = '#000'; 
                } else {
                    p.style.backgroundColor = '#ff0055';
                    p.style.color = '#fff';
                }
                p.innerText = store.p[id]?.name || id.split('_')[0]; 
            }

            p.onclick = (e) => { if(edit) { e.stopPropagation(); triggerQuickUpload(id); } };

            c.appendChild(p);
            if(edit) {
                const x = document.createElement('div'); x.className='btn-remove'; x.innerHTML='×';
                x.onclick=(e)=>{ e.stopPropagation(); store.graveyard.push(store.board[i]); store.board[i]=null; renderBoard(); renderGraveyard(); save(); };
                c.appendChild(x);
            }
            sq.appendChild(c);
        }
        b.appendChild(sq);
    });
}

function handleSq(i) {
    if(gySel !== null) {
        if(!store.board[i]) { store.board[i] = store.graveyard[gySel]; store.graveyard.splice(gySel, 1); gySel = null; renderBoard(); renderGraveyard(); save(); }
        return;
    }
    if(document.getElementById('edit-mode').checked) return;
    if(!isLive) return;

    const free = document.getElementById('free-move').checked;
    if(sel === null) {
        const id = store.board[i];
        if(id && (free || id.endsWith('_' + turn))) {
            sel = i;
            showUnitID(id, () => {
                renderBoard();
                document.getElementById('board').children[i].style.boxShadow = "inset 0 0 15px #00f2ff";
            });
        }
    } else {
        if (sel === i) { sel = null; renderBoard(); return; }
        if (store.board[i] && store.board[i].endsWith(store.board[sel].slice(-2))) { 
            sel = i; showUnitID(store.board[i], () => { renderBoard(); }); return; 
        }
        if (store.board[i]) { pending = {f: sel, t: i}; openArena(); }
        else { store.board[i] = store.board[sel]; store.board[sel] = null; if(!free) nextTurn(); else { sel=null; renderBoard(); save(); } }
    }
}

function openArena() {
    const idA = store.board[pending.f];
    const idD = store.board[pending.t];
    const typeA = idA.charAt(0);
    const typeD = idD.charAt(0);
    const imgA = document.getElementById('a-img');
    const imgD = document.getElementById('d-img');

    const setFighter = (el, id, type) => {
        el.innerHTML = ''; 
        if (store.p[id]?.img) {
            el.style.backgroundImage = `url(${store.p[id].img})`;
        } else {
            el.style.backgroundImage = 'none';
            const color = id.endsWith('_B') ? '00f2ff' : 'ff0055';
            el.innerHTML = `<img src="https://lucide.dev/api/icons/${pieceIcons[type]}?color=${color}&size=100" style="width:60%; opacity:0.8;">`;
        }
    };
    setFighter(imgA, idA, typeA);
    setFighter(imgD, idD, typeD);
    document.getElementById('arena').style.display = 'flex';
}

function finishDuel(v) {
    const idA = store.board[pending.f], idD = store.board[pending.t], corA = idA.endsWith('_B') ? 'B' : 'P';
    v === 'B' ? store.g.killsB++ : store.g.killsP++;
    if(v === corA) { store.graveyard.push(idD); store.board[pending.t] = idA; store.board[pending.f] = null; } 
    else { store.graveyard.push(idA); store.board[pending.f] = null; }
    document.getElementById('arena').style.display='none'; renderGraveyard(); nextTurn();
}

function syncTrackVolume(type) {
    if (fadeIntervals[type]) return; 
    ambientAudios[type].volume = parseFloat(document.getElementById(`vol-${type}`)?.value || 0.7) * parseFloat(document.getElementById('v-master').value);
}
function updateMasterVolume() { Object.keys(ambientAudios).forEach(t => syncTrackVolume(t)); }

function playWithFade(type) {
    const a = ambientAudios[type];
    const target = parseFloat(document.getElementById(`vol-${type}`)?.value || 0.7) * parseFloat(document.getElementById('v-master').value);
    if (fadeIntervals[type]) clearInterval(fadeIntervals[type]);
    a.play();
    fadeIntervals[type] = setInterval(() => {
        if (a.volume < target - 0.02) a.volume += 0.02;
        else { a.volume = target; clearInterval(fadeIntervals[type]); fadeIntervals[type] = null; }
    }, 30);
}

function stopWithFade(type) {
    const a = ambientAudios[type];
    if (fadeIntervals[type]) clearInterval(fadeIntervals[type]);
    fadeIntervals[type] = setInterval(() => {
        if (a.volume > 0.02) a.volume -= 0.02;
        else { a.pause(); a.volume = 0; clearInterval(fadeIntervals[type]); fadeIntervals[type] = null; }
    }, 30);
}

function setupAmbientUI() {
    const cont = document.getElementById('ambient-controls'); cont.innerHTML = '';
    ['Ambiente', 'Entrada', 'Intro1', 'Intro2'].forEach(t => {
        if(store.g['snd'+t]) ambientAudios[t].src = store.g['snd'+t];
        ambientAudios[t].loop = (t === 'Ambiente');
        const d = document.createElement('div'); d.className = "unit-card";
        d.style = "margin-bottom: 5px; border: 1px solid #222; padding: 8px; background: rgba(255,255,255,0.01);";
        d.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                <span style="font-size:10px; font-weight:bold; color:#00f2ff">${t.toUpperCase()}</span>
                <input type="file" id="file-${t}" style="display:none" onchange="upAmb('${t}', this)">
                <button onclick="document.getElementById('file-${t}').click()" style="background:none; border:1px solid #444; color:white; cursor:pointer; font-size:10px;">📁</button>
            </div>
            <input type="range" id="vol-${t}" min="0" max="1" step="0.01" value="0.7" style="width:100%;" oninput="syncTrackVolume('${t}')">
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top:8px;">
                <button onclick="playWithFade('${t}')" style="background:#004d4d; color:white; border:none; padding:4px; font-size:9px; cursor:pointer;">PLAY</button>
                <button onclick="stopWithFade('${t}')" style="background:#4d001a; color:white; border:none; padding:4px; font-size:9px; cursor:pointer;">STOP</button>
            </div>
        `;
        cont.appendChild(d);
    });
}

function upAmb(t, i) {
    const r = new FileReader();
    r.onload = e => { store.g['snd'+t] = e.target.result; ambientAudios[t].src = e.target.result; save(); playWithFade(t); };
    r.readAsDataURL(i.files[0]);
}

function save() { if(db) db.transaction("assets","readwrite").objectStore("assets").put(store,"all"); }

function nextTurn() { 
    turn = turn==='B'?'P':'B'; 
    sel=null; 
    renderBoard(); 
    document.getElementById('card-B').className = `player-card ${turn==='B'?'active-B':''}`;
    document.getElementById('card-P').className = `player-card ${turn==='P'?'active-P':''}`;
    save(); 
}

function updateUI() {
    document.getElementById('score-B').innerText = store.g.killsB; 
    document.getElementById('score-P').innerText = store.g.killsP;
    document.getElementById('img-B').style.backgroundImage = `url(${store.g.avatarB || ''})`; 
    document.getElementById('img-P').style.backgroundImage = `url(${store.g.avatarP || ''})`;
    document.getElementById('card-B').className = `player-card ${turn==='B'?'active-B':''}`;
    document.getElementById('card-P').className = `player-card ${turn==='P'?'active-P':''}`;
}

function renderGraveyard() {
    const gy = document.getElementById('graveyard'); gy.innerHTML = '';
    store.graveyard.forEach((id, idx) => {
        const p = document.createElement('div'); p.className = `gy-piece ${gySel === idx ? 'selected' : ''}`;
        if(store.p[id]?.img) p.style.backgroundImage = `url(${store.p[id].img})`;
        else p.style.backgroundColor = id.endsWith('_B') ? '#fff' : '#ff0055';
        p.onclick = () => { gySel = (gySel === idx) ? null : idx; renderGraveyard(); };
        gy.appendChild(p);
    });
}

function renderConfigLists() {
    ['white','black'].forEach(s => {
        const team = s==='white'?'B':'P', cont = document.getElementById('list-'+s);
        cont.innerHTML = `<h3 style="font-size:11px; color:#555; margin:10px 0; letter-spacing:1px;">SQUAD_${s.toUpperCase()}</h3>`;
        [...nobres, ...peoes].forEach(p => {
            const id = `${p}_${team}`; 
            const currentName = store.p[id]?.name || id;
            const d = document.createElement('div'); 
            d.className = 'unit-card';
            d.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:25px; height:25px; background:url(${store.p[id]?.img || ''}) center/cover #111; border-radius:3px;"></div>
                    <input type="text" class="edit-piece-name-input" value="${currentName}" onchange="updatePieceName('${id}', this.value)" title="Editar nome visível">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                    <span style="font-size:8px; color:#444;">ID: ${id}</span>
                    <input type="file" style="font-size:8px; width:75px;" onchange="upPiece('${id}',this)">
                </div>
            `;
            cont.appendChild(d);
        });
    });
}

function updatePieceName(id, newName) {
    if (!store.p[id]) store.p[id] = {};
    store.p[id].name = newName.toUpperCase().trim();
    save();
    renderBoard(); 
}

function upPiece(id, i) { const r = new FileReader(); r.onload = e => { if(!store.p[id]) store.p[id]={}; store.p[id].img = e.target.result; save(); renderBoard(); renderConfigLists(); }; r.readAsDataURL(i.files[0]); }
function upAvatar(s, i) { const r = new FileReader(); r.onload = e => { store.g['avatar'+s] = e.target.result; save(); updateUI(); }; r.readAsDataURL(i.files[0]); }
function showTab(t) { 
    ['white','black','sys'].forEach(id => document.getElementById('list-'+id).style.display = (id===t?'block':'none'));
    ['t-white','t-black','t-sys'].forEach(id => document.getElementById(id).className = (id==='t-'+t?'active':''));
}
function startBattle() { isLive=true; document.getElementById('sidebar').classList.remove('open'); updateUI(); }
function resetGame() { if(confirm("Deseja fazer o Reset total da aplicação?")) { indexedDB.deleteDatabase("WarEngine_v33_2"); location.reload(); } }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function closeArena() { document.getElementById('arena').style.display='none'; sel=null; renderBoard(); }

function rollInitiative() {
    const win = Math.random() < 0.5 ? 'BRANCAS' : 'PRETAS';
    alert(`🎲 Iniciativa sorteada! O jogo começa com as: ${win}`);
}
function clearBoardPieces() {
    if(confirm("Limpar todas as peças do tabuleiro?")) {
        store.board = Array(64).fill(null);
        renderBoard();
        save();
    }
}

window.addEventListener("load", () => setTimeout(() => document.getElementById("loader").style.display='none', 1000));


// Fecha o menu lateral automaticamente ao clicar fora dele
window.addEventListener('click', function(e) {
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    
    // Se o menu estiver aberto e o clique NÃO for dentro do menu e NÃO for no botão de abrir
    if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('open');
    }
});