/* * Cosplay Chess - Engine de Batalha
 * Desenvolvido por Rubra Studios
 */

const { ipcRenderer } = require('electron'); // Importação no topo para organização

const peoes = ['P1','P2','P3','P4','P5','P6','P7','P8'];
const nobres = ['T1','C1','B1','Q1','K1','B2','C2','T2'];

const getInitialBoard = () => [
    ...nobres.map(id => id + '_P'), ...peoes.map(id => id + '_P'),
    ...Array(32).fill(null),
    ...peoes.map(id => id + '_B'), ...nobres.map(id => id + '_B')
];

let db, store = { p: {}, g: {killsB:0, killsP:0, avatarB:'', avatarP:''}, board: getInitialBoard() };
let ambientAudios = { Ambiente: new Audio(), Entrada: new Audio(), Intro1: new Audio(), Intro2: new Audio() };
let audioAtk = new Audio(), audioDef = new Audio();
let isLive = false, turn = 'B', sel = null, pending = null;
let fadeInterval = null;

// Inicialização do Banco de Dados (IndexedDB)
const req = indexedDB.open("WarEngine_v33_2", 1);
req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
req.onsuccess = e => { db = e.target.result; loadData(); };

function loadData() {
    db.transaction("assets").objectStore("assets").get("all").onsuccess = e => {
        if(e.target.result) store = e.target.result;
        if(!store.board) store.board = getInitialBoard();
        renderBoard(); updateUI(); renderConfigLists(); setupAmbientUI();
    };
}

function setupAmbientUI() {
    const cont = document.getElementById('ambient-controls'); 
    if(!cont) return;
    cont.innerHTML = '';
    ['Ambiente', 'Entrada', 'Intro1', 'Intro2'].forEach(type => {
        if(store.g['snd'+type]) ambientAudios[type].src = store.g['snd'+type];
        ambientAudios[type].loop = (type === 'Ambiente');
        const div = document.createElement('div');
        div.className = 'ambient-unit';
        div.innerHTML = `<span>${type}</span>
            <input type="file" onchange="upAmb('${type}', this)">
            <div style="display:flex; gap:5px;"><button onclick="ambientAudios['${type}'].play()">▶</button><button onclick="ambientAudios['${type}'].pause()">||</button></div>`;
        cont.appendChild(div);
    });
}

function renderBoard() {
    const b = document.getElementById('board'); 
    b.innerHTML = '';
    const edit = document.getElementById('edit-mode').checked;

    store.board.forEach((id, i) => {
        const row = Math.floor(i / 8), col = i % 8;
        const sq = document.createElement('div'); 
        sq.className = `sq ${(row + col) % 2 == 0 ? 'l' : 'd'}`;
        sq.onclick = () => handleSq(i);
        
        if(id) {
            const c = document.createElement('div'); c.className='piece-container';
            const p = document.createElement('div'); p.className='piece';
            const data = store.p[id];
            
            if(data?.img) {
                p.style.backgroundImage = `url(${data.img})`;
            } else {
                p.classList.add('no-img');
                p.style.backgroundColor = id.endsWith('_B') ? '#fff' : 'var(--danger)';
                p.style.color = id.endsWith('_B') ? '#000' : '#fff';
                p.innerText = data?.name || id.split('_')[0];
            }
            
            c.appendChild(p);
            if(edit) {
                const x = document.createElement('div'); x.className='btn-remove'; x.innerHTML='×';
                x.onclick=(e)=>{e.stopPropagation(); store.board[i]=null; renderBoard(); save();};
                c.appendChild(x);
            }
            sq.appendChild(c);
        }
        b.appendChild(sq);
    });
}

function handleSq(i) {
    if(!isLive) return;
    const free = document.getElementById('free-move').checked;
    if(sel === null) {
        if(store.board[i] && (free || store.board[i].endsWith('_' + turn))) {
            sel = i; renderBoard();
            document.getElementById('board').children[i].style.boxShadow = "inset 0 0 15px var(--accent)";
        }
    } else {
        if (sel === i) { sel = null; renderBoard(); return; }
        if (store.board[i] && store.board[i].endsWith(store.board[sel].slice(-2))) { sel = i; renderBoard(); return; }
        
        if (store.board[i]) { pending = {f: sel, t: i}; openArena(); }
        else { 
            store.board[i] = store.board[sel]; 
            store.board[sel] = null; 
            if(!free) nextTurn(); else { sel=null; renderBoard(); save(); } 
        }
    }
}

function openArena() {
    const idA = store.board[pending.f]; // Peça que moveu (Atacante)
    const idD = store.board[pending.t]; // Peça que estava no local (Defensor)
    
    // Identifica quem é o Branco (B) e quem é o Preto (P)
    const pecaB = idA.endsWith('_B') ? idA : idD;
    const pecaP = idA.endsWith('_P') ? idA : idD;

    const dataB = store.p[pecaB];
    const dataP = store.p[pecaP];

    // --- LADO BRANCO (ESQUERDA) ---
    const divB = document.getElementById('a-img');
    divB.innerHTML = ''; // Limpa conteúdo anterior
    if (dataB?.img) {
        divB.style.backgroundImage = `url(${dataB.img})`;
    } else {
        divB.style.backgroundImage = 'none';
        divB.innerHTML = `<div class="no-img-arena" style="background:#fff; color:#000;">${dataB?.name || pecaB.split('_')[0]}</div>`;
    }

    // --- LADO PRETO/VERMELHO (DIREITA) ---
    const divP = document.getElementById('d-img');
    divP.innerHTML = ''; // Limpa conteúdo anterior
    if (dataP?.img) {
        divP.style.backgroundImage = `url(${dataP.img})`;
    } else {
        divP.style.backgroundImage = 'none';
        divP.innerHTML = `<div class="no-img-arena" style="background:var(--danger); color:#fff;">${dataP?.name || pecaP.split('_')[0]}</div>`;
    }

    // Áudios (Toca o som de quem ATACA)
    audioAtk.src = store.p[idA]?.snd || ""; 
    audioDef.src = store.p[idD]?.snd || "";
    
    if(audioAtk.src) audioAtk.play();

    document.getElementById('arena').style.display = 'flex';
}
function renderConfigLists() {
    ['white','black'].forEach(s => {
        const team = s==='white'?'B':'P', cont = document.getElementById('list-'+s);
        cont.innerHTML = `<h3>${s.toUpperCase()}</h3>`;
        [...nobres, ...peoes].forEach(p => {
            const id = `${p}_${team}`; 
            if(!store.p[id]) store.p[id] = {vol: 0.7, name: ''};
            const d = document.createElement('div'); d.className = 'unit-card';
            d.innerHTML = `
                <div style="display:flex; justify-content:space-between; margin-bottom:5px">
                    <b>${id}</b>
                    <input type="text" placeholder="Nome" value="${store.p[id].name || ''}" 
                        onchange="store.p['${id}'].name=this.value; save(); renderBoard();" class="name-input">
                </div>
                IMG: <input type="file" onchange="upPiece('${id}','img',this)">
                SOM: <input type="file" onchange="upPiece('${id}','snd',this)">
                VOL: <input type="range" min="0" max="1" step="0.1" value="${store.p[id].vol}" oninput="store.p['${id}'].vol=parseFloat(this.value);save()">`;
            cont.appendChild(d);
        });
    });
}

function upPiece(id, t, i) {
    const r = new FileReader(); 
    r.onload = e => { store.p[id][t] = e.target.result; save(); renderBoard(); };
    r.readAsDataURL(i.files[0]);
}

function upAvatar(s, i) {
    const r = new FileReader(); 
    r.onload = e => { store.g['avatar'+s] = e.target.result; save(); updateUI(); };
    r.readAsDataURL(i.files[0]);
}

function upAmb(type, input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        store.g['snd' + type] = e.target.result;
        ambientAudios[type].src = e.target.result;
        save();
    };
    reader.readAsDataURL(file);
}

function nextTurn() { turn = turn==='B'?'P':'B'; sel=null; renderBoard(); updateUI(); save(); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function startBattle() { isLive=true; toggleMenu(); updateUI(); }
function closeArena() { document.getElementById('arena').style.display='none'; sel=null; renderBoard(); }

function showTab(t) { 
    ['white','black','sys'].forEach(id => document.getElementById('list-'+id).style.display = (id===t?'block':'none'));
    ['t-white','t-black','t-sys'].forEach(id => document.getElementById(id).className = (id==='t-'+t?'active':''));
}

function updateUI() {
    document.getElementById('score-B').innerText = store.g.killsB; 
    document.getElementById('score-P').innerText = store.g.killsP;
    document.getElementById('img-B').style.backgroundImage = `url(${store.g.avatarB})`; 
    document.getElementById('img-P').style.backgroundImage = `url(${store.g.avatarP})`;
    document.getElementById('card-B').className = 'player-card' + (turn==='B'&&isLive?' active-B':'');
    document.getElementById('card-P').className = 'player-card' + (turn==='P'&&isLive?' active-P':'');
}

function save() { if(db) db.transaction("assets","readwrite").objectStore("assets").put(store,"all"); }

function resetGame() { 
    if(confirm("Reset total?")) { 
        store = { p: {}, g: {killsB:0, killsP:0}, board: getInitialBoard() }; 
        save(); location.reload(); 
    } 
}

window.addEventListener("load", () => setTimeout(() => document.getElementById("loader").classList.add("loader-hidden"), 2000));

// --- FUNÇÕES DE MENU E SISTEMA (ELECTRON) ---

function startGame() {
    const menu = document.getElementById('main-menu');
    if (menu) {
        menu.style.display = 'none';
        isLive = true; 
        updateUI();
        console.log("Duelo Iniciado!");
    }
}

function openOptions() {
    const modal = document.getElementById('options-modal');
    if (modal) modal.style.display = 'flex';
}

function closeOptions() {
    const modal = document.getElementById('options-modal');
    if (modal) modal.style.display = 'none';
}

function applySettings() {
    const res = document.getElementById('res-select').value;
    if (res === 'fullscreen') {
        ipcRenderer.send('toggle-fullscreen');
    } else {
        const [width, height] = res.split('x').map(Number);
        ipcRenderer.send('resize-window', { width, height });
    }
    closeOptions();
}

function toggleFullScreen() {
    ipcRenderer.send('toggle-fullscreen');
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'F11') {
        e.preventDefault();
        toggleFullScreen();
    }
});