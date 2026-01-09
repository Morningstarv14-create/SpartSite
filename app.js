const firebaseConfig = {
    apiKey: "AIzaSyBcldC1eivP_RlD7o3lTfFpNkEgO2j8WRo",
    authDomain: "spartans-clan-349f3.firebaseapp.com",
    projectId: "spartans-clan-349f3",
    storageBucket: "spartans-clan-349f3.firebasestorage.app",
    messagingSenderId: "275841977722",
    appId: "1:275841977722:web:7d8085db5f4e789d46dac3"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
let user = null;

// --- КАСТОМНЫЕ ОКНА ВМЕСТО СИСТЕМНЫХ ---

function notify(title, msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast animated';
    toast.innerHTML = `<b style="color:var(--red)">${title}</b><br><small>${msg}</small>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// Красивое окно подтверждения (вместо confirm)
function askSpartan(question, onConfirm) {
    const overlay = document.createElement('div');
    overlay.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:20000;backdrop-filter:blur(5px);";
    overlay.innerHTML = `
        <div class="auth-card animated" style="border:1px solid var(--red); max-width:300px;">
            <h3 style="color:var(--red); margin-bottom:15px;">РЕШЕНИЕ АДМИНА</h3>
            <p style="margin-bottom:20px; font-size:14px;">${question}</p>
            <div style="display:flex; gap:10px; justify-content:center;">
                <button id="confirm-yes" class="glow-button" style="padding:10px 20px;">ДА</button>
                <button id="confirm-no" style="background:none; border:1px solid #444; color:#fff; padding:10px 20px; border-radius:10px; cursor:pointer;">ОТМЕНА</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    
    overlay.querySelector('#confirm-yes').onclick = () => { onConfirm(); overlay.remove(); };
    overlay.querySelector('#confirm-no').onclick = () => { overlay.remove(); };
}

function showIdModal(newID) {
    const modal = document.createElement('div');
    modal.style = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:10000;text-align:center;padding:20px;";
    modal.innerHTML = `
        <div class="auth-card animated" style="border:2px solid var(--red); box-shadow: 0 0 25px rgba(255,0,0,0.3);">
            <div style="font-size:40px; color:var(--red); margin-bottom:10px;">Λ</div>
            <h1 style="color:var(--red); letter-spacing:2px;">ПРОФИЛЬ СОЗДАН</h1>
            <p style="color:#888;">Твой секретный ключ (ID):</p>
            <div style="font-size:32px; font-weight:bold; margin:25px 0; letter-spacing:8px; color:#fff; text-shadow:0 0 10px #fff;">${newID}</div>
            <p style="font-size:11px; color:#444; margin-bottom:20px;">ПЕРЕДАЧА ID ТРЕТЬИМ ЛИЦАМ ЗАПРЕЩЕНА</p>
            <button onclick="this.parentElement.parentElement.remove(); startApp();" class="glow-button" style="width:100%;">ВСТУПИТЬ В СТРОЙ</button>
        </div>`;
    document.body.appendChild(modal);
}

// --- ЛОГИКА ДОСТУПА ---

async function loginByID() {
    const idInput = document.getElementById('id-login-input');
    const inputID = idInput.value.trim().toUpperCase();
    if (!inputID) return notify("ВНИМАНИЕ", "Введите ID");
    try {
        const doc = await db.collection('users').doc(inputID).get();
        if (doc.exists) {
            user = doc.data(); user.id = inputID;
            if (user.nick.toLowerCase() === 'безликий' && user.role !== 'admin') return notify("ОТКАЗ", "Нарушение прав");
            startApp();
        } else notify("ОШИБКА", "ID не существует");
    } catch (e) { notify("ОШИБКА", "Сбой системы"); }
}

async function handleRegister() {
    const role = document.getElementById('role-select').value;
    const nick = document.getElementById('username-input').value.trim();
    const code = document.getElementById('code-input').value;
    if (!nick) return notify("ВНИМАНИЕ", "Назовите себя");
    if (nick.toLowerCase() === 'безликий' && role !== 'admin') return notify("ОТКАЗ", "Имя занято");
    try {
        const checkNick = await db.collection('users').where('nick', '==', nick).get();
        if (!checkNick.empty) return notify("ОШИБКА", "Ник уже в реестре");
        
        if (role === 'spartan' && code !== '300') return notify("ОТКАЗ", "Код неверен");
        if (role === 'moder' && code !== '500') return notify("ОТКАЗ", "Код неверен");
        if (role === 'admin' && (nick !== 'Безликий' || code !== '999')) return notify("ОТКАЗ", "Доступ закрыт");

        const newID = "S-" + Math.floor(1000 + Math.random() * 9000);
        user = { id: newID, nick: nick, role: role, rank: (role==='admin'?100:role==='moder'?50:1), banned: false, muted: false };
        await db.collection('users').doc(newID).set(user);
        showIdModal(newID);
    } catch (e) { notify("ОШИБКА", "Ошибка базы"); }
}

function startApp() {
    if (user.banned) { document.body.innerHTML = "<div class='auth-card'><h1>ИЗГНАН</h1></div>"; return; }
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    if (user.role === 'admin' || user.role === 'moder') document.getElementById('nav-admin').style.display = 'block';
    switchTab('news');
}

// --- ТАБЫ И ИНТЕРФЕЙС ---

function switchTab(t) {
    document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+t)?.classList.add('active');
    const area = document.getElementById('content-area');
    area.innerHTML = '';

    if (t === 'news') {
        area.innerHTML = '<div id="feed"></div>';
        db.collection('posts').orderBy('time', 'desc').onSnapshot(snap => {
            const f = document.getElementById('feed'); if(!f) return; f.innerHTML = '';
            snap.forEach(doc => {
                const p = doc.data();
                const isL = p.likes?.includes(user.id);
                const isD = p.dislikes?.includes(user.id);
                const del = (user.role==='admin'||user.role==='moder') ? `<button onclick="confirmDeletePost('${doc.id}')" style="float:right;background:none;border:none;color:red;font-size:18px;cursor:pointer;">×</button>` : '';
                f.innerHTML += `<div class="post-card animated">${del}<span class="post-h">${p.title}</span><small>${p.authorNick} | ${p.authorRole}</small><p>${p.text}</p>
                <div style="display:flex;gap:20px;"><span onclick="react('${doc.id}','like')" style="color:${isL?'var(--gold)':'#fff'}">👍 ${p.likes?.length||0}</span>
                <span onclick="react('${doc.id}','dis')" style="color:${isD?'var(--red)':'#fff'}">👎 ${p.dislikes?.length||0}</span></div></div>`;
            });
        });
    }

    if (t === 'chat') {
        area.innerHTML = '<div id="cb" style="height:calc(100vh - 165px);overflow-y:auto;padding:15px;"></div><div style="display:flex;padding:10px;background:#000;"><input id="mt" placeholder="Послание..."><button onclick="sendMsg()" class="glow-button" style="width:60px;">></button></div>';
        db.collection('chat').orderBy('time', 'asc').limitToLast(40).onSnapshot(snap => {
            const cb = document.getElementById('cb'); if(!cb) return; cb.innerHTML = '';
            snap.forEach(doc => {
                const m = doc.data();
                const cls = m.role==='admin'?'n-admin':(m.role==='moder'?'n-moder':'');
                cb.innerHTML += `<div style="margin-bottom:8px;"><span class="nick-frame ${cls}">${m.nick}</span> ${m.text}</div>`;
            });
            cb.scrollTop = cb.scrollHeight;
        });
    }

    if (t === 'profile') {
        area.innerHTML = `
        <div class="auth-card animated" style="margin-top:20px; width:90%; border-top: 3px solid var(--red);">
            <h2 style="color:var(--red)">${user.nick}</h2>
            <div style="font-size:10px; color:#444; margin-bottom:15px;">ID: ${user.id}</div>
            <div style="background:#0a0a0a; padding:15px; border-radius:10px; border:1px solid #1a1a1a;">
                <div style="display:flex; justify-content:space-between; font-size:12px;"><span>РАНГ</span> <b style="color:var(--gold)">${user.rank}</b></div>
                <div style="width:100%; height:3px; background:#000; margin-top:8px;"><div style="width:${Math.min(user.rank,100)}%; height:100%; background:var(--red);"></div></div>
            </div>
            ${user.rank >= 5 ? `<input id="ph" placeholder="Заголовок"><textarea id="pt" placeholder="Текст..."></textarea><button onclick="sendPost()" class="glow-button">ОТПРАВИТЬ</button>` : ''}
            <button onclick="location.reload()" style="background:none;border:none;color:#222;margin-top:20px;font-size:10px;">ВЫХОД</button>
        </div>`;
    }

    if (t === 'admin') {
        area.innerHTML = `
            <div style="padding:15px;">
                <h3 style="color:var(--red); margin-bottom:10px;">ПАНЕЛЬ СТРАТЕГА</h3>
                <button onclick="confirmClearChat()" style="width:100%; background:#111; border:1px solid red; color:red; padding:12px; border-radius:10px; margin-bottom:20px; font-weight:bold; cursor:pointer;">ОЧИСТИТЬ ИСТОРИЮ ЧАТА</button>
                <div id="u-list"></div>
            </div>`;
        db.collection('users').get().then(snap => {
            const list = document.getElementById('u-list');
            snap.forEach(doc => {
                const u = doc.data(); if(u.id===user.id) return;
                list.innerHTML += `
                <div class="post-card" style="margin-bottom:8px; padding:12px; background:#0a0a0a; border:1px solid #1a1a1a;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span><b>${u.nick}</b> <small style="color:var(--gold)">R:${u.rank}</small></span>
                        <div style="display:flex; gap:5px;">
                            <button onclick="changeRank('${u.id}', 1)" style="background:#111; color:var(--gold); border:1px solid var(--gold); padding:5px 8px;">+</button>
                            <button onclick="changeRank('${u.id}', -1)" style="background:#111; color:#555; border:1px solid #333; padding:5px 8px;">-</button>
                            <button onclick="admAct('${u.id}','mute',${u.muted})" style="background:${u.muted?'var(--gold)':'#111'}; border:1px solid ${u.muted?'var(--gold)':'#333'}; padding:5px 8px; color:${u.muted?'#000':'#fff'}">M</button>
                            <button onclick="admAct('${u.id}','ban',${u.banned})" style="background:${u.banned?'#fff':'#111'}; border:1px solid red; padding:5px 8px; color:${u.banned?'#000':'red'}">B</button>
                            <button onclick="confirmDestroy('${u.id}')" style="background:red; color:#fff; border:none; padding:5px 8px; font-weight:bold;">❌</button>
                        </div>
                    </div>
                </div>`;
            });
        });
    }
}

// --- ФУНКЦИИ ПОДТВЕРЖДЕНИЯ (КРАСИВЫЕ) ---

function confirmDeletePost(id) {
    askSpartan("Удалить эту весть навсегда?", async () => {
        await db.collection('posts').doc(id).delete();
        notify("СИСТЕМА", "Весть стерта");
    });
}

function confirmClearChat() {
    askSpartan("Ты уверен, что хочешь очистить всю историю чата?", async () => {
        const snap = await db.collection('chat').get();
        const batch = db.batch();
        snap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        notify("АДМИН", "История чата уничтожена");
    });
}

function confirmDestroy(id) {
    askSpartan("УНИЧТОЖИТЬ ПРОФИЛЬ? Воин потеряет всё.", async () => {
        await db.collection('users').doc(id).delete();
        notify("СИСТЕМА", "Профиль аннулирован");
        switchTab('admin');
    });
}

// --- ОСТАЛЬНОЕ (БЕЗ ИЗМЕНЕНИЙ В ЛОГИКЕ) ---

async function changeRank(id, amt) {
    const ref = db.collection('users').doc(id);
    const d = await ref.get();
    await ref.update({ rank: (d.data().rank || 0) + amt });
    switchTab('admin');
}

async function admAct(id, type, val) {
    const upd = {}; upd[type === 'ban' ? 'banned' : 'muted'] = !val;
    await db.collection('users').doc(id).update(upd);
    switchTab('admin');
}

async function react(id, type) {
    const ref = db.collection('posts').doc(id);
    const d = await ref.get();
    let { likes=[], dislikes=[] } = d.data();
    if (type === 'like') {
        likes = likes.includes(user.id) ? likes.filter(i => i !== user.id) : [...likes, user.id];
        dislikes = dislikes.filter(i => i !== user.id);
    } else {
        dislikes = dislikes.includes(user.id) ? dislikes.filter(i => i !== user.id) : [...dislikes, user.id];
        likes = likes.filter(i => i !== user.id);
    }
    await ref.update({ likes, dislikes });
}

async function sendPost() {
    const h = document.getElementById('ph').value; const t = document.getElementById('pt').value;
    if(!h || !t) return;
    await db.collection('posts').add({ title: h, text: t, authorNick: user.nick, authorRole: user.role, time: Date.now(), likes: [], dislikes: [] });
    switchTab('news');
}

async function sendMsg() {
    const i = document.getElementById('mt'); if(!i.value || user.muted) return;
    await db.collection('chat').add({ nick: user.nick, text: i.value, role: user.role, time: Date.now() });
    i.value = '';
}

function toggleCodeField() {
    const r = document.getElementById('role-select').value;
    document.getElementById('code-input').style.display = (r === 'guest') ? 'none' : 'block';
}
