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
const playbackFadeIntervals = new WeakMap();
let pieceSoundAudios = {};
let piecePlayback = {};
let arenaAudios = { left: null, right: null };
let arenaPlayback = { left: null, right: null };
let audioContext = null;
let isLive = false, turn = 'B', sel = null, pending = null, gySel = null;
const themeOptions = ['default','forest','fire','ice'];
let lastCapturePos = null;

// Anime-themed SVG presets (encoded at runtime)
const wallpaperSVGS = {
    preset1: `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>
            <defs>
                <linearGradient id='g1' x1='0' x2='0' y1='0' y2='1'>
                    <stop offset='0' stop-color='%23ffd1e6'/>
                    <stop offset='1' stop-color='%23ff9ac1'/>
                </linearGradient>
            </defs>
            <rect width='100%' height='100%' fill='url(%23g1)' />
            <g fill='%23fff' opacity='0.8'>
                <ellipse cx='260' cy='200' rx='70' ry='40' />
                <ellipse cx='520' cy='120' rx='48' ry='30' />
                <ellipse cx='1100' cy='300' rx='38' ry='24' />
            </g>
            <g fill='%23fff' opacity='0.6' transform='translate(100,500)'>
                <path d='M0,0 C40,-20 80,-20 120,0 C80,20 40,20 0,0 Z' />
                <path d='M160,0 C200,-24 240,-24 280,0 C240,24 200,24 160,0 Z' transform='translate(120,-10)' />
            </g>
        </svg>
    `,
    preset2: `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>
            <defs>
                <linearGradient id='g2' x1='0' x2='0' y1='0' y2='1'>
                    <stop offset='0' stop-color='%2300182b' />
                    <stop offset='1' stop-color='%23001218' />
                </linearGradient>
            </defs>
            <rect width='100%' height='100%' fill='url(%23g2)' />
            <g fill='%23ff6ef3' opacity='0.06'>
                <rect x='0' y='300' width='1600' height='180' />
            </g>
            <g fill='%23000' transform='translate(0,380)'>
                <rect x='40' y='40' width='80' height='180' />
                <rect x='160' y='80' width='120' height='140' />
                <rect x='320' y='20' width='200' height='200' />
                <rect x='580' y='60' width='140' height='160' />
                <rect x='760' y='30' width='160' height='190' />
                <rect x='980' y='90' width='120' height='120' />
                <rect x='1160' y='40' width='180' height='170' />
            </g>
            <circle cx='1200' cy='200' r='80' fill='%23ffbf69' opacity='0.9' />
        </svg>
    `,
    preset3: `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>
            <defs>
                <linearGradient id='g3' x1='0' x2='0' y1='0' y2='1'>
                    <stop offset='0' stop-color='%23cfe9ff'/>
                    <stop offset='1' stop-color='%23e8f7ff'/>
                </linearGradient>
            </defs>
            <rect width='100%' height='100%' fill='url(%23g3)' />
            <g fill='%23fff' opacity='0.9'>
                <ellipse cx='300' cy='200' rx='180' ry='60' />
                <ellipse cx='520' cy='220' rx='140' ry='48' />
                <ellipse cx='980' cy='180' rx='200' ry='70' />
            </g>
            <g fill='%23ffd1e6' opacity='0.6'>
                <circle cx='1300' cy='140' r='8' />
                <circle cx='1350' cy='200' r='6' />
                <circle cx='1220' cy='240' r='5' />
            </g>
        </svg>
    `,
    preset4: `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900'>
            <defs>
                <linearGradient id='g4' x1='0' x2='0' y1='0' y2='1'>
                    <stop offset='0' stop-color='%23ffb37a'/>
                    <stop offset='1' stop-color='%23ff7aa3'/>
                </linearGradient>
            </defs>
            <rect width='100%' height='100%' fill='url(%23g4)' />
            <g fill='%2300182b' opacity='0.9'>
                <rect x='0' y='520' width='1600' height='380' />
            </g>
            <circle cx='800' cy='380' r='120' fill='%23ffd166' opacity='0.95' />
            <g fill='%23000000' opacity='0.08'>
                <rect x='0' y='370' width='1600' height='6' />
                <rect x='0' y='390' width='1600' height='6' />
                <rect x='0' y='410' width='1600' height='6' />
            </g>
        </svg>
    `
};

function presetDataUrl(key) { return 'data:image/svg+xml;utf8,' + encodeURIComponent(wallpaperSVGS[key] || ''); }

const req = indexedDB.open("WarEngine_v33_2", 1);
req.onupgradeneeded = e => e.target.result.createObjectStore("assets");
req.onsuccess = e => { db = e.target.result; loadData(); };

function loadData() {
    db.transaction("assets").objectStore("assets").get("all").onsuccess = e => {
        if(e.target.result) store = e.target.result;
        if(!store.board) store.board = getInitialBoard();
        if(!store.graveyard) store.graveyard = [];
        if(!store.g.zoomBoard) store.g.zoomBoard = 1;
        if(!store.g.theme) store.g.theme = 'default';
        if(!store.g.mode) store.g.mode = 'LOCAL';
        if(!store.g.aiSide) store.g.aiSide = 'P';
        if(!store.g.aiDiff) store.g.aiDiff = 'normal';
        if (store.g.enPassant === undefined) store.g.enPassant = null;
        if (!store.g.hasMoved) store.g.hasMoved = { B: {K:false, Rk:false, Rq:false}, P: {K:false, Rk:false, Rq:false} };
        if (store.g.wallpaper === undefined) store.g.wallpaper = null;
        applyTheme(store.g.theme);
        if (!store.g.wallpaper) randomWallpaperPreset(true);
        applyWallpaper(store.g.wallpaper);
        populateWallpaperThumbnails();
        renderBoard(); renderGraveyard(); updateUI(); renderConfigLists(); setupAmbientUI(); updateBoardZoom(store.g.zoomBoard);
    };
}

function setMode(m) {
    if (!m) m = 'LOCAL';
    store.g.mode = m;
    const aiOpts = document.getElementById('ai-options');
    if (aiOpts) aiOpts.style.display = (m === 'AI') ? 'flex' : 'none';
    save();
}

function setAISide(s) {
    if (!s) s = 'P';
    store.g.aiSide = s;
    save();
}

function getAllLegalMoves(color) {
    const moves = [];
    store.board.forEach((id, from) => {
        if (!id || !id.endsWith('_' + color)) return;
        for (let to = 0; to < 64; to++) {
            if (from === to) continue;
            if (isLegalMove(from, to)) {
                moves.push({ from, to, capture: !!store.board[to] });
            }
        }
    });
    return moves;
}

function aiChooseMove(color) {
    const moves = getAllLegalMoves(color);
    if (!moves || moves.length === 0) return null;
    const diff = document.getElementById('ai-diff')?.value || store.g.aiDiff || 'normal';
    if (diff === 'easy') {
        return moves[Math.floor(Math.random() * moves.length)];
    }
    // normal: prefer captures, otherwise random
    const captures = moves.filter(m => m.capture);
    if (captures.length) return captures[Math.floor(Math.random() * captures.length)];
    return moves[Math.floor(Math.random() * moves.length)];
}

function aiMakeMove() {
    const aiSide = store.g.aiSide || 'P';
    const move = aiChooseMove(aiSide);
    if (!move) { nextTurn(); return; }
    const { from, to } = move;
    executeMove(from, to);
}

function executeMove(from, to, opts = {}) {
    // opts: {silent:false}
    const mover = store.board[from];
    if (!mover) return;
    const clonedHasMoved = store.g.hasMoved || { B:{K:false,Rk:false,Rq:false}, P:{K:false,Rk:false,Rq:false} };
    const res = applyMoveToBoard(store.board, from, to, store.g.enPassant, clonedHasMoved);
    // commit
    store.board = res.board;
    if (res.captured) {
        store.graveyard.push(res.captured);
        lastCapturePos = to;
    }
    // update enPassant and hasMoved
    store.g.enPassant = res.enPassant || null;
    store.g.hasMoved = clonedHasMoved;
    save();
    renderBoard(); renderGraveyard();
    if (!opts.silent) playPieceSound(mover);
    setTimeout(() => playDefeatSound(), 120);
    const winner = checkForVictory();
    if (!winner) nextTurn();
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

function setTheme(theme) {
    if (!themeOptions.includes(theme)) theme = 'default';
    applyTheme(theme);
}

function applyTheme(theme) {
    if (!theme) theme = 'default';
    store.g.theme = theme;
    document.body.classList.remove('theme-default','theme-forest','theme-fire','theme-ice');
    document.body.classList.add('theme-' + theme);
    updateThemeSelectionUI();
    save();
}

function applyWallpaper(url) {
    if (url) {
        document.body.style.backgroundImage = `url(${url})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center center';
        document.body.style.backgroundRepeat = 'no-repeat';
    } else {
        document.body.style.backgroundImage = '';
    }
}

function upWallpaper(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = e => {
        store.g.wallpaper = e.target.result;
        applyWallpaper(store.g.wallpaper);
        save();
    };
    r.readAsDataURL(file);
}

function clearWallpaper() {
    store.g.wallpaper = null;
    applyWallpaper(null);
    save();
}

function setWallpaperPreset(urlOrKey) {
    if (!urlOrKey) return;
    let url = urlOrKey;
    if (urlOrKey === 'random') {
        randomWallpaperPreset();
        return;
    }
    if (wallpaperSVGS[urlOrKey]) url = presetDataUrl(urlOrKey);
    store.g.wallpaper = url;
    applyWallpaper(url);
    save();
}

function randomWallpaperPreset(setOnLoad = false) {
    const keys = Object.keys(wallpaperSVGS);
    const choice = keys[Math.floor(Math.random() * keys.length)];
    const url = presetDataUrl(choice);
    store.g.wallpaper = url;
    applyWallpaper(url);
    if (!setOnLoad) save();
}

function populateWallpaperThumbnails() {
    const presets = ['preset1','preset2','preset3','preset4'];
    presets.forEach((key, idx) => {
        const btn = document.getElementById('wp' + (idx + 1));
        if (!btn) return;
        btn.style.backgroundImage = `url(${presetDataUrl(key)})`;
        btn.style.backgroundColor = '#111';
        btn.style.color = '#fff';
        btn.innerText = `ANIME ${idx + 1}`;
    });
}

function updateThemeSelectionUI() {
    document.querySelectorAll('.theme-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.theme === store.g.theme);
    });
}

function getCoord(index) { return { row: Math.floor(index / 8), col: index % 8 }; }
function isSameColor(idA, idB) { return idA && idB && idA.slice(-2) === idB.slice(-2); }
function pathClear(from, to) {
    const start = getCoord(from);
    const end = getCoord(to);
    const dr = end.row - start.row;
    const dc = end.col - start.col;
    const stepR = Math.sign(dr);
    const stepC = Math.sign(dc);
    if (stepR === 0 && stepC === 0) return false;
    if (stepR !== 0 && stepC !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
    let row = start.row + stepR;
    let col = start.col + stepC;
    while (row !== end.row || col !== end.col) {
        if (store.board[row * 8 + col]) return false;
        row += stepR;
        col += stepC;
    }
    return true;
}
function isMoveValid(from, to) {
    const id = store.board[from];
    if (!id || from === to) return false;
    const target = store.board[to];
    if (target && isSameColor(id, target)) return false;

    const source = getCoord(from);
    const dest = getCoord(to);
    const dr = dest.row - source.row;
    const dc = dest.col - source.col;
    const absdr = Math.abs(dr);
    const absdc = Math.abs(dc);
    const color = id.endsWith('_B') ? 'B' : 'P';
    const direction = color === 'B' ? -1 : 1;
    const type = id.charAt(0);

    switch (type) {
        case 'P':
            if (dc === 0 && dr === direction && !target) return true;
            if (dc === 0 && dr === direction * 2 && ((color === 'B' && source.row === 1) || (color === 'P' && source.row === 6)) && !target && !store.board[from + direction * 8]) return true;
            // capture or en-passant
            if (Math.abs(dc) === 1 && dr === direction && target) return true;
            if (Math.abs(dc) === 1 && dr === direction && !target && store.g && store.g.enPassant === to) return true;
            return false;
        case 'T':
            return (dr === 0 || dc === 0) && (absdr + absdc > 0) && pathClear(from, to);
        case 'B':
            return absdr === absdc && absdr > 0 && pathClear(from, to);
        case 'Q':
            return (dr === 0 || dc === 0 || absdr === absdc) && (absdr + absdc > 0) && pathClear(from, to);
        case 'K':
            return Math.max(absdr, absdc) === 1;
        case 'C':
            return (absdr === 2 && absdc === 1) || (absdr === 1 && absdc === 2);
        default:
            return true;
    }
}

function cloneBoard(b) { return b.slice(); }

function isSquareAttacked(square, byColor, boardState) {
    const board = boardState || store.board;
    for (let i = 0; i < 64; i++) {
        const id = board[i];
        if (!id || !id.endsWith('_' + byColor)) continue;
        const type = id.charAt(0);
        const src = getCoord(i);
        const dst = getCoord(square);
        const dr = dst.row - src.row;
        const dc = dst.col - src.col;
        const absdr = Math.abs(dr);
        const absdc = Math.abs(dc);
        switch (type) {
            case 'P': {
                const direction = byColor === 'B' ? -1 : 1;
                if (dr === direction && Math.abs(dc) === 1) return true;
                break;
            }
            case 'T':
                if ((dr === 0 || dc === 0) && pathClearOnBoard(i, square, board)) return true;
                break;
            case 'B':
                if (absdr === absdc && pathClearOnBoard(i, square, board)) return true;
                break;
            case 'Q':
                if ((dr === 0 || dc === 0 || absdr === absdc) && pathClearOnBoard(i, square, board)) return true;
                break;
            case 'K':
                if (Math.max(absdr, absdc) === 1) return true;
                break;
            case 'C':
                if ((absdr === 2 && absdc === 1) || (absdr === 1 && absdc === 2)) return true;
                break;
        }
    }
    return false;
}

    function pathClearOnBoard(from, to, boardState) {
        const board = boardState || store.board;
        const start = getCoord(from);
        const end = getCoord(to);
        const dr = end.row - start.row;
        const dc = end.col - start.col;
        const stepR = Math.sign(dr);
        const stepC = Math.sign(dc);
        if (stepR === 0 && stepC === 0) return false;
        if (stepR !== 0 && stepC !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
        let row = start.row + stepR;
        let col = start.col + stepC;
        while (row !== end.row || col !== end.col) {
            if (board[row * 8 + col]) return false;
            row += stepR;
            col += stepC;
        }
        return true;
    }

function findKingIndex(color, boardState) {
    const board = boardState || store.board;
    for (let i = 0; i < 64; i++) {
        const id = board[i];
        if (id && id.charAt(0) === 'K' && id.endsWith('_' + color)) return i;
    }
    return -1;
}

function isKingInCheck(color, boardState) {
    const kingIdx = findKingIndex(color, boardState);
    if (kingIdx < 0) return true;
    const enemy = color === 'B' ? 'P' : 'B';
    return isSquareAttacked(kingIdx, enemy, boardState);
}

function applyMoveToBoard(board, from, to, enPassantTarget, hasMovedObj) {
    const nb = cloneBoard(board);
    const mover = nb[from];
    const src = getCoord(from);
    const dst = getCoord(to);
    const dr = dst.row - src.row;
    const dc = dst.col - src.col;
    const color = mover?.endsWith('_B') ? 'B' : 'P';
    const direction = color === 'B' ? -1 : 1;
    let captured = null;
    let newEnPassant = null;

    // en-passant capture
    if (mover && mover.charAt(0) === 'P' && Math.abs(dc) === 1 && dr === direction && !nb[to] && enPassantTarget === to) {
        const capIdx = to - direction * 8;
        captured = nb[capIdx];
        nb[capIdx] = null;
    }

    // normal capture
    if (nb[to]) { captured = nb[to]; }

    // move
    nb[to] = nb[from]; nb[from] = null;

    // double pawn move => set en-passant target
    if (mover && mover.charAt(0) === 'P' && Math.abs(dr) === 2) {
        newEnPassant = from + direction * 8;
    }

    // promotion: auto to Queen
    if (mover && mover.charAt(0) === 'P') {
        if ((color === 'P' && dst.row === 0) || (color === 'B' && dst.row === 7)) {
            // replace leading char P with Q
            nb[to] = 'Q' + nb[to].slice(1);
        }
    }

    // castling: king moves two squares
    if (mover && mover.charAt(0) === 'K' && Math.abs(dc) === 2) {
        // king side or queen side
        const row = src.row;
        if (dc === 2) {
            // king-side rook: move from col 7 to col 5
            const rookFrom = row * 8 + 7;
            const rookTo = row * 8 + 5;
            nb[rookTo] = nb[rookFrom]; nb[rookFrom] = null;
        } else if (dc === -2) {
            const rookFrom = row * 8 + 0;
            const rookTo = row * 8 + 3;
            nb[rookTo] = nb[rookFrom]; nb[rookFrom] = null;
        }
    }

    // update hasMovedObj if provided
    if (hasMovedObj && mover) {
        const t = mover.charAt(0);
        if (t === 'K') hasMovedObj[color].K = true;
        if (t === 'T') {
            // determine rook side by column of original 'from'
            const col = src.col;
            if (col === 0) hasMovedObj[color].Rq = true;
            if (col === 7) hasMovedObj[color].Rk = true;
        }
    }

    return { board: nb, captured, enPassant: newEnPassant };
}

function isLegalMove(from, to) {
    // basic pseudo-legal movement
    if (!isMoveValid(from, to)) return false;
    // simulate move and check king safety
    const clonedHasMoved = JSON.parse(JSON.stringify(store.g.hasMoved || { B:{K:false,Rk:false,Rq:false}, P:{K:false,Rk:false,Rq:false} }));
    const res = applyMoveToBoard(store.board, from, to, store.g.enPassant, clonedHasMoved);
    // if castling, we must also ensure squares passed are not attacked
    const mover = store.board[from];
    if (mover && mover.charAt(0) === 'K') {
        const src = getCoord(from);
        const dst = getCoord(to);
        const step = dst.col > src.col ? 1 : -1;
        // check each square king passes (including destination) not attacked
        for (let c = src.col; c !== dst.col + step; c += step) {
            const idx = src.row * 8 + c;
            if (isSquareAttacked(idx, mover.endsWith('_B') ? 'P' : 'B', res.board)) return false;
        }
    }
    // finally check resulting board king not in check
    return !isKingInCheck(mover?.endsWith('_B') ? 'B' : 'P', res.board);
}
function showWrongSideModal() {
    const modal = document.createElement('div');
    modal.id = 'wrong-side-modal';
    modal.style = "position:fixed; inset:0; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:6000;";
    modal.innerHTML = `
        <div style="background:#0b0b0d; padding:24px; border-radius:8px; border:1px solid #222; text-align:center; width:320px;">
            <h3 style="color:var(--danger); margin-bottom:8px;">Lado errado</h3>
            <p style="color:#ccc; font-size:14px; margin-bottom:16px;">Esta peça só pode se mover na direção oposta. Verifique a orientação e tente novamente.</p>
            <button id="wrong-side-ok" class="btn btn-yes" style="width:100%;">ENTENDI</button>
        </div>
    `;
    document.body.appendChild(modal);
    document.getElementById('wrong-side-ok').onclick = () => { modal.remove(); };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function showInvalidMove(id) {
    const name = store.p[id]?.name || id?.split('_')[0] || 'Peça';
    alert(`Movimento inválido para ${name}. Escolha um caminho válido ou altere para Movimento Livre.`);
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
    if (gySel !== null) {
        if (!store.board[i]) {
            store.board[i] = store.graveyard[gySel];
            store.graveyard.splice(gySel, 1);
            gySel = null;
            renderBoard(); renderGraveyard(); save();
        }
        return;
    }
    if (document.getElementById('edit-mode').checked) return;
    if (!isLive) return;

    // If AI mode and it's AI's turn, block user interactions
    if (store.g.mode === 'AI' && turn === store.g.aiSide) return;

    const free = document.getElementById('free-move').checked;
    if (sel === null) {
        const id = store.board[i];
        // Prevent selecting AI-controlled pieces when playing vs AI
        if (id && (free || id.endsWith('_' + turn)) && !(store.g.mode === 'AI' && id.endsWith('_' + store.g.aiSide))) {
            sel = i;
            showUnitID(id, () => {
                renderBoard();
                const sq = document.getElementById('board').children[i];
                if (sq) sq.style.boxShadow = "inset 0 0 15px #00f2ff";
            });
        }
        return;
    }

    if (sel === i) {
        sel = null;
        renderBoard();
        return;
    }

    const fromId = store.board[sel];
    const toId = store.board[i];

    if (toId && isSameColor(fromId, toId)) {
        sel = i;
        showUnitID(toId, () => { renderBoard(); });
        return;
    }

    if (!free && !isMoveValid(sel, i)) {
        const type = fromId?.charAt(0);
        if (type === 'P') {
            const src = getCoord(sel);
            const dst = getCoord(i);
            const dr = dst.row - src.row;
            const color = fromId.endsWith('_B') ? 'B' : 'P';
            const direction = color === 'B' ? -1 : 1;
            if (dr * direction < 0) {
                showWrongSideModal();
                return;
            }
        }
        showInvalidMove(fromId);
        return;
    }

    if (toId) {
        // If playing vs AI and opponent is AI, resolve capture immediately
        if (store.g.mode === 'AI') {
            const aiSide = store.g.aiSide;
            const targetSide = toId.endsWith('_' + aiSide) ? aiSide : (toId.endsWith('_' + (aiSide==='B'?'P':'B')) ? (aiSide==='B'?'P':'B') : null);
            // If the captured piece belongs to the AI, auto-resolve
            if (targetSide && targetSide === store.g.aiSide) {
                executeMove(sel, i);
                return;
            }
        }
        pending = { f: sel, t: i };
        openArena();
    } else {
        if (!free) {
            executeMove(sel, i);
        } else {
            store.board[i] = fromId;
            store.board[sel] = null;
            sel = null; renderBoard(); save();
        }
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

    arenaAudios.left = getPieceAudio(idA);
    arenaAudios.right = getPieceAudio(idD);

    const btnLeft = document.getElementById('btn-play-L');
    const btnRight = document.getElementById('btn-play-R');
    const statusLeft = document.getElementById('sound-status-L');
    const statusRight = document.getElementById('sound-status-R');
    const hasSoundA = !!store.p[idA]?.sound;
    const hasSoundD = !!store.p[idD]?.sound;

    btnLeft?.classList.add('sound-active');
    btnRight?.classList.add('sound-active');
    if (statusLeft) statusLeft.innerText = hasSoundA ? 'Som personalizado 🎵' : 'Som padrão 🎧';
    if (statusRight) statusRight.innerText = hasSoundD ? 'Som personalizado 🎵' : 'Som padrão 🎧';
    if (btnLeft) btnLeft.title = hasSoundA ? 'Tocar som personalizado da peça atacante' : 'Tocar som padrão da peça atacante';
    if (btnRight) btnRight.title = hasSoundD ? 'Tocar som personalizado da peça defensora' : 'Tocar som padrão da peça defensora';

    document.getElementById('arena').style.display = 'flex';
}

function finishDuel(v) {
    const idA = store.board[pending.f], idD = store.board[pending.t];
    const corA = idA.endsWith('_B') ? 'B' : 'P';
    if (v === 'B') store.g.killsB++;
    else store.g.killsP++;
    const winnerId = (v === corA) ? idA : idD;
    if (v === corA) {
        // attacker venceu: executar movimento normalmente (respeita promo/en-passant/roque)
        executeMove(pending.f, pending.t);
        document.getElementById('arena').style.display='none';
        return;
    } else {
        lastCapturePos = pending.f;
        store.graveyard.push(idA);
        store.board[pending.f] = null;
    }
    if (winnerId) playPieceSound(winnerId);
    setTimeout(() => playDefeatSound(), 120);
    document.getElementById('arena').style.display='none';
    renderGraveyard();
    // Verifica vitória após a captura
    const winner = checkForVictory();
    if (!winner) nextTurn();
}

function syncTrackVolume(type) {
    if (fadeIntervals[type]) return; 
    ambientAudios[type].volume = parseFloat(document.getElementById(`vol-${type}`)?.value || 0.7) * parseFloat(document.getElementById('v-master').value);
}
function updateMasterVolume() { Object.keys(ambientAudios).forEach(t => syncTrackVolume(t)); }

function updateBoardZoom(value) {
    const zoom = parseFloat(value) || 1;
    store.g.zoomBoard = zoom;
    const wrapper = document.querySelector('.board-wrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${zoom})`;
        wrapper.style.transformOrigin = 'center center';
    }

    const graveyard = document.querySelector('.graveyard-container');
    if (graveyard && wrapper) {
        const baseWidth = wrapper.clientWidth;
        const extraSpace = Math.max(0, (baseWidth * zoom - baseWidth) / 2);
        graveyard.style.marginLeft = `${20 + extraSpace}px`;
    }

    const slider = document.getElementById('board-zoom');
    if (slider) slider.value = zoom;
    save();
}

function playWithFade(type) {
    Object.keys(ambientAudios).forEach((t) => {
        if (t !== type && ambientAudios[t] && !ambientAudios[t].paused) {
            stopWithFade(t);
        }
    });

    const a = ambientAudios[type];
    const target = parseFloat(document.getElementById(`vol-${type}`)?.value || 0.7) * parseFloat(document.getElementById('v-master').value);
    if (fadeIntervals[type]) clearInterval(fadeIntervals[type]);
    a.volume = Math.max(a.volume || 0, 0);
    a.play().catch(() => {});
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

function ensureAudioContext() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return audioContext;
}

function getPieceAudio(id) {
    if (!store.p[id]?.sound) return null;
    if (!pieceSoundAudios[id]) pieceSoundAudios[id] = new Audio(store.p[id].sound);
    else if (pieceSoundAudios[id].src !== store.p[id].sound) pieceSoundAudios[id].src = store.p[id].sound;
    pieceSoundAudios[id].loop = false;
    const master = parseFloat(document.getElementById('v-master')?.value || 1);
    const pieceVol = parseFloat(store.p[id]?.volume ?? 0.8);
    pieceSoundAudios[id].volume = master * pieceVol;
    return pieceSoundAudios[id];
}

function playDefaultPieceSound(id) {
    const freqs = { P: 440, T: 330, C: 392, B: 523, Q: 587, K: 261 };
    const ctx = ensureAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freqs[id?.charAt(0)] || 380;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
}

function playDefeatSound() {
    const ctx = ensureAudioContext();
    const gain = ctx.createGain();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.value = 260;
    osc2.frequency.value = 180;
    gain.gain.value = 0.15;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.3);
    osc2.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.stop(ctx.currentTime + 0.3);
    osc2.stop(ctx.currentTime + 0.3);
}

function fadeOutAudioElement(audio, duration = 300, callback) {
    if (!audio || typeof audio.volume !== 'number') {
        if (typeof callback === 'function') callback();
        return;
    }
    const currentVolume = audio.volume;
    const stepTime = 30;
    const steps = Math.max(1, Math.round(duration / stepTime));
    const stepAmount = currentVolume / steps;
    if (playbackFadeIntervals.has(audio)) {
        clearInterval(playbackFadeIntervals.get(audio));
        playbackFadeIntervals.delete(audio);
    }

    let count = 0;
    const interval = setInterval(() => {
        count += 1;
        audio.volume = Math.max(0, audio.volume - stepAmount);
        if (count >= steps || audio.volume <= 0.01) {
            clearInterval(interval);
            playbackFadeIntervals.delete(audio);
            try { audio.pause(); } catch (err) {}
            audio.volume = 0;
            if (typeof callback === 'function') callback();
        }
    }, stepTime);
    playbackFadeIntervals.set(audio, interval);
}

function fadeOutPlayback(playback, callback) {
    if (!playback) {
        if (typeof callback === 'function') callback();
        return;
    }
    if (playback.oscillators) {
        try { playback.stop(); } catch (err) {}
        if (typeof callback === 'function') callback();
        return;
    }
    if (playback instanceof Audio || typeof playback.pause === 'function') {
        fadeOutAudioElement(playback, 300, callback);
        return;
    }
    if (typeof callback === 'function') callback();
}

function playPieceSound(id) {
    if (!id) return;
    const audio = getPieceAudio(id);
    if (audio) {
        try {
            audio.currentTime = 0;
            audio.volume = parseFloat(document.getElementById('v-master')?.value || 1) * 0.9;
            audio.play().catch(() => {});
        } catch (err) {}
    } else {
        playDefaultPieceSound(id);
    }
}

function stopArenaPlayback(side, fade = false) {
    const playback = arenaPlayback[side];
    if (!playback) return;
    const clearPlayback = () => { arenaPlayback[side] = null; };
    if (fade) {
        fadeOutPlayback(playback, clearPlayback);
    } else {
        if (typeof playback.pause === 'function') {
            try { playback.pause(); } catch (err) {}
        }
        if (typeof playback.stop === 'function') {
            try { playback.stop(); } catch (err) {}
        }
        if (playback.oscillators) {
            playback.oscillators.forEach(o => { try { o.stop(); } catch (err) {} });
        }
        clearPlayback();
    }
}

function stopPiecePlayback(id, fade = false) {
    const playback = piecePlayback[id];
    if (!playback) return;
    const clearPlayback = () => { piecePlayback[id] = null; };
    if (fade) {
        fadeOutPlayback(playback, clearPlayback);
    } else {
        if (typeof playback.pause === 'function') {
            try { playback.pause(); } catch (err) {}
        }
        if (typeof playback.stop === 'function') {
            try { playback.stop(); } catch (err) {}
        }
        if (playback.oscillators) {
            playback.oscillators.forEach(o => { try { o.stop(); } catch (err) {} });
        }
        clearPlayback();
    }
}

function createDefaultPiecePlayback(id) {
    const ctx = ensureAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.value = 440;
    osc2.frequency.value = 330;
    gain.gain.value = 0.08;
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(165, ctx.currentTime + 0.2);
    const stop = () => {
        try {
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
            osc1.stop(ctx.currentTime + 0.05);
            osc2.stop(ctx.currentTime + 0.05);
        } catch (err) {}
    };
    return { stop, oscillators: [osc1, osc2] };
}

function playArenaPiece(side) {
    const id = side === 'left' ? store.board[pending?.f] : store.board[pending?.t];
    const otherSide = side === 'left' ? 'right' : 'left';
    stopArenaPlayback(otherSide, true);
    stopArenaPlayback(side, false);
    const audio = side === 'left' ? arenaAudios.left : arenaAudios.right;
    if (audio) {
        try {
            audio.currentTime = 0;
            audio.volume = parseFloat(document.getElementById('v-master')?.value || 1);
            audio.play().catch(() => {});
        } catch (err) {}
        arenaPlayback[side] = audio;
    } else if (id) {
        arenaPlayback[side] = createDefaultPiecePlayback(id);
    }
}

function pauseArenaPiece(side) {
    stopArenaPlayback(side, true);
}

function playPiecePreview(id) {
    Object.keys(piecePlayback).forEach(key => {
        if (key !== id) stopPiecePlayback(key, true);
    });
    stopPiecePlayback(id);
    const audio = getPieceAudio(id);
    if (audio) {
        try {
            audio.currentTime = 0;
            audio.volume = parseFloat(document.getElementById('v-master')?.value || 1) * 0.8;
            audio.play().catch(() => {});
        } catch (err) {}
        piecePlayback[id] = audio;
    } else {
        piecePlayback[id] = createDefaultPiecePlayback(id);
    }
}

function pausePiecePreview(id) {
    stopPiecePlayback(id, true);
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
    sel = null; 
    renderBoard(); 
    updateUI();
    save(); 
    // Se modo AI e é vez da IA, executar jogada automática
    if (store.g.mode === 'AI' && turn === store.g.aiSide) {
        setTimeout(() => aiMakeMove(), 600);
    }
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
    // Checa vitória sempre que o cemitério é atualizado
    checkForVictory();
}

function showVictoryModal(winner) {
    if (!winner) return;
    isLive = false;
    const photoEl = document.getElementById('victory-photo');
    const nameEl = document.getElementById('winner-name');
    const winModal = document.getElementById('victory-modal');
    if (winner === 'DRAW') {
        if (photoEl) photoEl.style.backgroundImage = '';
        if (nameEl) nameEl.innerText = `EMPATE!`;
    } else {
        const avatar = store.g['avatar' + winner] || '';
        const playerName = (document.getElementById('name-' + winner)?.value) || (winner === 'B' ? 'BRANCAS' : 'PRETAS');
        if (photoEl) photoEl.style.backgroundImage = avatar ? `url(${avatar})` : '';
        if (nameEl) nameEl.innerText = `${playerName} venceu!`;
    }
    // destaque da casa onde ocorreu a captura (xeque mate)
    try {
        const board = document.getElementById('board');
        if (board && typeof lastCapturePos === 'number' && board.children[lastCapturePos]) {
            board.children[lastCapturePos].classList.add('highlight-mate');
        }
    } catch (err) {}
    if (winModal) winModal.style.display = 'flex';
}

function clearMateHighlight() {
    try {
        const board = document.getElementById('board');
        if (!board) return;
        Array.from(board.children).forEach(ch => ch.classList.remove('highlight-mate'));
        lastCapturePos = null;
    } catch (err) {}
}

function newGame() {
    // Reinicia o estado do jogo sem recarregar
    store.board = getInitialBoard();
    store.graveyard = [];
    store.g.killsB = 0;
    store.g.killsP = 0;
    isLive = false;
    sel = null; pending = null; gySel = null;
    clearMateHighlight();
    save();
    renderBoard(); renderGraveyard(); updateUI();
    // fechar modal de vitória
    const winModal = document.getElementById('victory-modal');
    if (winModal) winModal.style.display = 'none';
    // abrir menu inicial
    const startMenu = document.getElementById('start-menu');
    if (startMenu) { startMenu.classList.add('show'); startMenu.style.display = 'flex'; }
}

function checkForVictory() {
    // Retorna 'B' ou 'P' se houver vencedor, 'DRAW' para empate, ou null
    const bPieces = store.board.filter(id => id && id.endsWith('_B')).length;
    const pPieces = store.board.filter(id => id && id.endsWith('_P')).length;
    const bKing = store.board.some(id => id && id.charAt(0) === 'K' && id.endsWith('_B'));
    const pKing = store.board.some(id => id && id.charAt(0) === 'K' && id.endsWith('_P'));

    if (!bKing || bPieces === 0) { showVictoryModal('P'); return 'P'; }
    if (!pKing || pPieces === 0) { showVictoryModal('B'); return 'B'; }

    // checkmate / stalemate detection: after a move, check opponent
    const opponent = turn === 'B' ? 'P' : 'B';
    const legal = getAllLegalMoves(opponent);
    if (legal.length === 0) {
        if (isKingInCheck(opponent)) {
            // opponent is checkmated -> current player (turn) wins
            const winner = turn;
            showVictoryModal(winner);
            return winner;
        } else {
            // stalemate
            showVictoryModal('DRAW');
            return 'DRAW';
        }
    }
    return null;
}

function renderConfigLists() {
    ['white','black'].forEach(s => {
        const team = s==='white'?'B':'P', cont = document.getElementById('list-'+s);
        cont.innerHTML = `<h3 style="font-size:11px; color:#555; margin:10px 0; letter-spacing:1px;">SQUAD_${s.toUpperCase()}</h3>`;
        [...nobres, ...peoes].forEach(p => {
            const id = `${p}_${team}`; 
            const currentName = store.p[id]?.name || id;
            const hasSound = !!store.p[id]?.sound;
            const volValue = store.p[id]?.volume ?? 0.8;
            const d = document.createElement('div'); 
            d.className = 'unit-card';
            d.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="width:25px; height:25px; background:url(${store.p[id]?.img || ''}) center/cover #111; border-radius:3px;"></div>
                    <input type="text" class="edit-piece-name-input" value="${currentName}" onchange="updatePieceName('${id}', this.value)" title="Editar nome visível">
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:4px; font-size:8px; color:#aaa;">
                    <span>ID: ${id}</span>
                    <span>${hasSound ? '🎵 ÁUDIO definido' : '🎧 Sem áudio'}</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px; gap:4px;">
                    <input type="file" accept="image/*" style="font-size:8px; width:75px;" onchange="upPiece('${id}',this)">
                    <input type="file" accept="audio/*" style="font-size:8px; width:75px;" onchange="upPieceSound('${id}',this)">
                </div>
                <div style="display:flex; align-items:center; gap:8px; margin-top:6px; font-size:10px;">
                    <label style="flex:1; color:#ccc;">Volume</label>
                    <input type="range" min="0" max="1" step="0.05" value="${volValue}" style="flex:2;" onchange="updatePieceVolume('${id}', this.value)">
                    <button class="btn" style="padding:6px 8px; font-size:10px;" onclick="playPiecePreview('${id}')">Tocar</button>
                    <button class="btn" style="padding:6px 8px; font-size:10px;" onclick="pausePiecePreview('${id}')">Pausar</button>
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
function upPieceSound(id, i) { const r = new FileReader(); r.onload = e => { if(!store.p[id]) store.p[id]={}; store.p[id].sound = e.target.result; if (pieceSoundAudios[id]) pieceSoundAudios[id].src = e.target.result; if (store.p[id].volume === undefined) store.p[id].volume = 0.8; save(); renderConfigLists(); }; r.readAsDataURL(i.files[0]); }
function updatePieceVolume(id, value) { if (!store.p[id]) store.p[id] = {}; store.p[id].volume = parseFloat(value); save(); renderConfigLists(); }
function upAvatar(s, i) { const r = new FileReader(); r.onload = e => { store.g['avatar'+s] = e.target.result; save(); updateUI(); }; r.readAsDataURL(i.files[0]); }
function showTab(t) { 
    ['white','black','sys'].forEach(id => document.getElementById('list-'+id).style.display = (id===t?'block':'none'));
    ['t-white','t-black','t-sys'].forEach(id => document.getElementById(id).className = (id==='t-'+t?'active':''));
}
function startBattle() {
    if (!store.g.theme) store.g.theme = 'default';
    applyTheme(store.g.theme);
    // read UI selections
    const opp = document.getElementById('opponent-select')?.value || store.g.mode || 'LOCAL';
    const aiSide = document.getElementById('ai-side')?.value || store.g.aiSide || 'P';
    const aiDiff = document.getElementById('ai-diff')?.value || store.g.aiDiff || 'normal';
    store.g.mode = opp; store.g.aiSide = aiSide; store.g.aiDiff = aiDiff;
    isLive = true;
    document.getElementById('sidebar').classList.remove('open');
    const startMenu = document.getElementById('start-menu');
    if (startMenu) {
        startMenu.classList.remove('show');
        startMenu.style.display = 'none';
    }
    updateUI();
    save();
    // If AI should start, schedule AI move
    if (store.g.mode === 'AI' && turn === store.g.aiSide) {
        setTimeout(() => aiMakeMove(), 600);
    }
}
function resetGame() { if(confirm("Deseja fazer o Reset total da aplicação?")) { indexedDB.deleteDatabase("WarEngine_v33_2"); location.reload(); } }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('open'); }
function closeArena() { 
    stopArenaPlayback('left');
    stopArenaPlayback('right');
    document.getElementById('arena').style.display='none'; 
    sel=null; 
    document.getElementById('btn-play-L')?.classList.remove('sound-active');
    document.getElementById('btn-play-R')?.classList.remove('sound-active');
    renderBoard(); 
}

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