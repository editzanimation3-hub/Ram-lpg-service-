// Firebase Realtime Database configuration (shared across all devices)
const firebaseConfig = {
  apiKey: "AIzaSyDV3pW6v-kTAVH-t1EkEuGMkcmm3k6f25Y",
  authDomain: "lpg-3ce0c.firebaseapp.com",
  databaseURL: "https://lpg-3ce0c-default-rtdb.firebaseio.com",
  projectId: "lpg-3ce0c",
  storageBucket: "lpg-3ce0c.firebasestorage.app",
  messagingSenderId: "598298166922",
  appId: "1:598298166922:web:c9a3e87967ca1003708f73",
  measurementId: "G-Q70KRPN2SJ"
};

window.firebasePortal = { ready: false, db: null };
try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();
  const root = 'lpg_portal';
  const cleanPath = v => String(v || '').replace(/^\/+|\/+$/g, '');
  const refPath = r => cleanPath(r.__path || r);
  const makeCollection = name => ({ __path: root + '/' + cleanPath(name) });
  const makeDoc = (col, id) => ({ __path: refPath(col) + '/' + cleanPath(id) });
  const clone = v => v == null ? v : JSON.parse(JSON.stringify(v));

  window.firebasePortal = {
    ready: true, db: rtdb,
    collection: (_db, name) => makeCollection(name),
    doc: (col, id) => makeDoc(col, id),
    async setDoc(ref, data, options = {}) {
      const target = rtdb.ref(refPath(ref));
      if (options && options.merge) return target.update(clone(data));
      return target.set(clone(data));
    },
    async deleteDoc(ref) { return rtdb.ref(refPath(ref)).remove(); },
    async getDoc(ref) {
      const snap = await rtdb.ref(refPath(ref)).once('value');
      return { exists: () => snap.exists(), data: () => clone(snap.val() || {}) };
    },
    async getDocs(col) {
      const snap = await rtdb.ref(refPath(col)).once('value');
      const docs = [];
      snap.forEach(child => docs.push({ id: child.key, data: () => clone(child.val() || {}) }));
      return { docs };
    },
    onSnapshot(ref, callback, errorCallback) {
      const target = rtdb.ref(refPath(ref));
      const isDoc = String(refPath(ref)).split('/').length >= 3;
      const handler = snap => {
        try {
          if (isDoc) {
            callback({ exists: () => snap.exists(), data: () => clone(snap.val() || {}) });
          } else {
            const docs = [];
            snap.forEach(child => docs.push({ id: child.key, data: () => clone(child.val() || {}) }));
            callback({ docs });
          }
        } catch (e) { if (errorCallback) errorCallback(e); }
      };
      target.on('value', handler, errorCallback || undefined);
      return () => target.off('value', handler);
    },
    writeBatch: () => {
      const updates = {};
      return {
        set(ref, data) { updates[refPath(ref)] = clone(data); },
        delete(ref) { updates[refPath(ref)] = null; },
        async commit() { if (Object.keys(updates).length) await rtdb.ref().update(updates); }
      };
    }
  };
  console.log('Firebase Realtime Database connected:', firebaseConfig.projectId);
  window.dispatchEvent(new Event('firebase-ready'));
} catch (e) {
  console.error('Firebase RTDB initialization failed:', e);
  window.firebasePortal.ready = false;
  window.firebasePortal.error = e?.message || String(e);
}

// Scanner -> Portal bridge
(function () {
  try {
    const cfg = firebaseConfig;
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    window.portalRTDB = firebase.database();
    window.portalRTDB.ref('lpg_booking_scanner/delivery_send').on('child_added', function (snap) {
      const d = snap.val();
      if (!d || !d.id) return;
      window._pendingScannerDeliveries = window._pendingScannerDeliveries || {};
      if (window._pendingScannerDeliveries[d.id]) return;
      window._pendingScannerDeliveries[d.id] = true;
      try {
        db.deliveries = db.deliveries || [];
        const exists = db.deliveries.some(x => String(x.id || '') === String(d.id));
        if (!exists) {
          db.deliveries.unshift({ ...d, receivedFromScanner: true, receivedAt: new Date().toISOString() });
          db.logs = db.logs || [];
          db.logs.push({ time: new Date().toLocaleString(), role: role, action: 'Delivery received from LPG Booking Scanner: ' + d.id });
          if (typeof save === 'function') save();
          if (typeof render === 'function') render();
        }
        snap.ref.remove().catch(() => {});
      } catch (e) { console.error('Scanner delivery import failed:', e); }
    });
  } catch (e) { console.error('Portal RTDB bridge failed:', e); }
})();

const storeKey = 'lpg_portal_demo_v1';
const backupKey = 'lpg_portal_backup_v1';
function readStoredPortalData() {
  try {
    const primary = localStorage.getItem(storeKey);
    if (primary) { const parsed = JSON.parse(primary); if (parsed && typeof parsed === 'object') return parsed; }
  } catch (e) { console.warn('Primary storage read failed:', e); }
  try {
    const backup = localStorage.getItem(backupKey);
    if (backup) { const parsed = JSON.parse(backup); if (parsed && typeof parsed === 'object') return parsed; }
  } catch (e) { console.warn('Backup storage read failed:', e); }
  return null;
}

let db = readStoredPortalData() || {
  customers: [{ id: 'C001', name: 'Rahul Kumar', mobile: '98XXXXXX21', lpgId: 'LPG-10021', consumer: 'CON-10021', distributor: 'City LPG Agency', aadhaarLast4: '1234', password: 'demo', status: 'Active' }],
  payments: [{ id: 'P001', customer: 'Rahul Kumar', amount: 199, utr: 'UTR123456', status: 'Pending', date: '23 Sep 2026' }],
  requests: [{ id: 'R001', customer: 'Rahul Kumar', type: 'Mobile Update', amount: 150, status: 'Pending', date: '23 Sep 2026' }],
  vipCustomers: [], vipPrice: 199,
  problems: [], bookings: [], vipRequests: [], chats: [], customOptions: [], notifications: [],
  notices: [{ title: 'Welcome', text: 'LPG Service Portal is live.' }],
  admins: [{ id: 'A001', name: 'Demo Admin', mobile: '9000000000', status: 'Active' }],
  logs: []
};

db.customers = (db.customers || []).map((c, i) => { if (!c.id) c.id = 'C' + String(i + 1).padStart(3, '0'); if (!c.loginId) c.loginId = c.mobile || c.consumer || c.id; if (!c.password) c.password = 'demo123'; if (!c.status) c.status = 'Active'; return c; });
db.admins = (db.admins || []).map((a, i) => { if (!a.id) a.id = 'A' + String(i + 1).padStart(3, '0'); if (!a.loginId) a.loginId = a.id.toLowerCase(); if (!a.password) a.password = 'admin123'; if (!a.status) a.status = 'Active'; if (!a.team) a.team = 'Support Team'; if (!a.post) a.post = 'Service Admin'; if (!Array.isArray(a.permissions)) a.permissions = ['Mobile Update', 'eKYC Check', 'Booking', 'Last Delivery', 'Customer Services']; return a; });
if (db.customers[0] && db.customers[0].name === 'Rahul Kumar' && db.customers[0].mobile === '98XXXXXX21') { db.customers[0].mobile = '9876543210'; db.customers[0].loginId = 'rahul001'; db.customers[0].password = 'demo123'; }
if (db.admins[0] && db.admins[0].name === 'Demo Admin') { db.admins[0].loginId = 'admin001'; db.admins[0].password = db.admins[0].password || 'admin123'; }
db.customOptions = db.customOptions || []; db.chats = db.chats || []; db.notifications = db.notifications || []; db.importantInfo = db.importantInfo || []; db.webEkycRequests = db.webEkycRequests || [];
db.portalSettings = db.portalSettings || { portalName: 'LPG Service Portal', tagline: 'Safe Fuel | Better Tomorrow', supportWhatsapp: '6204707761', upiId: '7488088633@nyes', mobileUpdatePrice: 150, ownerChatPrice: 10, maintenance: 'Off', maintenanceUntil: '', maintenanceMessage: 'We are performing scheduled server maintenance to improve speed, security and reliability.' };
db.portalSettings.maintenanceUntil = db.portalSettings.maintenanceUntil || '';
db.portalSettings.maintenanceMessage = db.portalSettings.maintenanceMessage || 'We are performing scheduled server maintenance to improve speed, security and reliability.';
db.ownerAccount = db.ownerAccount || { loginId: 'rhariday844@gmail.com', password: 'Ram@4343' }; if (!db.ownerAccount.loginId) db.ownerAccount.loginId = 'rhariday844@gmail.com'; if (!db.ownerAccount.password) db.ownerAccount.password = 'Ram@4343';
if (!db.portalSettings.supportWhatsapp) db.portalSettings.supportWhatsapp = '6204707761';
let selectedChatCustomerId = '';
let selectedSupportAdminId = '';

function isMaintenanceActive() {
  const ps = db.portalSettings || {};
  if (ps.maintenance !== 'On') return false;
  if (ps.maintenanceUntil) { const t = new Date(ps.maintenanceUntil).getTime(); if (Number.isFinite(t) && Date.now() >= t) { ps.maintenance = 'Off'; ps.maintenanceUntil = ''; save(); return false; } }
  return true;
}

function maintenanceEndText() {
  const v = db.portalSettings?.maintenanceUntil;
  if (!v) return 'Maintenance will continue until the Owner turns it OFF.';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'Maintenance is in progress.' : ('Customer access will remain blocked until <b>' + d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + '</b>.');
}

function maintenancePage() {
  const msg = escapeHtml(db.portalSettings?.maintenanceMessage || 'We are performing scheduled server maintenance to improve speed, security and reliability.');
  return `<div style="min-height:70vh;display:flex;align-items:center;justify-content:center;padding:25px">
    <div class="card" style="max-width:760px;width:100%;text-align:center;padding:38px;border:1px solid #fed7aa">
      <div style="font-size:64px">🔧</div>
      <h1 style="margin:10px 0;color:#b45309">Server Maintenance in Progress</h1>
      <p style="font-size:17px;line-height:1.7;color:#475569">${msg}</p>
      <div class="notice" style="margin:20px 0;text-align:left">
        <b>⏳ Maintenance Time</b><br>
        <span>${maintenanceEndText()}</span><br><br>
        <b>🔒 Customer Account Access is Temporarily Closed</b><br>
        <span class="muted">While maintenance is ON, customers cannot login or access their account, LPG booking, payment, eKYC, delivery and other customer services.</span>
      </div>
      <button class="btn btn-light" onclick="location.reload()">🔄 Check Again</button>
    </div>
  </div>`;
}

function portalName() { return db.portalSettings?.portalName || 'LPG Service Portal'; }
function whatsappNumber() { return String(db.portalSettings?.supportWhatsapp || '6204707761').replace(/\D/g, ''); }
function vipWhatsappUrl(message) { return 'https://wa.me/' + whatsappNumber() + '?text=' + encodeURIComponent(message || 'VIP Customer Support - LPG Service Portal'); }
function openVipWhatsApp() { window.open(vipWhatsappUrl('Hello, I need VIP Customer Support. Customer: ' + (getCurrentCustomer()?.name || currentUser)), '_blank'); }

function applyPortalBranding() {
  document.title = portalName();
  document.querySelectorAll('.brand').forEach(el => {
    if (el.closest('#loginScreen')) return;
    el.innerHTML = '<span class="flame">🔥</span> ' + portalName();
  });
  const h = document.querySelector('#loginScreen h1');
  if (h) h.innerHTML = 'Welcome to<br>' + portalName();
  const tag = document.querySelector('#loginScreen .sub');
  if (tag && db.portalSettings?.tagline) tag.textContent = db.portalSettings.tagline;
}

(db.vipRequests || []).forEach(v => {
  if (!v.customerId) {
    const c = db.customers.find(x => x.name === v.customer || x.mobile === v.customer || x.id === v.customer);
    if (c) { v.customerId = c.id; v.customerName = c.name; }
  }
});

function addOneMonth(date) { const d = new Date(date || Date.now()); d.setMonth(d.getMonth() + 1); return d.toISOString(); }
function normalizeVipExpiry() {
  let changed = false;
  (db.vipRequests || []).forEach(v => {
    if (v.status === 'Approved' && !v.approvedAt) { v.approvedAt = v.date || new Date().toISOString(); v.expiresAt = addOneMonth(v.approvedAt); changed = true; }
    if (v.status === 'Approved' && v.expiresAt && Date.now() >= new Date(v.expiresAt).getTime() && v.status !== 'Expired') { v.status = 'Expired'; changed = true; }
  });
  if (changed) save();
}
normalizeVipExpiry();

let firebaseSyncBusy = false, firebaseListenersStarted = false, firebaseHydrated = false, firebaseHydrating = false, firebaseSyncQueued = false;
let firebaseLastSynced = {}, firebaseDirty = {};
const FIREBASE_ARRAY_COLLECTIONS = [
  'customers', 'payments', 'requests', 'vipCustomers', 'problems', 'bookings',
  'vipRequests', 'chats', 'customOptions', 'notifications', 'notices', 'admins',
  'logs', 'importantInfo', 'webEkycRequests', 'deliveries', 'privateDataChats',
  'adminMeetings', 'accountCharges'
];

function firebaseConfigured() { return !!(window.firebasePortal && window.firebasePortal.ready && window.firebasePortal.db); }
function firebaseCollection(name) { return window.firebasePortal.collection(window.firebasePortal.db, name); }
function firebaseDoc(name, id) { return window.firebasePortal.doc(firebaseCollection(name), String(id)); }
function firebaseClone(v) { try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; } }
function firebaseJson(v) { try { return JSON.stringify(v ?? null); } catch (e) { return String(v); } }
function firebaseArrayMap(name, source) {
  const out = {};
  (Array.isArray(source) ? source : []).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `${name.toUpperCase()}_${Date.now()}_${index}`);
    item.id = id; out[id] = item;
  });
  return out;
}

function firebaseMarkDirty() {
  if (!firebaseHydrated) return;
  FIREBASE_ARRAY_COLLECTIONS.forEach(name => {
    const current = firebaseArrayMap(name, db[name]);
    const previous = firebaseLastSynced[name] || {};
    const dirtyIds = new Set(firebaseDirty[name] || []);
    Object.keys(current).forEach(id => { if (firebaseJson(current[id]) !== firebaseJson(previous[id])) dirtyIds.add(id); });
    Object.keys(previous).forEach(id => { if (!current[id]) dirtyIds.add(id); });
    firebaseDirty[name] = Array.from(dirtyIds);
  });
}

async function firebaseWriteChanges() {
  if (!firebaseConfigured() || !firebaseHydrated) { firebaseSyncQueued = true; return; }
  if (firebaseSyncBusy) { firebaseSyncQueued = true; return; }
  firebaseSyncBusy = true; firebaseSyncQueued = false;
  try {
    for (const name of FIREBASE_ARRAY_COLLECTIONS) {
      const dirtyIds = Array.from(new Set(firebaseDirty[name] || []));
      if (!dirtyIds.length) continue;
      const current = firebaseArrayMap(name, db[name]);
      const previous = firebaseLastSynced[name] || {};
      for (let offset = 0; offset < dirtyIds.length; offset += 400) {
        const chunk = dirtyIds.slice(offset, offset + 400);
        const batch = window.firebasePortal.writeBatch(window.firebasePortal.db);
        let writes = 0;
        chunk.forEach(id => {
          if (current[id]) { batch.set(firebaseDoc(name, id), current[id]); writes++; }
          else if (previous[id]) { batch.delete(firebaseDoc(name, id)); writes++; }
        });
        if (writes) await batch.commit();
      }
      firebaseLastSynced[name] = firebaseClone(current);
      firebaseDirty[name] = [];
    }
    const meta = {
      initialized: true,
      portalSettings: db.portalSettings || {},
      ownerAccount: db.ownerAccount || {},
      vipPrice: Number.isFinite(Number(db.vipPrice)) ? Number(db.vipPrice) : 199,
      updatedAt: new Date().toISOString()
    };
    await window.firebasePortal.setDoc(firebaseDoc('portal_meta', 'config'), meta, { merge: true });
  } catch (e) {
    console.error('Firestore sync failed:', e);
    firebaseSyncQueued = true;
  } finally {
    firebaseSyncBusy = false;
    if (firebaseSyncQueued) setTimeout(firebaseWriteChanges, 0);
  }
}

async function firebaseSeedAll() {
  if (!firebaseConfigured()) return;
  try {
    for (const name of FIREBASE_ARRAY_COLLECTIONS) {
      const rows = Array.isArray(db[name]) ? db[name] : [];
      if (!rows.length) continue;
      const batch = window.firebasePortal.writeBatch(window.firebasePortal.db);
      let writes = 0;
      rows.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const id = String(item.id || `${name.toUpperCase()}_${Date.now()}_${index}`);
        item.id = id; batch.set(firebaseDoc(name, id), item); writes++;
      });
      if (writes) await batch.commit();
    }
    await window.firebasePortal.setDoc(firebaseDoc('portal_meta', 'config'), {
      initialized: true,
      portalSettings: db.portalSettings || {},
      ownerAccount: db.ownerAccount || {},
      vipPrice: Number.isFinite(Number(db.vipPrice)) ? Number(db.vipPrice) : 199,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (e) { console.error('Firestore initial seed failed:', e); }
}

async function hydrateFirebaseData() {
  if (!firebaseConfigured() || firebaseHydrated || firebaseHydrating) return;
  firebaseHydrating = true;
  try {
    const metaSnap = await window.firebasePortal.getDoc(firebaseDoc('portal_meta', 'config'));
    const meta = metaSnap.exists() ? (metaSnap.data() || {}) : null;
    if (meta?.initialized) {
      for (const name of FIREBASE_ARRAY_COLLECTIONS) {
        const snap = await window.firebasePortal.getDocs(firebaseCollection(name));
        db[name] = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      }
      if (meta.portalSettings) db.portalSettings = { ...(db.portalSettings || {}), ...meta.portalSettings };
      if (meta.ownerAccount) db.ownerAccount = { ...(db.ownerAccount || {}), ...meta.ownerAccount };
      if (meta.vipPrice !== undefined) db.vipPrice = Number(meta.vipPrice);
    } else {
      await firebaseSeedAll();
    }
    FIREBASE_ARRAY_COLLECTIONS.forEach(name => { firebaseLastSynced[name] = firebaseClone(firebaseArrayMap(name, db[name])); firebaseDirty[name] = []; });
    firebaseHydrated = true;
    persistLocalData();
    startFirebaseLiveSync();
    if (firebaseSyncQueued) firebaseWriteChanges();
    if (typeof applyPortalBranding === 'function') applyPortalBranding();
    if (typeof render === 'function' && document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) render();
  } catch (e) { console.error('Firebase hydration failed:', e); }
  finally { firebaseHydrating = false; }
}

function startFirebaseLiveSync() {
  if (!firebaseConfigured() || firebaseListenersStarted || !firebaseHydrated) return;
  firebaseListenersStarted = true;
  FIREBASE_ARRAY_COLLECTIONS.forEach(name => {
    window.firebasePortal.onSnapshot(firebaseCollection(name), snap => {
      const incoming = snap.docs.map(x => ({ id: x.id, ...x.data() }));
      const dirty = new Set(firebaseDirty[name] || []);
      if (dirty.size) {
        const incomingMap = {}; incoming.forEach(x => incomingMap[x.id] = x);
        const localMap = firebaseArrayMap(name, db[name]);
        dirty.forEach(id => { if (localMap[id]) incomingMap[id] = localMap[id]; else delete incomingMap[id]; });
        db[name] = Object.values(incomingMap);
      } else {
        db[name] = incoming;
      }
      const baseline = firebaseArrayMap(name, db[name]);
      firebaseLastSynced[name] = firebaseClone(baseline);
      persistLocalData();
      if (typeof render === 'function' && document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) render();
    }, err => console.error('Firestore live sync ' + name + ' failed:', err));
  });
}

async function firebaseDelete(name, id) {
  if (!firebaseConfigured() || !id) return;
  try {
    await window.firebasePortal.deleteDoc(firebaseDoc(name, id));
    if (firebaseLastSynced[name]) delete firebaseLastSynced[name][String(id)];
  } catch (e) { console.error('Firestore delete failed:', e); }
}

function persistLocalData() {
  const payload = JSON.stringify(db);
  try { localStorage.setItem(storeKey, payload); } catch (e) { console.warn(e); }
  try { localStorage.setItem(backupKey, payload); } catch (e) { console.warn(e); }
}

function save() {
  persistLocalData();
  if (firebaseConfigured()) {
    if (firebaseHydrated) { firebaseMarkDirty(); firebaseWriteChanges(); }
    else firebaseSyncQueued = true;
  }
}

window.addEventListener('firebase-ready', () => hydrateFirebaseData());
setTimeout(() => hydrateFirebaseData(), 1500);

let role = 'customer', currentPage = 'Dashboard', currentUser = '';
const menus = {
  customer: [['Dashboard','🏠'],['LPG Booking','🔥'],['eKYC','🪪'],['Web eKYC','🌐'],['Last Delivery','🚚'],['LPG ID','🆔'],['Distributor','🏪'],['Google Drive Backup','📁'],['Mobile Update ₹150','📱'],['VIP ₹199','⭐'],['VIP Transaction History','🧾'],['Owner Chat ₹10','💬'],['UPI/QR Payment','💳'],['My Requests','📋'],['Notifications','🔔'],['Account Charges / Pay Now','💰'],['Payment History','🧾'],['Notices','📢'],['Admin Information','📨'],['Important Information','ℹ️'],['Admin Support Team','🧑‍💼'],['Private Chat','🔒'],['Service Status Check','🔎'],['My Settings','⚙️'],['Change Password','🔐']],
  admin: [['Dashboard','🏠'],['Customer List/Search','👥'],['Customer Details','🧾'],['Pending Payments','💳'],['UTR Check','🔎'],['Approve/Reject','✅'],['VIP Verify','⭐'],['Web eKYC Requests','🌐'],['VIP Customers','👑'],['Requests','📋'],['eKYC','🪪'],['Mobile Update','📱'],['Customer Chat','💬'],['Google Drive Backup','📁'],['Important Information','ℹ️'],['Notices','📢'],['Delivery','🚚'],['LPG Booking','🔥'],['Payment History','🧾'],['My Activity','📊']],
  owner: [['Owner Dashboard','📊'],['Dashboard','🏠'],['Customer Management','👥'],['Admin Management','👨‍💼'],['Admin Password Change','🔑'],['eKYC Overview','🪪'],['Customer Data Check','🧾'],['Customer Password Check','🔐'],['Submitted eKYC Forms','🌐'],['Payments','💳'],['eKYC Processing','⚙️'],['VIP Customers — केवल VIP','👑'],['Requests','📋'],['Chat','💬'],['VIP Chat Customer Support','🟢'],['Google Drive Backup','📁'],['Important Information','ℹ️'],['Notices','📢'],['Delivery','🚚'],['LPG','🔥'],['Statistics','📊'],['Admin Permissions','🔐'],['Storage / Database','💾'],['Portal Settings','⚙️'],['Website Update','🛠️'],['Problem / Error Requests','🛠️'],['Add / Manage Options','➕']]
};


function selectRole(r) {
  role = r;
  document.querySelectorAll('.role').forEach(x => x.classList.remove('active'));
  const btn = document.querySelector('.role.' + r);
  if (btn) btn.classList.add('active');
}

const AUTHORIZED_OWNER_UID = 'UDuCsQFYJXhGYKdT7RqkZrh3fe63';
async function googleLogin() {
  if (!window.firebase || !firebase.auth) { alert('Firebase Authentication not loaded. Check internet connection.'); return; }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    if (!user || user.uid !== AUTHORIZED_OWNER_UID) {
      await firebase.auth().signOut();
      alert('This Google account is not the authorized Owner account.');
      return;
    }
    await hydrateFirebaseData();
    role = 'owner'; currentUser = 'OWNER';
    localStorage.setItem('lpg_current_user', currentUser);
    localStorage.setItem('lpg_current_role', role);
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('rolePill').textContent = (user.displayName || 'Owner') + ' • OWNER';
    document.getElementById('sideTitle').textContent = 'owner panel';
    renderNav(); go('Owner Dashboard');
  } catch (e) {
    console.error('Google sign-in failed:', e);
    alert('Google Login failed: ' + (e?.message || e));
  }
}

function getCurrentCustomer() { return db.customers.find(c => c.id === currentUser) || db.customers.find(c => c.mobile === currentUser) || null; }
function getCurrentAdmin() { return db.admins.find(a => a.id === currentUser) || db.admins.find(a => a.loginId === currentUser) || null; }

function login() {
  if (role === 'customer' && isMaintenanceActive()) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('rolePill').textContent = 'MAINTENANCE';
    document.getElementById('sideTitle').textContent = 'Service Maintenance';
    currentPage = 'Maintenance'; renderNav(); render(); return;
  }
  const u = document.getElementById('loginUser').value.trim(), p = document.getElementById('loginPass').value;
  if (!u || !p) { alert('Enter ID and password'); return; }
  let account = null;
  if (role === 'owner') {
    if (u !== db.ownerAccount.loginId || p !== db.ownerAccount.password) { alert('Invalid Owner ID or Password'); return; }
    currentUser = 'OWNER';
  } else if (role === 'customer') {
    account = (db.customers || []).find(c => (c.loginId === u || c.mobile === u || c.consumer === u || c.id === u) && c.password === p && c.status !== 'Deleted');
    if (!account) { alert('Invalid Customer ID/Mobile or Password. Please use registered account.'); return; }
    currentUser = account.id;
  } else if (role === 'admin') {
    account = (db.admins || []).find(a => (a.loginId === u || a.id === u || a.mobile === u || a.email === u) && a.password === p && a.status !== 'Blocked');
    if (!account) { alert('Invalid Admin ID or Password.'); return; }
    currentUser = account.id;
  }
  localStorage.setItem('lpg_current_user', currentUser); localStorage.setItem('lpg_current_role', role);
  if (role === 'customer' && account && account.status === 'Disabled') {
    document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden');
    document.getElementById('rolePill').textContent = (account.name || 'Customer') + ' • CUSTOMER';
    document.getElementById('sideTitle').textContent = 'Account Restricted';
    currentPage = 'Disabled Account'; renderNav(); render(); return;
  }
  document.getElementById('loginScreen').classList.add('hidden'); document.getElementById('app').classList.remove('hidden');
  const display = role === 'customer' ? getCurrentCustomer()?.name : role === 'admin' ? getCurrentAdmin()?.name : 'Owner';
  document.getElementById('rolePill').textContent = display + ' • ' + role.toUpperCase();
  document.getElementById('sideTitle').textContent = role + ' panel';
  renderNav(); go(role === 'owner' ? 'Owner Dashboard' : 'Dashboard');
}

function logout() {
  currentUser = '';
  localStorage.removeItem('lpg_current_user');
  localStorage.removeItem('lpg_current_role');
  const finishLogout = () => {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
  };
  if (window.firebase && firebase.auth && firebase.auth().currentUser) {
    firebase.auth().signOut().then(finishLogout).catch(() => finishLogout());
  } else finishLogout();
}

function adminTeamName() { return getCurrentAdmin()?.team || 'Support Team'; }

function teamMenuItems() {
  const common = [['Customer Details','🧾'],['Notices','📢']];
  if (role === 'owner') return [['Services Admin','🛠️'],['Customer Details','🧾'],['Web eKYC Requests','🌐'],['Booking Management','🔥'],['Delivery Management','🚚'],['Admin Meeting','👥'],['Notices','📢'],['Storage / Database','💾'],['Portal Settings','⚙️']];
  const t = adminTeamName();
  if (t === 'Booking & Delivery Team') return [['Booking Management','🔥'],['Delivery Management','🚚'],['Booking & Delivery Notice','📢'],['Private Data Chat','🔒'],['Admin Meeting','👥'],['Customer Details','🧾']];
  if (t === 'Support Team') return [['Private Chat','🔒'],['Admin Meeting','👥'],['Customer Chat','💬'],['eKYC','🪪'],['Customer Details','🧾'],['Notifications','🔔'],['Customer Account Control','🔐'],['Account Charges','💰'],['Notices','📢'],['Payment History','💳']];
  if (t === 'eKYC Team') return [['Private Chat','🔒'],['Admin Meeting','👥'],['Web eKYC Requests','🌐'],['eKYC','🪪'],['eKYC Service Notice','📢'],['Customer Details','🧾'],['Notifications','🔔'],['Customer Account Control','🔐'],['Account Charges','💰'],['Customer Chat','💬']];
  if (t === 'All Services') return [['Private Chat','🔒'],['Admin Meeting','👥'],['Booking Management','🔥'],['Delivery Management','🚚'],['Booking & Delivery Notice','📢'],['Private Data Chat','🔒'],['Customer List/Search','👥'],['Customer Details','🧾'],['Notifications','🔔'],['Customer Account Control','🔐'],['Account Charges','💰'],['Customer Chat','💬'],['eKYC','🪪'],['Pending Payments','💳'],['UTR Check','🔎'],['Approve/Reject','✅'],['VIP Verify','⭐'],['VIP Customers','👑'],['Requests','📋'],['Mobile Update','📱'],['Important Information','ℹ️'],['Notices','📢'],['Delivery','🚚'],['LPG Booking','🔥'],['Payment History','🧾'],['My Activity','📊']];
  if (t === 'Service Team') return [['Service Dashboard','🛠️'],['Service Processing','⚙️'],['Mobile Update','📱'],['eKYC Check','🪪'],['Booking Management','🔥'],['Last Delivery','🚚'],['Customer Service Requests','🛠️'],['Service Reference List','🔢'],['Customer Chat','💬'],['Admin Information','📨'],['Customer Details','🧾'],['Canara Bank Account Assistance','🏦'],['Private Data Chat','🔒'],['Notices','📢']];
  if (t === 'Customer Account Enable/Disable Notice Team') return [['Private Chat','🔒'],['Admin Meeting','👥'],['Customer Account Control','🔐'],['Customer Details','🧾'],['Account Charges','💰'],['Notices','📢'],['Customer Chat','💬']];
  return common;
}

function renderNav() {
  if (role === 'customer' && getCurrentCustomer()?.status === 'Disabled') {
    document.getElementById('nav').innerHTML = [['Admin Support Team','🧑‍💼'],['Account Charges / Pay Now','💰'],['Notice','📢'],['Web eKYC','🌐']].map(([n, i]) => `<button onclick="go('${n}')" class="${currentPage === n ? 'active' : ''}">${i} ${n}</button>`).join('') + `<div class="logout"><button onclick="logout()">🚪 Logout</button></div>`;
    return;
  }
  let items = role === 'admin' ? teamMenuItems() : menus[role].map(x => [x[0], x[1]]);
  if (role === 'customer') {
    const vip = vipActiveForCustomer();
    items = items.map(x => x[0] === 'VIP ₹199' ? [`VIP ₹${db.vipPrice || 199}`, x[1]] : x);
    if (vip) { items.splice(items.findIndex(x => x[0].startsWith('VIP ₹')) + 1, 0, ['VIP Services','🎁'], ['VIP Owner Chat','💬'], ['VIP Admin Chat','🧑‍💼']); }
  }
  const custom = (db.customOptions || []).filter(o => o.enabled !== false && (o.role === 'all' || o.role === role));
  document.getElementById('nav').innerHTML = items.map(([n, i]) => `<button onclick="go('${n.replaceAll("'", "")}')" class="${currentPage === n ? 'active' : ''}">${i} ${n}</button>`).join('') + custom.map(o => `<button onclick="goCustom('${o.id}')" class="${currentPage === 'custom:' + o.id ? 'active' : ''}">${o.icon || '⭐'} ${o.name}</button>`).join('') + `<div class="logout"><button onclick="logout()">🚪 Logout</button></div>`;
}

function go(p) {
  if (role === 'customer' && (p === 'Customer Management' || p === 'Customer List/Search')) { p = 'My Settings'; }
  currentPage = p; renderNav(); render();
  if (role === 'customer' && currentPage === 'UPI/QR Payment') setTimeout(refreshUPI, 50);
}
function title(t, d = '') { return `<div class="page-title"><div><h1>${t}</h1><p>${d}</p></div></div>`; }
function stat(label, num, icon) { return `<div class="card stat"><div><div class="muted">${label}</div><div class="num">${num}</div></div><div class="iconbox">${icon}</div></div>`; }

function openSignup() {
  document.getElementById('modalRoot').classList.remove('hidden');
  document.getElementById('modalCard').innerHTML = `
    <div class="modal-head"><h2>👤 Customer Signup</h2><button class="close" onclick="closeModal()">×</button></div>
    <p class="muted">Create your customer account with your LPG and identity details.</p>
    <div class="form-grid">
      <div class="field"><label>Name *</label><input id="suName" placeholder="Full name"></div>
      <div class="field"><label>Mobile Number *</label><input id="suMobile" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>
      <div class="field"><label>Consumer Number *</label><input id="suConsumer" placeholder="Consumer number"></div>
      <div class="field"><label>Password *</label><input id="suPass" type="password" placeholder="Create password"></div>
      <div class="field"><label>Confirm Password *</label><input id="suConfirm" type="password" placeholder="Confirm password"></div>
      <div class="field"><label>Distributor Name *</label><input id="suDistributor" placeholder="Distributor name"></div>
      <div class="field full"><label>Aadhaar Photo *</label>
        <div class="upload-box">
          <input id="suAadhaar" type="file" accept="image/*" capture="environment" onchange="previewAadhaar(this)">
          <div class="muted">Choose from gallery or use camera on mobile.</div>
          <img id="aadhaarPreview" class="preview">
        </div>
      </div>
    </div>
    <div class="actions"><button class="btn btn-primary" onclick="signupCustomer()">Create Account</button><button class="btn btn-light" onclick="closeModal()">Cancel</button></div>`;
}

function previewAadhaar(input) {
  const img = document.getElementById('aadhaarPreview');
  if (input.files && input.files[0]) { img.src = URL.createObjectURL(input.files[0]); img.style.display = 'block'; }
}

function signupCustomer() {
  const name = suName.value.trim(), mobile = suMobile.value.trim(), consumer = suConsumer.value.trim(),
    pass = suPass.value, confirm = suConfirm.value, distributor = suDistributor.value.trim(),
    file = document.getElementById('suAadhaar').files[0];
  if (!name || !mobile || !consumer || !pass || !confirm || !distributor || !file) { alert('Please fill all required fields and upload Aadhaar photo.'); return; }
  if (!/^\d{10}$/.test(mobile)) { alert('Enter a valid 10-digit mobile number.'); return; }
  if (pass !== confirm) { alert('Password and confirm password do not match.'); return; }
  if (db.customers.some(c => c.mobile === mobile || c.consumer === consumer)) { alert('Mobile or consumer number already registered.'); return; }
  const c = { id: 'C' + String(Date.now()).slice(-6), loginId: mobile, name, mobile, consumer, lpgId: 'LPG-' + String(Date.now()).slice(-6), distributor, status: 'Active', password: pass, aadhaarPhoto: file.name };
  db.customers.push(c); save(); closeModal();
  alert('Customer account created successfully.\nLogin ID: ' + mobile + '\nUse the password you created.');
}

function openForgot() {
  document.getElementById('modalRoot').classList.remove('hidden');
  document.getElementById('modalCard').innerHTML = `
    <div class="modal-head"><h2>🔐 Customer Forgot Password</h2><button class="close" onclick="closeModal()">×</button></div>
    <p class="muted">Verify your mobile number and last Aadhaar details, then create a new password.</p>
    <div class="form-grid">
      <div class="field"><label>Mobile Number *</label><input id="fpMobile" inputmode="numeric" maxlength="10" placeholder="Registered mobile number"></div>
      <div class="field"><label>Last 4 Digits of Aadhaar *</label><input id="fpAadhaar" inputmode="numeric" maxlength="4" placeholder="Last 4 digits"></div>
      <div class="field"><label>New Password *</label><input id="fpPass" type="password" placeholder="New password"></div>
      <div class="field"><label>Confirm New Password *</label><input id="fpConfirm" type="password" placeholder="Confirm new password"></div>
    </div>
    <div class="actions"><button class="btn btn-primary" onclick="resetCustomerPassword()">Update Password</button><button class="btn btn-light" onclick="closeModal()">Cancel</button></div>`;
}

function resetCustomerPassword() {
  const mobile = fpMobile.value.trim(), last4 = fpAadhaar.value.trim(), pass = fpPass.value, confirm = fpConfirm.value;
  if (!mobile || !/^\d{4}$/.test(last4) || !pass || !confirm) { alert('Please complete all fields.'); return; }
  if (pass !== confirm) { alert('New passwords do not match.'); return; }
  const c = db.customers.find(x => x.mobile === mobile);
  if (!c) { alert('Customer not found.'); return; }
  if (c.aadhaarLast4 && c.aadhaarLast4 !== last4) { alert('Aadhaar verification failed.'); return; }
  c.password = pass; save(); closeModal(); alert('Password updated successfully. Please login again.');
}

function closeModal() { document.getElementById('modalRoot').classList.add('hidden'); }

function customerServiceForm(service) {
  if (role !== 'customer') return '';
  const s = service.toLowerCase();
  let fields = '';
  if (s.includes('mobile update')) {
    fields = `<div class="field"><label>Mobile Number *</label><input id="svcMobile" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>
    <div class="field"><label>Aadhaar Number *</label><input id="svcAadhaar" inputmode="numeric" maxlength="12" placeholder="12-digit Aadhaar number"></div>
    <div class="field"><label>Consumer Number *</label><input id="svcConsumer" placeholder="Consumer number"></div>
    <div class="field"><label>Service ID</label><input value="Generated after submission" readonly></div>
    <div class="field full"><label>Card Photo *</label><div class="upload-box"><input id="svcCardPhoto" type="file" accept="image/*" capture="environment"><div class="muted">Select from Gallery or use Camera.</div></div></div>`;
  } else if (s === 'distributor' || s === 'lpg id' || s === 'last delivery') {
    fields = `<div class="field"><label>Consumer Number *</label><input id="svcConsumer" placeholder="Consumer number"></div>
    <div class="field"><label>Mobile Number *</label><input id="svcMobile" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>
    <div class="field"><label>Service ID</label><input value="Generated after submission" readonly></div>`;
  } else if (s === 'ekyc') {
    fields = `<div class="field"><label>Consumer Number *</label><input id="svcConsumer" placeholder="Consumer number"></div>
    <div class="field"><label>Mobile Number *</label><input id="svcMobile" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>
    <div class="field"><label>Aadhaar Number *</label><input id="svcAadhaar" inputmode="numeric" maxlength="12" placeholder="12-digit Aadhaar number"></div>
    <div class="field"><label>Service ID</label><input value="Generated after submission" readonly></div>`;
  } else if (s === 'lpg booking') {
    fields = `<div class="field"><label>Consumer Number *</label><input id="svcConsumer" placeholder="Consumer number"></div>
    <div class="field"><label>LPG ID *</label><input id="svcLpgId" placeholder="LPG ID"></div>
    <div class="field"><label>Service ID</label><input value="Generated after submission" readonly></div>`;
  } else {
    fields = `<div class="field"><label>Consumer Number *</label><input id="svcConsumer" placeholder="Consumer number"></div>
    <div class="field"><label>Mobile Number *</label><input id="svcMobile" inputmode="numeric" maxlength="10" placeholder="10-digit mobile number"></div>`;
  }
  return `<div class="service-box"><h3>📋 ${service} Details</h3><div class="form-grid">${fields}</div></div>`;
}

const runtimeServiceIds = new Set();
function notifyCustomer(customerId, title, text, serviceId) {
  if (!customerId) return;
  db.notifications = db.notifications || [];
  db.notifications.unshift({ id: 'N' + Date.now() + Math.floor(Math.random() * 1000), customerId, title, text, serviceId: serviceId || '', createdAt: new Date().toISOString(), read: false });
  db.notifications = db.notifications.slice(0, 300);
}

function notificationPage() {
  const list = role === 'customer' ? (db.notifications || []).filter(n => n.customerId === getCurrentCustomer()?.id) : (db.notifications || []);
  return title('🔔 Notifications', 'Application, booking, eKYC and service updates.') + `<div class="actions"><button class="btn btn-light" onclick="markAllNotificationsRead()">✓ Mark all as read</button></div><div class="section">${list.map(n => `<div class="card" style="border-left:4px solid ${n.read ? '#cbd5e1' : '#2563eb'};margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px"><div><b>${escapeHtml(n.title || 'Notification')}</b><p style="margin:6px 0">${escapeHtml(n.text || '')}</p>${n.serviceId ? `<small>Service ID: <b>${escapeHtml(n.serviceId)}</b></small>` : ''}</div><small class="muted">${escapeHtml(n.createdAt || '')}</small></div></div>`).join('') || '<div class="card empty">No notifications yet.</div>'}</div>`;
}

function markAllNotificationsRead() {
  const cid = role === 'customer' ? getCurrentCustomer()?.id : null;
  (db.notifications || []).forEach(n => { if (!cid || n.customerId === cid) n.read = true; });
  save(); render();
}

function randomServiceId() {
  let id;
  const used = new Set([...(db.requests || []), ...(db.vipRequests || []), ...(db.payments || []), ...(db.chats || [])].map(x => String(x.serviceId || '').replace(/\D/g, '')));
  do { id = String(Math.floor(100000 + Math.random() * 900000)); } while (used.has(id) || runtimeServiceIds.has(id));
  runtimeServiceIds.add(id); return id;
}

function getVipRecordForCustomer(c = getCurrentCustomer()) {
  if (!c) return null;
  return (db.vipRequests || []).filter(x => (x.customerId === c.id || x.customer === c.name || x.customer === c.id)).sort((a, b) => new Date(b.approvedAt || b.date || 0) - new Date(a.approvedAt || a.date || 0))[0] || null;
}

function vipActiveForCustomer() {
  if (role !== 'customer') return false;
  normalizeVipExpiry();
  const r = getVipRecordForCustomer();
  if (!r || r.status !== 'Approved') return false;
  if (r.expiresAt && Date.now() >= new Date(r.expiresAt).getTime()) { r.status = 'Expired'; save(); return false; }
  return true;
}

function vipExpiryText() { const r = getVipRecordForCustomer(); if (!r || !r.expiresAt) return '—'; return new Date(r.expiresAt).toLocaleDateString('en-IN'); }

function submitService(service) {
  const consumer = document.getElementById('svcConsumer')?.value.trim() || '';
  const mobile = document.getElementById('svcMobile')?.value.trim() || '';
  const aadhaar = document.getElementById('svcAadhaar')?.value.trim() || '';
  const lpgId = document.getElementById('svcLpgId')?.value.trim() || '';
  const photo = document.getElementById('svcCardPhoto')?.files?.[0];

  if (service === 'Service Status Check') {
    const raw = String(document.getElementById('statusServiceId')?.value || '');
    const sid = (raw.match(/\d/g) || []).join('').slice(0, 6);
    if (sid.length !== 6) { alert('Please enter exact 6-digit Service ID.'); return; }
    const norm = v => String(v ?? '').replace(/\D/g, '');
    const all = [
      ...(db.requests || []).map(x => ({ ...x, _source: 'Service Request' })),
      ...(db.vipRequests || []).map(x => ({ ...x, _source: 'VIP Subscription' })),
      ...(db.payments || []).map(x => ({ ...x, _source: 'Payment' })),
      ...(db.chats || []).map(x => ({ ...x, _source: 'Chat' }))
    ];
    const found = all.find(x => norm(x.serviceId) === sid);
    if (found) {
      alert(`Service Status: ${found.status || 'Pending'}\nService: ${found.type || found._source || 'Service'}\nService ID: ${sid}`);
    } else {
      alert(`Service ID ${sid} not found.`);
    }
    return;
  }
  if (service.includes('Mobile Update') && (!mobile || !/^\d{10}$/.test(mobile) || !/^\d{12}$/.test(aadhaar) || !consumer || !photo)) {
    alert('Mobile, 12-digit Aadhaar, Consumer Number and Card Photo are required.'); return;
  }
  if (service === 'eKYC' && (!consumer || !/^\d{10}$/.test(mobile) || !/^\d{12}$/.test(aadhaar))) {
    alert('Consumer Number, 10-digit Mobile and 12-digit Aadhaar are required.'); return;
  }
  if (service === 'LPG Booking' && (!consumer || !lpgId)) {
    alert('Consumer Number and LPG ID are required.'); return;
  }
  if (!service.includes('Mobile Update') && service !== 'eKYC' && service !== 'LPG Booking' && (!consumer || !/^\d{10}$/.test(mobile))) {
    alert('Consumer Number and valid 10-digit Mobile Number are required.'); return;
  }

  const serviceId = randomServiceId();
  const vipNow = vipActiveForCustomer();
  const amount = service.includes('VIP') ? (db.vipPrice || 199) : (vipNow ? 0 : (service.includes('Mobile Update') ? 150 : 0));
  const cc = getCurrentCustomer();
  db.requests.unshift({ id: 'R' + String(Date.now()).slice(-6), customerId: cc?.id || currentUser, customer: cc?.name || 'Customer', type: service, amount, status: 'Pending', date: new Date().toLocaleDateString(), createdAt: new Date().toISOString(), serviceId, consumer: cc?.consumer || consumer, mobile: cc?.mobile || mobile, lpgId: cc?.lpgId || lpgId, priority: vipNow ? 'VIP' : 'Normal' });
  notifyCustomer(cc?.id || currentUser, 'New ' + service + ' request', 'Your request has been submitted successfully and is Pending.', serviceId);
  db.logs.push({ time: new Date().toLocaleString(), role, action: service + ' submitted, Service ID ' + serviceId });
  save();
  alert(service + ' request submitted successfully.\nService ID: ' + serviceId);
}

function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[ch])); }

function render() {
  const m = document.getElementById('main');
  if (!m) return;
  if (role === 'customer' && isMaintenanceActive()) { m.innerHTML = maintenancePage(); return; }
  if (currentPage === 'Dashboard') { m.innerHTML = dashboard(); return; }
  if (currentPage === 'Owner Dashboard') { m.innerHTML = ownerDashboardPage(); return; }
  if (currentPage === 'Google Drive Backup') { m.innerHTML = googleDrivePage(); loadDriveFilesUI(); return; }
  m.innerHTML = genericPage(currentPage);
}

function googleDrivePage() {
  const token = window.driveService ? window.driveService.getToken() : null;
  const user = window.driveService ? window.driveService.getUser() : null;
  const isConnected = !!token;

  return title('📁 Google Drive Backup & Storage', 'Securely store and backup LPG portal data, delivery reports, and records to Google Drive.') +
  `<div class="card" style="max-width:850px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding-bottom:15px;border-bottom:1px solid var(--border)">
      <div>
        <h2 style="margin:0">Google Drive Status</h2>
        <p class="muted" style="margin:4px 0 0">${isConnected ? '✅ Connected as ' + escapeHtml(user?.email || 'Google User') : '🔒 Not connected. Connect your Google account with permission to store and view files.'}</p>
      </div>
      <div>
        ${isConnected
          ? `<button class="btn btn-danger" onclick="disconnectDriveUI()">Disconnect Drive</button>`
          : `<button class="btn btn-primary" onclick="connectDriveUI()">🌐 Connect Google Drive</button>`
        }
      </div>
    </div>

    ${isConnected ? `
    <div class="section">
      <h3>🚀 Quick Backups to Google Drive</h3>
      <p class="muted">1-click backup created and stored in your Google Drive:</p>
      <div class="actions">
        <button class="btn btn-primary" onclick="backupDatabaseToDrive()">💾 Backup Full Portal Database (JSON)</button>
        <button class="btn btn-light" onclick="backupDeliveriesToDrive()">🚚 Backup Delivery & Booking Report (CSV/Text)</button>
      </div>
      <div id="driveBackupStatus" class="notice" style="display:none;margin-top:12px"></div>
    </div>

    <div class="section">
      <h3>📋 Your Portal Files in Google Drive</h3>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>File Name</th><th>Created</th><th>Actions</th></tr>
          </thead>
          <tbody id="driveFilesList">
            <tr><td colspan="3" class="empty">Loading Google Drive files...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    ` : `
    <div class="section" style="text-align:center;padding:30px 15px">
      <div style="font-size:50px">📁</div>
      <h3>Connect Google Drive</h3>
      <p class="muted" style="max-width:540px;margin:10px auto">Save LPG bookings, customer service receipts, delivery logs, and database backups directly to your own Google Drive. Access them anytime from your mobile or PC.</p>
      <button class="btn btn-primary" style="font-size:16px;padding:12px 24px" onclick="connectDriveUI()">🌐 Connect Google Drive</button>
    </div>
    `}
  </div>`;
}

async function connectDriveUI() {
  try {
    if (!window.driveService) {
      alert('Google Drive service is loading. Please wait a moment.');
      return;
    }
    const res = await window.driveService.connect();
    alert('Connected successfully to Google Drive as ' + (res.user?.email || 'user'));
    render();
  } catch (err) {
    console.error('Drive connection error:', err);
    alert('Could not connect to Google Drive: ' + (err.message || err));
  }
}

async function disconnectDriveUI() {
  if (confirm('Disconnect Google Drive from this session?')) {
    if (window.driveService) await window.driveService.disconnect();
    render();
  }
}

async function backupDatabaseToDrive() {
  const statusEl = document.getElementById('driveBackupStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ Uploading database backup to Google Drive...';
  }
  try {
    const payload = JSON.stringify(db, null, 2);
    const fileName = `lpg-portal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const res = await window.driveService.upload(fileName, payload, 'application/json');
    if (statusEl) {
      statusEl.innerHTML = `✅ Backup saved to Google Drive: <b>${escapeHtml(res.name)}</b>! <a href="${res.webViewLink}" target="_blank" style="color:var(--blue);font-weight:bold">Open in Drive</a>`;
    }
    loadDriveFilesUI();
  } catch (err) {
    if (statusEl) statusEl.textContent = '❌ Upload failed: ' + (err.message || err);
  }
}

async function backupDeliveriesToDrive() {
  const statusEl = document.getElementById('driveBackupStatus');
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.textContent = '⏳ Uploading delivery report to Google Drive...';
  }
  try {
    const deliveries = db.deliveries || [];
    const content = "LPG SERVICE PORTAL - DELIVERY & BOOKING SUMMARY\n" +
      "Generated: " + new Date().toLocaleString() + "\n\n" +
      "Total Deliveries: " + deliveries.length + "\n" +
      "Total Bookings: " + (db.bookings || []).length + "\n\n" +
      JSON.stringify(deliveries, null, 2);
    const fileName = `lpg-deliveries-${new Date().toISOString().slice(0, 10)}.txt`;
    const res = await window.driveService.upload(fileName, content, 'text/plain');
    if (statusEl) {
      statusEl.innerHTML = `✅ Delivery report saved to Google Drive: <b>${escapeHtml(res.name)}</b>! <a href="${res.webViewLink}" target="_blank" style="color:var(--blue);font-weight:bold">Open in Drive</a>`;
    }
    loadDriveFilesUI();
  } catch (err) {
    if (statusEl) statusEl.textContent = '❌ Upload failed: ' + (err.message || err);
  }
}

async function loadDriveFilesUI() {
  const tbody = document.getElementById('driveFilesList');
  if (!tbody || !window.driveService || !window.driveService.getToken()) return;

  try {
    const files = await window.driveService.listFiles();
    if (!files || files.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">No files uploaded yet via this app.</td></tr>';
      return;
    }
    tbody.innerHTML = files.map(f => `
      <tr>
        <td><b>${escapeHtml(f.name)}</b></td>
        <td>${new Date(f.createdTime).toLocaleString()}</td>
        <td>
          ${f.webViewLink ? `<a class="btn btn-light" href="${f.webViewLink}" target="_blank" style="padding:6px 10px;text-decoration:none">🔗 Open in Drive</a>` : ''}
          <button class="btn btn-danger" style="padding:6px 10px;margin-left:5px" onclick="deleteDriveFileUI('${f.id}', '${escapeHtml(f.name).replace(/'/g, "\\'")}')">🗑 Delete</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" class="danger">Failed to load files: ${escapeHtml(err.message || err)}</td></tr>`;
  }
}

async function deleteDriveFileUI(fileId, fileName) {
  try {
    const deleted = await window.driveService.deleteFile(fileId, fileName);
    if (deleted) {
      alert(`"${fileName}" was deleted from Google Drive.`);
      loadDriveFilesUI();
    }
  } catch (err) {
    alert('Failed to delete file: ' + (err.message || err));
  }
}


function dashboard() {
  const c = getCurrentCustomer() || { name: 'Customer', consumer: '—', mobile: '—', lpgId: '—', distributor: '—', status: 'Active' };
  const vip = vipActiveForCustomer();
  return `<div class="customer-home">
    <section class="customer-main">
      <div class="welcome-card"><div><h1>Hello, ${c.name} 👋</h1><p>Welcome to ${portalName()}</p>${vip ? '<div class="vip-active-banner">👑 VIP ACTIVE — Priority service enabled</div>' : ''}</div><div class="welcome-art">🛢️</div></div>
      <div class="service-tiles">
        <button class="service-tile tile-red" onclick="go('LPG Booking')">🔥<b>Book LPG</b><span>${vip ? 'Instant Booking' : 'New Booking'}</span><em>→</em></button>
        <button class="service-tile tile-green" onclick="go('eKYC')">🪪<b>eKYC</b><span>Verify Now</span><em>→</em></button>
        <button class="service-tile tile-blue" onclick="go('Last Delivery')">🚚<b>Last Delivery</b><span>Check Details</span><em>→</em></button>
        <button class="service-tile tile-purple" onclick="go('LPG ID')">🆔<b>LPG ID</b><span>View LPG ID</span><em>→</em></button>
        <button class="service-tile tile-orange" onclick="go('Distributor')">🏪<b>Distributor</b><span>View Distributor</span><em>→</em></button>
      </div>
    </section>
  </div>`;
}

function ownerDashboardPage() {
  return title('📊 Owner Dashboard', 'Full management overview') + `<div class="grid">${stat('Customers', db.customers.length, '👥')}${stat('Payments', db.payments.length, '💳')}${stat('Requests', db.requests.length, '📋')}</div>`;
}

function genericPage(p) {
  if (role === 'customer') {
    return title(p, 'Customer service section.') + `<div class="card">${customerServiceForm(p)}<div class="actions"><button class="btn btn-primary" onclick="submitService('${p.replaceAll("'", "")}')">Submit Request</button></div></div>`;
  }
  return title(p, 'Section ready.') + `<div class="card"><div class="empty">📌 ${p}</div></div>`;
}

window.addEventListener('DOMContentLoaded', () => {
  applyPortalBranding();
  render();
});
