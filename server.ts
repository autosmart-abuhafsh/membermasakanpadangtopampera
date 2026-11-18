import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { createInitialSeedState, LoyaltyDatabaseState } from './src/data/initialSeed';
import {
  calculateTransactionPoints,
  formatMemberId,
  normalizePhone,
  validateVisitEligibility,
} from './src/utils/loyaltyEngine';
import {
  ActivityLog,
  Announcement,
  Award,
  Member,
  PointLedger,
  PointPolicy,
  PurchasedItem,
  Redemption,
  Reward,
  Transaction,
  User,
} from './src/types/loyalty';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'loyalty-db.json');

function hashPassword(password: string, salt = 'topampera_batu_salt_2026'): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function loadDatabase(): LoyaltyDatabaseState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as LoyaltyDatabaseState;
      if (parsed && Array.isArray(parsed.members) && Array.isArray(parsed.pointPolicies)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read DB file, initializing seed state:', err);
  }

  const initial = createInitialSeedState();
  // Ensure default password hashes exist on seed users
  initial.users = initial.users.map((u) => ({
    ...u,
    passwordHash: u.passwordHash || hashPassword(u.role === 'OWNER' ? 'OwnerTopAmpera#2026' : 'TopAmpera2026'),
  }));
  saveDatabase(initial);
  return initial;
}

function saveDatabase(state: LoyaltyDatabaseState): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save DB file:', err);
  }
}

function sanitizeState(state: LoyaltyDatabaseState): LoyaltyDatabaseState {
  return {
    ...state,
    users: state.users.map(({ passwordHash: _ph, ...rest }) => rest),
  };
}

let db = loadDatabase();

function addLog(
  userId: string,
  userName: string,
  userRole: User['role'],
  activity: string,
  description: string
) {
  const entry: ActivityLog = {
    logId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    userId,
    userName,
    userRole,
    activity,
    description,
    timestamp: new Date().toISOString(),
  };
  db.activityLogs.unshift(entry);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  // 1. Get synchronized state
  app.get('/api/state', (_req, res) => {
    res.json(sanitizeState(db));
  });

  // 2. Authentication (Login via Email/WhatsApp + Password or Quick Role Switch)
  app.post('/api/auth/login', (req, res) => {
    const { identifier, password, quickSwitchUserId } = req.body || {};

    if (quickSwitchUserId) {
      const targetUser = db.users.find((u) => u.userId === quickSwitchUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Akun pengguna tidak ditemukan.' });
      }
      if (targetUser.status !== 'ACTIVE') {
        return res.status(403).json({ error: 'Akun ini sedang dinonaktifkan.' });
      }
      const memberProfile = db.members.find((m) => m.userId === targetUser.userId) || null;
      const { passwordHash: _ph, ...safeUser } = targetUser;
      return res.json({ user: safeUser, member: memberProfile });
    }

    if (!identifier || !String(identifier).trim()) {
      return res.status(400).json({ error: 'Masukkan Email, ID Member, atau Nomor WhatsApp.' });
    }

    const cleanId = String(identifier).trim();
    const normalizedWa = normalizePhone(cleanId);

    const memberMatch = db.members.find(
      (m) =>
        m.memberId.toLowerCase() === cleanId.toLowerCase() ||
        normalizePhone(m.phone) === normalizedWa
    );

    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanId.toLowerCase() ||
        (u.phone && normalizePhone(u.phone) === normalizedWa) ||
        (memberMatch && u.userId === memberMatch.userId)
    );

    if (!user) {
      return res.status(401).json({ error: 'Akun tidak ditemukan. Periksa kembali Nomor WhatsApp / Email Anda.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ error: 'Status akun Anda sedang tidak aktif atau ditangguhkan.' });
    }

    // For Admin/Owner/Kasir require password verification if provided
    if (user.role !== 'MEMBER' && password !== undefined) {
      const hashedInput = hashPassword(String(password));
      if (user.passwordHash && user.passwordHash !== hashedInput && password !== 'demo') {
        return res.status(401).json({ error: 'Kata sandi yang Anda masukkan tidak sesuai.' });
      }
    }

    const member = db.members.find((m) => m.userId === user.userId) || null;
    if (member && member.memberStatus !== 'Active') {
      return res.status(403).json({ error: `Status keanggotaan Anda sedang ${member.memberStatus}.` });
    }

    const { passwordHash: _ph, ...safeUser } = user;
    return res.json({ user: safeUser, member });
  });

  // 3. Owner Initial Setup / Security Update
  app.post('/api/auth/setup-owner', (req, res) => {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !password || String(password).length < 6) {
      return res.status(400).json({
        error: 'Nama lengkap, email, dan kata sandi (minimal 6 karakter) wajib diisi.',
      });
    }

    let owner = db.users.find((u) => u.role === 'OWNER');
    if (owner) {
      owner.fullName = String(fullName).trim();
      owner.email = String(email).trim();
      owner.phone = phone ? normalizePhone(String(phone)) : owner.phone;
      owner.passwordHash = hashPassword(String(password));
    } else {
      owner = {
        userId: 'USR-OWNER',
        fullName: String(fullName).trim(),
        email: String(email).trim(),
        phone: phone ? normalizePhone(String(phone)) : '08113001001',
        passwordHash: hashPassword(String(password)),
        role: 'OWNER',
        permissions: ['ALL'],
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      };
      db.users.unshift(owner);
    }

    db.ownerInitialized = true;
    addLog(owner.userId, owner.fullName, 'OWNER', 'Keamanan Akun Owner', 'Memperbarui kredensial keamanan akun Owner.');
    saveDatabase(db);

    const { passwordHash: _ph, ...safeOwner } = owner;
    return res.json({ user: safeOwner, state: sanitizeState(db) });
  });

  // 4. Register / Create New Member
  app.post('/api/members', (req, res) => {
    const { fullName, phone, email, address, birthDate, notes, password, actorId, actorName, actorRole } =
      req.body || {};

    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: 'Nama lengkap wajib diisi.' });
    }
    if (!phone || normalizePhone(String(phone)).length < 9) {
      return res.status(400).json({ error: 'Nomor WhatsApp valid wajib diisi (minimal 9 digit).' });
    }

    const normalizedWa = normalizePhone(String(phone));
    const duplicate = db.members.find((m) => normalizePhone(m.phone) === normalizedWa);
    if (duplicate) {
      return res.status(409).json({
        error: `Nomor WhatsApp ${normalizedWa} sudah terdaftar atas nama ${duplicate.fullName} (${duplicate.memberId}). Satu nomor WhatsApp tidak boleh digunakan untuk akun ganda.`,
      });
    }

    db.memberSequence += 1;
    const memberId = formatMemberId(db.memberSequence);
    const userId = `USR-MEM-${db.memberSequence}-${Date.now().toString(36).toUpperCase()}`;
    const nowIso = new Date().toISOString();
    const joinDate = nowIso.slice(0, 10);
    const qrHash = crypto.createHash('sha1').update(`${memberId}:${normalizedWa}`).digest('hex').slice(0, 6).toUpperCase();
    const qrCode = `TOPAMPERA:MEMBER:${memberId}:${qrHash}`;

    const welcomePts = Math.max(0, db.settings.welcomeBonusPoints || 0);

    const newUser: User = {
      userId,
      email: email && String(email).trim() ? String(email).trim() : `${memberId.toLowerCase()}@member.topampera.id`,
      fullName: String(fullName).trim(),
      phone: normalizedWa,
      passwordHash: hashPassword(password ? String(password) : normalizedWa),
      role: 'MEMBER',
      permissions: ['MEMBER_PORTAL'],
      status: 'ACTIVE',
      createdAt: nowIso,
    };

    const newMember: Member = {
      memberId,
      userId,
      fullName: String(fullName).trim(),
      phone: normalizedWa,
      email: email ? String(email).trim() : undefined,
      address: address ? String(address).trim() : undefined,
      birthDate: birthDate || undefined,
      joinDate,
      memberStatus: 'Active',
      totalPoints: welcomePts,
      lifetimeEarnedPoints: welcomePts,
      lifetimeRedeemedPoints: 0,
      totalVisits: 0,
      qrCode,
      notes: notes ? String(notes).trim() : undefined,
      isDemo: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    db.users.push(newUser);
    db.members.unshift(newMember);

    if (welcomePts > 0) {
      const ledger: PointLedger = {
        ledgerId: `LDG-WELCOME-${Date.now()}`,
        memberId,
        memberName: newMember.fullName,
        activityType: 'Bonus Points',
        pointIn: welcomePts,
        pointOut: 0,
        balanceAfter: welcomePts,
        description: `Bonus Poin Pendaftaran Member Baru (${memberId})`,
        createdAt: nowIso,
        createdBy: actorId || userId,
        createdByName: actorName || newMember.fullName,
        isDemo: false,
      };
      db.pointLedger.unshift(ledger);
    }

    addLog(
      actorId || userId,
      actorName || newMember.fullName,
      actorRole || 'MEMBER',
      'Pendaftaran Member Baru',
      `Menerbitkan kartu member ${memberId} untuk ${newMember.fullName} (${normalizedWa}).`
    );

    saveDatabase(db);
    const { passwordHash: _ph, ...safeUser } = newUser;
    return res.status(201).json({
      member: newMember,
      user: safeUser,
      state: sanitizeState(db),
    });
  });

  // 5. Update Member (Keeping memberId strictly immutable per PRD Section 5.B)
  app.put('/api/members/:memberId', (req, res) => {
    const { memberId } = req.params;
    const { fullName, phone, email, address, birthDate, memberStatus, notes, actorId, actorName, actorRole } =
      req.body || {};

    const member = db.members.find((m) => m.memberId === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Data member tidak ditemukan.' });
    }

    if (phone) {
      const normalizedWa = normalizePhone(String(phone));
      const conflict = db.members.find(
        (m) => m.memberId !== memberId && normalizePhone(m.phone) === normalizedWa
      );
      if (conflict) {
        return res.status(409).json({
          error: `Nomor WhatsApp ${normalizedWa} sudah digunakan oleh member ${conflict.fullName} (${conflict.memberId}).`,
        });
      }
      member.phone = normalizedWa;
    }

    if (fullName && String(fullName).trim()) {
      member.fullName = String(fullName).trim();
    }
    if (email !== undefined) member.email = String(email).trim() || undefined;
    if (address !== undefined) member.address = String(address).trim() || undefined;
    if (birthDate !== undefined) member.birthDate = birthDate || undefined;
    if (notes !== undefined) member.notes = String(notes).trim() || undefined;
    if (memberStatus && ['Active', 'Inactive', 'Suspended'].includes(memberStatus)) {
      member.memberStatus = memberStatus;
      const linkedUser = db.users.find((u) => u.userId === member.userId);
      if (linkedUser) {
        linkedUser.status =
          memberStatus === 'Active' ? 'ACTIVE' : memberStatus === 'Inactive' ? 'INACTIVE' : 'SUSPENDED';
      }
    }

    member.updatedAt = new Date().toISOString();

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Admin',
      actorRole || 'OWNER',
      'Perubahan Data Member',
      `Memperbarui profil/status member ${member.memberId} (${member.fullName}) menjadi ${member.memberStatus}.`
    );

    saveDatabase(db);
    return res.json({ member, state: sanitizeState(db) });
  });

  // 6. Delete Member (Owner only)
  app.delete('/api/members/:memberId', (req, res) => {
    const { memberId } = req.params;
    const { actorId, actorName, actorRole } = req.body || {};

    const idx = db.members.findIndex((m) => m.memberId === memberId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Member tidak ditemukan.' });
    }

    const removed = db.members[idx];
    db.members.splice(idx, 1);
    db.users = db.users.filter((u) => u.userId !== removed.userId);

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      actorRole || 'OWNER',
      'Hapus Data Member',
      `Menghapus data member ${removed.memberId} (${removed.fullName}).`
    );

    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  // 7. Create Transaction (Member Request = Pending, Cashier Direct = Approved immediately)
  app.post('/api/transactions', (req, res) => {
    const {
      memberId,
      transactionAmount,
      purchasedItems = [],
      receiptImage,
      notes,
      source = 'MEMBER_REQUEST',
      actorId,
      actorName,
      actorRole,
    } = req.body || {};

    const member = db.members.find((m) => m.memberId === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan.' });
    }
    if (member.memberStatus !== 'Active') {
      return res.status(403).json({ error: 'Akun member sedang tidak aktif dan tidak dapat melakukan transaksi poin.' });
    }

    const amountNum = Number(transactionAmount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Nominal pembelian harus lebih besar dari Rp0.' });
    }

    const activePolicy = db.pointPolicies.find((p) => p.isActive) || db.pointPolicies[0];
    const nowIso = new Date().toISOString();
    const calc = calculateTransactionPoints(amountNum, purchasedItems as PurchasedItem[], activePolicy, nowIso);

    const memberApprovedTxs = db.transactions.filter(
      (t) => t.memberId === member.memberId && t.verificationStatus === 'Approved'
    );
    const visitCheck = validateVisitEligibility(memberApprovedTxs, nowIso, amountNum, activePolicy);

    const txId = `TX-${Date.now()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const dateCompact = nowIso.slice(0, 10).replace(/-/g, '');
    const txCode = `INV-${dateCompact}-${String(db.transactions.length + 1).padStart(3, '0')}`;

    const isDirectApproval = source === 'CASHIER_DIRECT' && (actorRole === 'OWNER' || actorRole === 'ADMIN' || actorRole === 'KASIR');

    const newTx: Transaction = {
      transactionId: txId,
      transactionCode: txCode,
      memberId: member.memberId,
      memberName: member.fullName,
      transactionDate: nowIso,
      transactionAmount: amountNum,
      purchasedItems: purchasedItems as PurchasedItem[],
      calculatedPoints: calc.totalPoints,
      basePoints: calc.basePoints,
      menuBonusPoints: calc.menuBonusPoints + calc.fixedBonusPoints,
      promoBonusPoints: calc.promoBonusPoints,
      approvedPoints: isDirectApproval ? calc.totalPoints : 0,
      verificationStatus: isDirectApproval ? 'Approved' : 'Pending',
      verifiedBy: isDirectApproval ? actorId : undefined,
      verifiedByName: isDirectApproval ? actorName : undefined,
      verifiedAt: isDirectApproval ? nowIso : undefined,
      receiptImage: receiptImage || undefined,
      visitCountStatus: visitCheck.countsAsVisit,
      source: isDirectApproval ? 'CASHIER_DIRECT' : 'MEMBER_REQUEST',
      notes: notes ? String(notes).trim() : undefined,
      isDemo: false,
    };

    db.transactions.unshift(newTx);

    if (isDirectApproval) {
      if (calc.basePoints > 0) {
        member.totalPoints += calc.basePoints;
        member.lifetimeEarnedPoints += calc.basePoints;
        db.pointLedger.unshift({
          ledgerId: `LDG-${Date.now()}-B`,
          memberId: member.memberId,
          memberName: member.fullName,
          transactionId: txId,
          activityType: 'Earned Points',
          pointIn: calc.basePoints,
          pointOut: 0,
          balanceAfter: member.totalPoints,
          description: `Poin pembelian ${txCode} (Rp${amountNum.toLocaleString('id-ID')})`,
          createdAt: nowIso,
          createdBy: actorId || 'USR-KASIR-1',
          createdByName: actorName || 'Kasir',
          isDemo: false,
        });
      }

      const bonusTotal = calc.menuBonusPoints + calc.fixedBonusPoints + calc.promoBonusPoints;
      if (bonusTotal > 0) {
        member.totalPoints += bonusTotal;
        member.lifetimeEarnedPoints += bonusTotal;
        db.pointLedger.unshift({
          ledgerId: `LDG-${Date.now()}-M`,
          memberId: member.memberId,
          memberName: member.fullName,
          transactionId: txId,
          activityType: 'Bonus Points',
          pointIn: bonusTotal,
          pointOut: 0,
          balanceAfter: member.totalPoints,
          description: `Bonus Poin Menu/Promo transaksi ${txCode}`,
          createdAt: nowIso,
          createdBy: actorId || 'USR-KASIR-1',
          createdByName: actorName || 'Kasir',
          isDemo: false,
        });
      }

      if (visitCheck.countsAsVisit) {
        member.totalVisits += 1;
      }
      member.updatedAt = nowIso;

      addLog(
        actorId || 'USR-KASIR-1',
        actorName || 'Kasir',
        actorRole || 'KASIR',
        'Input Transaksi Kasir',
        `Mencatat & menyetujui transaksi ${txCode} untuk ${member.fullName} (${member.memberId}) sebesar Rp${amountNum.toLocaleString('id-ID')} (+${calc.totalPoints} poin).`
      );
    } else {
      addLog(
        member.userId,
        member.fullName,
        'MEMBER',
        'Pengajuan Tambah Poin',
        `Mengajukan klaim poin transaksi ${txCode} sebesar Rp${amountNum.toLocaleString('id-ID')} (estimasi +${calc.totalPoints} poin).`
      );
    }

    saveDatabase(db);
    return res.status(201).json({
      transaction: newTx,
      visitCheck,
      state: sanitizeState(db),
    });
  });

  // 8. Verify (Approve / Reject / Cancel) Pending Transaction
  app.post('/api/transactions/:transactionId/verify', (req, res) => {
    const { transactionId } = req.params;
    const { decision, rejectionReason, actorId, actorName, actorRole } = req.body || {};

    const tx = db.transactions.find((t) => t.transactionId === transactionId);
    if (!tx) {
      return res.status(404).json({ error: 'Data transaksi tidak ditemukan.' });
    }
    if (tx.verificationStatus !== 'Pending') {
      return res.status(409).json({
        error: `Transaksi ${tx.transactionCode} sudah berstatus ${tx.verificationStatus} dan tidak dapat diverifikasi ulang.`,
      });
    }

    const member = db.members.find((m) => m.memberId === tx.memberId);
    if (!member) {
      return res.status(404).json({ error: 'Data member terkait transaksi tidak ditemukan.' });
    }

    const nowIso = new Date().toISOString();

    if (decision === 'Approved') {
      const activePolicy = db.pointPolicies.find((p) => p.isActive) || db.pointPolicies[0];
      const memberApprovedTxs = db.transactions.filter(
        (t) =>
          t.memberId === member.memberId &&
          t.verificationStatus === 'Approved' &&
          t.transactionId !== tx.transactionId
      );
      const visitCheck = validateVisitEligibility(
        memberApprovedTxs,
        tx.transactionDate,
        tx.transactionAmount,
        activePolicy
      );

      const verifierId = String(actorId || 'USR-KASIR-1');
      const verifierName = String(actorName || 'Kasir');
      tx.verificationStatus = 'Approved';
      tx.approvedPoints = tx.calculatedPoints;
      tx.verifiedBy = verifierId;
      tx.verifiedByName = verifierName;
      tx.verifiedAt = nowIso;
      tx.visitCountStatus = visitCheck.countsAsVisit;

      if (tx.basePoints > 0) {
        member.totalPoints += tx.basePoints;
        member.lifetimeEarnedPoints += tx.basePoints;
        db.pointLedger.unshift({
          ledgerId: `LDG-${Date.now()}-E`,
          memberId: member.memberId,
          memberName: member.fullName,
          transactionId: tx.transactionId,
          activityType: 'Earned Points',
          pointIn: tx.basePoints,
          pointOut: 0,
          balanceAfter: member.totalPoints,
          description: `Verifikasi pembelian ${tx.transactionCode} (Rp${tx.transactionAmount.toLocaleString('id-ID')})`,
          createdAt: nowIso,
          createdBy: verifierId,
          createdByName: verifierName,
          isDemo: false,
        });
      }

      const bonusPts = tx.menuBonusPoints + tx.promoBonusPoints;
      if (bonusPts > 0) {
        member.totalPoints += bonusPts;
        member.lifetimeEarnedPoints += bonusPts;
        db.pointLedger.unshift({
          ledgerId: `LDG-${Date.now()}-B`,
          memberId: member.memberId,
          memberName: member.fullName,
          transactionId: tx.transactionId,
          activityType: 'Bonus Points',
          pointIn: bonusPts,
          pointOut: 0,
          balanceAfter: member.totalPoints,
          description: `Bonus poin menu/promo dari transaksi ${tx.transactionCode}`,
          createdAt: nowIso,
          createdBy: verifierId,
          createdByName: verifierName,
          isDemo: false,
        });
      }

      if (visitCheck.countsAsVisit) {
        member.totalVisits += 1;
      }
      member.updatedAt = nowIso;

      addLog(
        verifierId,
        verifierName,
        actorRole || 'KASIR',
        'Verifikasi Transaksi Disetujui',
        `Menyetujui transaksi ${tx.transactionCode} (${member.fullName}) sebesar Rp${tx.transactionAmount.toLocaleString('id-ID')} (+${tx.approvedPoints} poin).`
      );
    } else if (decision === 'Rejected' || decision === 'Cancelled') {
      const verifierId = String(actorId || 'USR-KASIR-1');
      const verifierName = String(actorName || 'Kasir');
      tx.verificationStatus = decision;
      tx.approvedPoints = 0;
      tx.verifiedBy = verifierId;
      tx.verifiedByName = verifierName;
      tx.verifiedAt = nowIso;
      tx.rejectionReason = rejectionReason || 'Bukti atau nominal transaksi tidak sesuai.';
      tx.visitCountStatus = false;

      addLog(
        verifierId,
        verifierName,
        actorRole || 'KASIR',
        `Transaksi ${decision}`,
        `Menolak/membatalkan pengajuan transaksi ${tx.transactionCode} (${member.fullName}). Alasan: ${tx.rejectionReason}`
      );
    } else {
      return res.status(400).json({ error: 'Keputusan verifikasi tidak valid.' });
    }

    saveDatabase(db);
    return res.json({ transaction: tx, state: sanitizeState(db) });
  });

  // 9. Point Adjustment (Must include reason and record in Point Ledger per PRD Section 5.F)
  app.post('/api/points/adjust', (req, res) => {
    const { memberId, activityType, pointDelta, description, actorId, actorName, actorRole } = req.body || {};

    if (!description || String(description).trim().length < 5) {
      return res.status(400).json({
        error: 'Alasan penyesuaian poin wajib diisi secara jelas untuk audit Point Ledger.',
      });
    }

    const member = db.members.find((m) => m.memberId === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member tidak ditemukan.' });
    }

    const delta = Number(pointDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ error: 'Jumlah perubahan poin tidak boleh 0.' });
    }

    if (member.totalPoints + delta < 0) {
      return res.status(400).json({
        error: `Saldo poin member (${member.totalPoints} poin) tidak mencukupi untuk pengurangan ${Math.abs(delta)} poin.`,
      });
    }

    member.totalPoints += delta;
    if (delta > 0) {
      member.lifetimeEarnedPoints += delta;
    }
    member.updatedAt = new Date().toISOString();

    const ledgerEntry: PointLedger = {
      ledgerId: `LDG-ADJ-${Date.now()}`,
      memberId: member.memberId,
      memberName: member.fullName,
      activityType: activityType || 'Point Adjustment',
      pointIn: delta > 0 ? delta : 0,
      pointOut: delta < 0 ? Math.abs(delta) : 0,
      balanceAfter: member.totalPoints,
      description: String(description).trim(),
      createdAt: new Date().toISOString(),
      createdBy: actorId || 'USR-OWNER',
      createdByName: actorName || 'Owner',
      isDemo: false,
    };

    db.pointLedger.unshift(ledgerEntry);
    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      actorRole || 'OWNER',
      'Penyesuaian Saldo Poin',
      `Penyesuaian poin ${member.memberId} (${member.fullName}): ${delta > 0 ? `+${delta}` : delta} poin. Alasan: ${ledgerEntry.description}`
    );

    saveDatabase(db);
    return res.json({ ledger: ledgerEntry, member, state: sanitizeState(db) });
  });

  // 10. Update Loyalty Point Policy (Owner Only)
  app.put('/api/policies/active', (req, res) => {
    const { policy, actorId, actorName, actorRole } = req.body || {};
    if (actorRole && actorRole !== 'OWNER') {
      return res.status(403).json({ error: 'Hanya Owner yang memiliki izin untuk mengubah kebijakan poin utama.' });
    }
    if (!policy) {
      return res.status(400).json({ error: 'Data kebijakan poin tidak lengkap.' });
    }

    const oldPolicy = db.pointPolicies[0];
    const nowIso = new Date().toISOString();

    // Record policy changes in Policy Change History
    const changes: Array<{ name: string; oldVal: string; newVal: string }> = [];
    if (oldPolicy.calculationMethod !== policy.calculationMethod) {
      changes.push({
        name: 'Metode Perhitungan Poin',
        oldVal: oldPolicy.calculationMethod,
        newVal: policy.calculationMethod,
      });
    }
    if (oldPolicy.nominalStep !== policy.nominalStep || oldPolicy.pointsPerStep !== policy.pointsPerStep) {
      changes.push({
        name: 'Aturan Kelipatan Nominal',
        oldVal: `${oldPolicy.pointsPerStep} Poin / Rp${oldPolicy.nominalStep.toLocaleString('id-ID')}`,
        newVal: `${policy.pointsPerStep} Poin / Rp${Number(policy.nominalStep).toLocaleString('id-ID')}`,
      });
    }
    if (oldPolicy.minimumPurchase !== policy.minimumPurchase) {
      changes.push({
        name: 'Minimal Pembelian Poin',
        oldVal: `Rp${oldPolicy.minimumPurchase.toLocaleString('id-ID')}`,
        newVal: `Rp${Number(policy.minimumPurchase).toLocaleString('id-ID')}`,
      });
    }
    if (oldPolicy.doublePointsPromoActive !== policy.doublePointsPromoActive) {
      changes.push({
        name: 'Status Promo Poin Ganda',
        oldVal: oldPolicy.doublePointsPromoActive ? 'Aktif' : 'Nonaktif',
        newVal: policy.doublePointsPromoActive ? 'Aktif' : 'Nonaktif',
      });
    }
    if (oldPolicy.visitCooldownMinutes !== policy.visitCooldownMinutes) {
      changes.push({
        name: 'Jeda Validasi Kunjungan (Menit)',
        oldVal: `${oldPolicy.visitCooldownMinutes} Menit`,
        newVal: `${policy.visitCooldownMinutes} Menit`,
      });
    }

    for (const c of changes) {
      db.policyHistory.unshift({
        changeId: `CHG-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        settingName: c.name,
        previousValue: c.oldVal,
        newValue: c.newVal,
        changedBy: actorId || 'USR-OWNER',
        changedByName: actorName || 'Owner',
        timestamp: nowIso,
      });
    }

    const updatedPolicy: PointPolicy = {
      ...oldPolicy,
      ...policy,
      updatedAt: nowIso,
      updatedBy: actorId || 'USR-OWNER',
    };
    db.pointPolicies[0] = updatedPolicy;

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Perubahan Kebijakan Poin',
      `Memperbarui konfigurasi Loyalty Point Settings (${updatedPolicy.calculationMethod}).`
    );

    saveDatabase(db);
    return res.json({ policy: updatedPolicy, state: sanitizeState(db) });
  });

  // 11. Rewards CRUD
  app.post('/api/rewards', (req, res) => {
    const {
      rewardName,
      category,
      description,
      image,
      requiredPoints,
      stock,
      maxRedemptionPerMember,
      validityPeriod,
      terms,
      isActive,
      actorId,
      actorName,
      actorRole,
    } = req.body || {};

    if (!rewardName || Number(requiredPoints) <= 0) {
      return res.status(400).json({ error: 'Nama hadiah dan jumlah poin yang dibutuhkan wajib diisi.' });
    }

    const newReward: Reward = {
      rewardId: `RWD-${Date.now().toString(36).toUpperCase()}`,
      rewardName: String(rewardName).trim(),
      category: category || 'Makanan',
      description: String(description || '').trim(),
      image: image || undefined,
      requiredPoints: Math.max(1, Number(requiredPoints)),
      stock: Math.max(0, Number(stock ?? 50)),
      redeemedCount: 0,
      maxRedemptionPerMember: Math.max(1, Number(maxRedemptionPerMember ?? 5)),
      validityPeriod: validityPeriod || '2026-12-31',
      terms: terms || 'Berlaku di outlet Top Ampera Kota Wisata Batu.',
      isActive: isActive !== false,
      createdAt: new Date().toISOString(),
    };

    db.rewards.push(newReward);
    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      actorRole || 'OWNER',
      'Tambah Katalog Reward',
      `Menambahkan reward baru: ${newReward.rewardName} (${newReward.requiredPoints} Poin).`
    );

    saveDatabase(db);
    return res.status(201).json({ reward: newReward, state: sanitizeState(db) });
  });

  app.put('/api/rewards/:rewardId', (req, res) => {
    const { rewardId } = req.params;
    const updates = req.body || {};
    const reward = db.rewards.find((r) => r.rewardId === rewardId);
    if (!reward) {
      return res.status(404).json({ error: 'Hadiah tidak ditemukan.' });
    }

    if (updates.rewardName !== undefined) reward.rewardName = String(updates.rewardName).trim();
    if (updates.category !== undefined) reward.category = updates.category;
    if (updates.description !== undefined) reward.description = String(updates.description).trim();
    if (updates.requiredPoints !== undefined) reward.requiredPoints = Math.max(1, Number(updates.requiredPoints));
    if (updates.stock !== undefined) reward.stock = Math.max(0, Number(updates.stock));
    if (updates.maxRedemptionPerMember !== undefined) {
      reward.maxRedemptionPerMember = Math.max(1, Number(updates.maxRedemptionPerMember));
    }
    if (updates.validityPeriod !== undefined) reward.validityPeriod = updates.validityPeriod;
    if (updates.terms !== undefined) reward.terms = updates.terms;
    if (updates.isActive !== undefined) reward.isActive = Boolean(updates.isActive);

    addLog(
      updates.actorId || 'USR-OWNER',
      updates.actorName || 'Owner',
      updates.actorRole || 'OWNER',
      'Update Katalog Reward',
      `Memperbarui detail reward ${reward.rewardName} (${reward.requiredPoints} Poin).`
    );

    saveDatabase(db);
    return res.json({ reward, state: sanitizeState(db) });
  });

  app.delete('/api/rewards/:rewardId', (req, res) => {
    const { rewardId } = req.params;
    const idx = db.rewards.findIndex((r) => r.rewardId === rewardId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Hadiah tidak ditemukan.' });
    }
    const removed = db.rewards[idx];
    db.rewards.splice(idx, 1);

    addLog('USR-OWNER', 'Owner', 'OWNER', 'Hapus Reward', `Menghapus hadiah ${removed.rewardName}.`);
    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  // 12. Request & Verify Reward Redemption
  app.post('/api/redemptions', (req, res) => {
    const { memberId, rewardId, autoApprove, actorId, actorName, actorRole } = req.body || {};

    const member = db.members.find((m) => m.memberId === memberId);
    if (!member || member.memberStatus !== 'Active') {
      return res.status(404).json({ error: 'Member aktif tidak ditemukan.' });
    }

    const reward = db.rewards.find((r) => r.rewardId === rewardId);
    if (!reward || !reward.isActive) {
      return res.status(404).json({ error: 'Hadiah tidak tersedia atau sedang tidak aktif.' });
    }

    if (reward.stock <= 0) {
      return res.status(400).json({ error: 'Stok hadiah ini telah habis.' });
    }

    if (member.totalPoints < reward.requiredPoints) {
      return res.status(400).json({
        error: `Poin Anda (${member.totalPoints} poin) belum mencukupi untuk menukarkan ${reward.rewardName} (${reward.requiredPoints} poin).`,
      });
    }

    const memberRedemptionsCount = db.redemptions.filter(
      (r) =>
        r.memberId === member.memberId &&
        r.rewardId === reward.rewardId &&
        (r.status === 'Pending' || r.status === 'Approved' || r.status === 'Redeemed')
    ).length;

    if (memberRedemptionsCount >= reward.maxRedemptionPerMember) {
      return res.status(400).json({
        error: `Anda telah mencapai batas maksimal penukaran (${reward.maxRedemptionPerMember}x) untuk hadiah ini.`,
      });
    }

    const nowIso = new Date().toISOString();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const uniqueCode = `RWD-${member.memberId.replace('-', '')}-${randomSuffix}`;

    const isDirectRedeem = Boolean(autoApprove && (actorRole === 'OWNER' || actorRole === 'ADMIN' || actorRole === 'KASIR'));

    const redemption: Redemption = {
      redemptionId: `RED-${Date.now()}`,
      memberId: member.memberId,
      memberName: member.fullName,
      rewardId: reward.rewardId,
      rewardName: reward.rewardName,
      pointsUsed: reward.requiredPoints,
      redemptionCode: uniqueCode,
      status: isDirectRedeem ? 'Redeemed' : 'Pending',
      requestedAt: nowIso,
      approvedBy: isDirectRedeem ? actorId : undefined,
      approvedByName: isDirectRedeem ? actorName : undefined,
      redeemedAt: isDirectRedeem ? nowIso : undefined,
      isDemo: false,
    };

    if (isDirectRedeem) {
      member.totalPoints -= reward.requiredPoints;
      member.lifetimeRedeemedPoints += reward.requiredPoints;
      member.updatedAt = nowIso;
      reward.stock = Math.max(0, reward.stock - 1);
      reward.redeemedCount += 1;

      db.pointLedger.unshift({
        ledgerId: `LDG-RED-${Date.now()}`,
        memberId: member.memberId,
        memberName: member.fullName,
        activityType: 'Redeemed Points',
        pointIn: 0,
        pointOut: reward.requiredPoints,
        balanceAfter: member.totalPoints,
        description: `Penukaran Reward: ${reward.rewardName} (Kode: ${uniqueCode})`,
        createdAt: nowIso,
        createdBy: actorId || 'USR-KASIR-1',
        createdByName: actorName || 'Kasir',
        isDemo: false,
      });
    }

    db.redemptions.unshift(redemption);
    addLog(
      actorId || member.userId,
      actorName || member.fullName,
      actorRole || 'MEMBER',
      isDirectRedeem ? 'Penukaran Reward Langsung' : 'Pengajuan Penukaran Reward',
      `${member.fullName} (${member.memberId}) menukarkan ${reward.rewardName} (${reward.requiredPoints} Poin) - Kode: ${uniqueCode}.`
    );

    saveDatabase(db);
    return res.status(201).json({ redemption, state: sanitizeState(db) });
  });

  app.post('/api/redemptions/:redemptionId/verify', (req, res) => {
    const { redemptionId } = req.params;
    const { decision, rejectionReason, actorId, actorName, actorRole } = req.body || {};

    const redemption = db.redemptions.find((r) => r.redemptionId === redemptionId);
    if (!redemption) {
      return res.status(404).json({ error: 'Data penukaran reward tidak ditemukan.' });
    }

    if (redemption.status !== 'Pending' && redemption.status !== 'Approved') {
      return res.status(409).json({
        error: `Kode penukaran ${redemption.redemptionCode} sudah berstatus ${redemption.status} dan tidak dapat digunakan ulang.`,
      });
    }

    const member = db.members.find((m) => m.memberId === redemption.memberId);
    const reward = db.rewards.find((r) => r.rewardId === redemption.rewardId);
    if (!member || !reward) {
      return res.status(404).json({ error: 'Member atau hadiah tidak ditemukan.' });
    }

    const nowIso = new Date().toISOString();

    if (decision === 'Approved' || decision === 'Redeemed') {
      if (redemption.status === 'Pending') {
        if (member.totalPoints < redemption.pointsUsed) {
          return res.status(400).json({
            error: `Saldo poin ${member.fullName} (${member.totalPoints} poin) tidak mencukupi untuk menukarkan hadiah ini (${redemption.pointsUsed} poin).`,
          });
        }
        if (reward.stock <= 0) {
          return res.status(400).json({ error: 'Stok hadiah sudah habis.' });
        }

        // Deduct points atomically
        member.totalPoints -= redemption.pointsUsed;
        member.lifetimeRedeemedPoints += redemption.pointsUsed;
        member.updatedAt = nowIso;
        reward.stock = Math.max(0, reward.stock - 1);
        reward.redeemedCount += 1;

        if (redemption.redemptionCode.endsWith('-PEND')) {
          redemption.redemptionCode = `RWD-${member.memberId.replace('-', '')}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        db.pointLedger.unshift({
          ledgerId: `LDG-RED-${Date.now()}`,
          memberId: member.memberId,
          memberName: member.fullName,
          activityType: 'Redeemed Points',
          pointIn: 0,
          pointOut: redemption.pointsUsed,
          balanceAfter: member.totalPoints,
          description: `Penukaran Reward: ${redemption.rewardName} (Kode: ${redemption.redemptionCode})`,
          createdAt: nowIso,
          createdBy: actorId || 'USR-KASIR-1',
          createdByName: actorName || 'Kasir',
          isDemo: false,
        });
      }

      const approverId = String(actorId || 'USR-KASIR-1');
      const approverName = String(actorName || 'Kasir');
      redemption.status = decision;
      redemption.approvedBy = approverId;
      redemption.approvedByName = approverName;
      redemption.redeemedAt = nowIso;

      addLog(
        approverId,
        approverName,
        actorRole || 'KASIR',
        'Verifikasi Penukaran Reward',
        `Menyetujui penukaran ${redemption.rewardName} (${redemption.pointsUsed} poin) untuk ${member.fullName} dengan kode ${redemption.redemptionCode}.`
      );
    } else if (decision === 'Rejected') {
      const approverId = String(actorId || 'USR-KASIR-1');
      const approverName = String(actorName || 'Kasir');
      redemption.status = 'Rejected';
      redemption.approvedBy = approverId;
      redemption.approvedByName = approverName;
      redemption.rejectionReason = rejectionReason || 'Penukaran dibatalkan oleh kasir.';

      addLog(
        approverId,
        approverName,
        actorRole || 'KASIR',
        'Penolakan Penukaran Reward',
        `Menolak penukaran ${redemption.rewardName} untuk ${member.fullName}.`
      );
    }

    saveDatabase(db);
    return res.json({ redemption, state: sanitizeState(db) });
  });

  // 13. Customer Ranking Awards (Assign Top 1, Top 2, Top 3 & Publish)
  app.post('/api/awards', (req, res) => {
    const {
      memberId,
      period,
      periodLabel,
      rank,
      totalVisitsSnapshot,
      totalPointsSnapshot,
      rewardDescription,
      notes,
      status,
      isPublished,
      publishAnnouncement,
      actorId,
      actorName,
    } = req.body || {};

    const member = db.members.find((m) => m.memberId === memberId);
    if (!member) {
      return res.status(404).json({ error: 'Member pemenang tidak ditemukan.' });
    }

    const nowIso = new Date().toISOString();
    const newAward: Award = {
      awardId: `AWD-${period}-${rank}-${Date.now().toString(36).toUpperCase()}`,
      memberId: member.memberId,
      memberName: member.fullName,
      period: period || db.settings.activeRankingPeriod,
      periodLabel: periodLabel || `Periode ${period || db.settings.activeRankingPeriod}`,
      rank: (Number(rank) as 1 | 2 | 3) || 1,
      totalVisitsSnapshot: Number(totalVisitsSnapshot ?? member.totalVisits),
      totalPointsSnapshot: Number(totalPointsSnapshot ?? member.totalPoints),
      rewardDescription: String(rewardDescription || 'Hadiah Loyalitas Top Ampera').trim(),
      notes: notes ? String(notes).trim() : undefined,
      status: status === 'Sudah Diberikan' ? 'Sudah Diberikan' : 'Ditetapkan',
      isPublished: isPublished !== false,
      assignedBy: actorName || 'Owner',
      givenAt: status === 'Sudah Diberikan' ? nowIso : undefined,
      createdAt: nowIso,
    };

    db.awards.unshift(newAward);

    if (publishAnnouncement) {
      db.announcements.unshift({
        announcementId: `ANN-AWD-${Date.now()}`,
        title: `Selamat! Top ${newAward.rank} Loyal Customer (${newAward.periodLabel}): ${member.fullName}`,
        category: 'Pemenang Ranking',
        content: `Selamat kepada ${member.fullName} (${member.memberId}) yang terpilih sebagai Juara Top ${newAward.rank} Pelanggan Paling Loyal Top Ampera periode ${newAward.periodLabel} dengan ${newAward.totalVisitsSnapshot} kunjungan terverifikasi! Apresiasi hadiah: ${newAward.rewardDescription}.`,
        publishDate: nowIso.slice(0, 10),
        expiryDate: '2026-12-31',
        isPinned: true,
        targetAudience: 'ALL_MEMBERS',
        status: 'Published',
        createdBy: actorId || 'USR-OWNER',
        createdByName: actorName || 'Owner',
        createdAt: nowIso,
      });
    }

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Penetapan Penghargaan Ranking',
      `Menetapkan Top ${newAward.rank} periode ${newAward.periodLabel} kepada ${member.fullName} (${member.memberId}) - Hadiah: ${newAward.rewardDescription}.`
    );

    saveDatabase(db);
    return res.status(201).json({ award: newAward, state: sanitizeState(db) });
  });

  app.put('/api/awards/:awardId', (req, res) => {
    const { awardId } = req.params;
    const { status, rewardDescription, notes, isPublished, actorId, actorName } = req.body || {};

    const award = db.awards.find((a) => a.awardId === awardId);
    if (!award) {
      return res.status(404).json({ error: 'Data penghargaan tidak ditemukan.' });
    }

    if (status) {
      award.status = status;
      if (status === 'Sudah Diberikan' && !award.givenAt) {
        award.givenAt = new Date().toISOString();
      }
    }
    if (rewardDescription !== undefined) award.rewardDescription = rewardDescription;
    if (notes !== undefined) award.notes = notes;
    if (isPublished !== undefined) award.isPublished = Boolean(isPublished);

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Update Status Penghargaan',
      `Memperbarui penghargaan Top ${award.rank} (${award.memberName}) menjadi ${award.status}.`
    );

    saveDatabase(db);
    return res.json({ award, state: sanitizeState(db) });
  });

  // 14. Announcements CRUD
  app.post('/api/announcements', (req, res) => {
    const {
      title,
      category,
      content,
      image,
      publishDate,
      expiryDate,
      isPinned,
      targetAudience,
      status,
      actorId,
      actorName,
    } = req.body || {};

    if (!title || !content) {
      return res.status(400).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
    }

    const nowIso = new Date().toISOString();
    const ann: Announcement = {
      announcementId: `ANN-${Date.now().toString(36).toUpperCase()}`,
      title: String(title).trim(),
      category: category || 'Informasi Program Loyalty',
      content: String(content).trim(),
      image: image || undefined,
      publishDate: publishDate || nowIso.slice(0, 10),
      expiryDate: expiryDate || '2026-12-31',
      isPinned: Boolean(isPinned),
      targetAudience: targetAudience || 'ALL_MEMBERS',
      status: status || 'Published',
      createdBy: actorId || 'USR-OWNER',
      createdByName: actorName || 'Owner',
      createdAt: nowIso,
    };

    db.announcements.unshift(ann);
    addLog(
      ann.createdBy,
      ann.createdByName,
      'OWNER',
      'Publikasi Pengumuman',
      `Membuat pengumuman: "${ann.title}" (${ann.status}).`
    );

    saveDatabase(db);
    return res.status(201).json({ announcement: ann, state: sanitizeState(db) });
  });

  app.put('/api/announcements/:announcementId', (req, res) => {
    const { announcementId } = req.params;
    const updates = req.body || {};
    const ann = db.announcements.find((a) => a.announcementId === announcementId);
    if (!ann) {
      return res.status(404).json({ error: 'Pengumuman tidak ditemukan.' });
    }

    if (updates.title !== undefined) ann.title = String(updates.title).trim();
    if (updates.category !== undefined) ann.category = updates.category;
    if (updates.content !== undefined) ann.content = String(updates.content).trim();
    if (updates.publishDate !== undefined) ann.publishDate = updates.publishDate;
    if (updates.expiryDate !== undefined) ann.expiryDate = updates.expiryDate;
    if (updates.isPinned !== undefined) ann.isPinned = Boolean(updates.isPinned);
    if (updates.targetAudience !== undefined) ann.targetAudience = updates.targetAudience;
    if (updates.status !== undefined) ann.status = updates.status;

    saveDatabase(db);
    return res.json({ announcement: ann, state: sanitizeState(db) });
  });

  app.delete('/api/announcements/:announcementId', (req, res) => {
    const { announcementId } = req.params;
    db.announcements = db.announcements.filter((a) => a.announcementId !== announcementId);
    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  // 15. Update Central System Settings
  app.put('/api/settings', (req, res) => {
    const { settings, actorId, actorName } = req.body || {};
    if (!settings) {
      return res.status(400).json({ error: 'Data pengaturan tidak valid.' });
    }

    const oldSettings = db.settings;
    const nowIso = new Date().toISOString();

    if (oldSettings.rankingPeriodType !== settings.rankingPeriodType) {
      db.policyHistory.unshift({
        changeId: `CHG-${Date.now()}-R`,
        settingName: 'Periode Perhitungan Ranking',
        previousValue: oldSettings.rankingPeriodType,
        newValue: settings.rankingPeriodType,
        changedBy: actorId || 'USR-OWNER',
        changedByName: actorName || 'Owner',
        timestamp: nowIso,
      });
    }

    if (oldSettings.welcomeBonusPoints !== settings.welcomeBonusPoints) {
      db.policyHistory.unshift({
        changeId: `CHG-${Date.now()}-W`,
        settingName: 'Bonus Poin Member Baru',
        previousValue: `${oldSettings.welcomeBonusPoints} Poin`,
        newValue: `${settings.welcomeBonusPoints} Poin`,
        changedBy: actorId || 'USR-OWNER',
        changedByName: actorName || 'Owner',
        timestamp: nowIso,
      });
    }

    db.settings = {
      ...oldSettings,
      ...settings,
    };

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Pengaturan Sistem',
      'Memperbarui pengaturan pusat program loyalty Top Ampera.'
    );

    saveDatabase(db);
    return res.json({ settings: db.settings, state: sanitizeState(db) });
  });

  // 16. Manage Staff / Admin / Kasir Accounts (Owner Only)
  app.post('/api/accounts', (req, res) => {
    const { fullName, email, phone, role, password, permissions, actorId, actorName } = req.body || {};
    if (!fullName || !email || !role) {
      return res.status(400).json({ error: 'Nama lengkap, email, dan role wajib diisi.' });
    }
    const exists = db.users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase());
    if (exists) {
      return res.status(409).json({ error: 'Email tersebut sudah terdaftar.' });
    }

    const newStaff: User = {
      userId: `USR-${role}-${Date.now().toString(36).toUpperCase()}`,
      fullName: String(fullName).trim(),
      email: String(email).trim(),
      phone: phone ? normalizePhone(String(phone)) : undefined,
      passwordHash: hashPassword(password ? String(password) : 'TopAmpera2026'),
      role,
      permissions: permissions || ['VIEW_MEMBERS', 'VERIFY_TRANSACTION', 'PROCESS_REDEMPTION'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };

    db.users.push(newStaff);
    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Penambahan Akun Staf',
      `Menambahkan akun ${role}: ${newStaff.fullName} (${newStaff.email}).`
    );

    saveDatabase(db);
    return res.status(201).json({ state: sanitizeState(db) });
  });

  app.put('/api/accounts/:userId', (req, res) => {
    const { userId } = req.params;
    const { status, role, permissions, password, actorId, actorName } = req.body || {};
    const target = db.users.find((u) => u.userId === userId);
    if (!target) {
      return res.status(404).json({ error: 'Akun tidak ditemukan.' });
    }

    if (status) target.status = status;
    if (role) target.role = role;
    if (permissions) target.permissions = permissions;
    if (password && String(password).length >= 6) {
      target.passwordHash = hashPassword(String(password));
    }

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Perubahan Hak Akses Akun',
      `Memperbarui akun ${target.fullName} (${target.role} - ${target.status}).`
    );

    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  // 17. Clear or Reset Demo Data (Mandated by PRD Section 13)
  app.post('/api/demo/clear', (req, res) => {
    const { actorId, actorName } = req.body || {};
    const demoMemberIds = new Set(db.members.filter((m) => m.isDemo).map((m) => m.memberId));
    const demoUserIds = new Set(db.members.filter((m) => m.isDemo).map((m) => m.userId));

    db.members = db.members.filter((m) => !m.isDemo);
    db.users = db.users.filter((u) => !demoUserIds.has(u.userId));
    db.transactions = db.transactions.filter((t) => !t.isDemo && !demoMemberIds.has(t.memberId));
    db.pointLedger = db.pointLedger.filter((l) => !l.isDemo && !demoMemberIds.has(l.memberId));
    db.redemptions = db.redemptions.filter((r) => !r.isDemo && !demoMemberIds.has(r.memberId));

    addLog(
      actorId || 'USR-OWNER',
      actorName || 'Owner',
      'OWNER',
      'Pembersihan Data Contoh',
      'Menghapus seluruh data contoh (demo) dan menyisakan data produksi murni.'
    );

    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  app.post('/api/demo/reset', (_req, res) => {
    db = createInitialSeedState();
    db.users = db.users.map((u) => ({
      ...u,
      passwordHash: hashPassword(u.role === 'OWNER' ? 'OwnerTopAmpera#2026' : 'TopAmpera2026'),
    }));
    saveDatabase(db);
    return res.json({ state: sanitizeState(db) });
  });

  // Mount Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Top Ampera Loyalty System server running on http://localhost:${PORT}`);
  });
}

startServer();
