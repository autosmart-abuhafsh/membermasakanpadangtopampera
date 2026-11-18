import {
  Member,
  PointPolicy,
  PurchasedItem,
  RankingEntry,
  Reward,
  SystemSettings,
  Transaction,
} from '../types/loyalty';

export interface PointCalculationBreakdown {
  eligible: boolean;
  reason?: string;
  basePoints: number;
  menuBonusPoints: number;
  fixedBonusPoints: number;
  promoBonusPoints: number;
  totalPoints: number;
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('628')) {
    return '0' + digits.slice(2);
  }
  if (digits.startsWith('8')) {
    return '0' + digits;
  }
  return digits;
}

export function formatMemberId(sequenceNumber: number): string {
  const safeNum = Math.max(1, Math.floor(sequenceNumber));
  return `TA-${String(safeNum).padStart(4, '0')}`;
}

export function calculateTransactionPoints(
  transactionAmount: number,
  purchasedItems: PurchasedItem[],
  policy: PointPolicy,
  referenceDateIso?: string
): PointCalculationBreakdown {
  if (!policy.isActive) {
    return {
      eligible: false,
      reason: 'Kebijakan poin sedang tidak aktif.',
      basePoints: 0,
      menuBonusPoints: 0,
      fixedBonusPoints: 0,
      promoBonusPoints: 0,
      totalPoints: 0,
    };
  }

  if (transactionAmount < policy.minimumPurchase) {
    return {
      eligible: false,
      reason: `Minimal pembelian untuk mendapatkan poin adalah Rp${policy.minimumPurchase.toLocaleString('id-ID')}.`,
      basePoints: 0,
      menuBonusPoints: 0,
      fixedBonusPoints: 0,
      promoBonusPoints: 0,
      totalPoints: 0,
    };
  }

  let basePoints = 0;

  if (policy.calculationMethod === 'NOMINAL_MULTIPLIER') {
    const step = Math.max(1000, policy.nominalStep || 25000);
    const ratio = transactionAmount / step;
    let multiples = Math.floor(ratio);
    if (policy.roundingMode === 'ROUND') {
      multiples = Math.round(ratio);
    } else if (policy.roundingMode === 'CEIL') {
      multiples = Math.ceil(ratio);
    }
    basePoints = Math.max(0, multiples * policy.pointsPerStep);
  } else if (policy.calculationMethod === 'NOMINAL_RANGE') {
    const sortedRules = [...policy.rangeRules].sort((a, b) => a.minAmount - b.minAmount);
    for (const rule of sortedRules) {
      const meetsMin = transactionAmount >= rule.minAmount;
      const meetsMax = rule.maxAmount === null || transactionAmount <= rule.maxAmount;
      if (meetsMin && meetsMax) {
        basePoints = rule.points;
        break;
      }
    }
  } else if (policy.calculationMethod === 'MENU_BASED') {
    // Base points still give 1 per step if configured, or strictly menu based
    const step = Math.max(1000, policy.nominalStep || 25000);
    basePoints = Math.floor(transactionAmount / step) * policy.pointsPerStep;
  }

  let menuBonusPoints = 0;
  if (policy.enableMenuBonus || policy.calculationMethod === 'MENU_BASED') {
    for (const item of purchasedItems) {
      if (item.qty > 0) {
        const rule = policy.menuRules.find(
          (r) => r.isActive && (r.menuId === item.menuId || r.menuName.toLowerCase() === item.menuName.toLowerCase())
        );
        const bonusPerUnit = rule ? rule.bonusPoints : item.bonusPointsPerItem || 0;
        menuBonusPoints += item.qty * bonusPerUnit;
      }
    }
  }

  const fixedBonusPoints = Math.max(0, policy.fixedBonusPerTransaction || 0);
  const subtotalPoints = basePoints + menuBonusPoints + fixedBonusPoints;

  let promoBonusPoints = 0;
  if (policy.doublePointsPromoActive && policy.promoMultiplier > 1) {
    const refTime = referenceDateIso ? new Date(referenceDateIso).getTime() : Date.now();
    const startOk = !policy.promoStartDate || refTime >= new Date(policy.promoStartDate).getTime();
    const endOk = !policy.promoEndDate || refTime <= new Date(policy.promoEndDate + 'T23:59:59').getTime();
    if (startOk && endOk) {
      promoBonusPoints = Math.round(subtotalPoints * (policy.promoMultiplier - 1));
    }
  }

  let totalPoints = subtotalPoints + promoBonusPoints;
  if (policy.maximumPointsPerTransaction > 0 && totalPoints > policy.maximumPointsPerTransaction) {
    totalPoints = policy.maximumPointsPerTransaction;
  }

  return {
    eligible: totalPoints > 0,
    reason: totalPoints === 0 ? 'Transaksi belum memenuhi syarat perolehan poin.' : undefined,
    basePoints,
    menuBonusPoints,
    fixedBonusPoints,
    promoBonusPoints,
    totalPoints,
  };
}

export function validateVisitEligibility(
  existingMemberApprovedTransactions: Transaction[],
  newTransactionDateIso: string,
  transactionAmount: number,
  policy: PointPolicy
): { countsAsVisit: boolean; reason: string } {
  const minVisitAmt = policy.allTransactionsCountAsVisit ? 0 : policy.minimumVisitPurchase;
  if (transactionAmount < minVisitAmt) {
    return {
      countsAsVisit: false,
      reason: `Nominal di bawah batas minimum kunjungan (Rp${minVisitAmt.toLocaleString('id-ID')}).`,
    };
  }

  const cooldownMs = Math.max(0, policy.visitCooldownMinutes || 0) * 60 * 1000;
  if (cooldownMs > 0) {
    const newTime = new Date(newTransactionDateIso).getTime();
    const recentVisit = existingMemberApprovedTransactions.find((tx) => {
      if (tx.verificationStatus !== 'Approved' || !tx.visitCountStatus) return false;
      const txTime = new Date(tx.transactionDate).getTime();
      return Math.abs(newTime - txTime) < cooldownMs;
    });
    if (recentVisit) {
      return {
        countsAsVisit: false,
        reason: `Transaksi dalam jeda ${policy.visitCooldownMinutes} menit dari kunjungan terverifikasi sebelumnya (${recentVisit.transactionCode}).`,
      };
    }
  }

  return {
    countsAsVisit: true,
    reason: 'Memenuhi syarat sebagai kunjungan valid.',
  };
}

export function computeCustomerRankings(
  members: Member[],
  transactions: Transaction[],
  settings: SystemSettings,
  periodOverride?: string
): RankingEntry[] {
  const activeMembers = members.filter((m) => m.memberStatus === 'Active');
  const targetPeriod = periodOverride || settings.activeRankingPeriod;

  const entries: RankingEntry[] = activeMembers.map((member) => {
    const memberApprovedTxs = transactions.filter((tx) => {
      if (tx.memberId !== member.memberId || tx.verificationStatus !== 'Approved') {
        return false;
      }
      const txDate = tx.transactionDate.slice(0, 10);
      if (settings.rankingPeriodType === 'MONTHLY' && targetPeriod && targetPeriod !== 'ALL') {
        return tx.transactionDate.startsWith(targetPeriod);
      }
      if (settings.rankingPeriodType === 'ANNUAL' && targetPeriod && targetPeriod !== 'ALL') {
        return tx.transactionDate.startsWith(targetPeriod.slice(0, 4));
      }
      if (settings.rankingStartDate && txDate < settings.rankingStartDate) {
        return false;
      }
      if (settings.rankingEndDate && txDate > settings.rankingEndDate) {
        return false;
      }
      return true;
    });

    const verifiedVisitsFromTxs = memberApprovedTxs.filter((tx) => tx.visitCountStatus).length;
    const pointsFromTxs = memberApprovedTxs.reduce((sum, tx) => sum + tx.approvedPoints, 0);
    const totalSpend = memberApprovedTxs.reduce((sum, tx) => sum + tx.transactionAmount, 0);

    // If ALL_TIME or matching current snapshot, ensure compatibility with member record
    const totalVisits =
      settings.rankingPeriodType === 'ALL_TIME'
        ? Math.max(member.totalVisits, verifiedVisitsFromTxs)
        : verifiedVisitsFromTxs;
    const totalPoints =
      settings.rankingPeriodType === 'ALL_TIME'
        ? Math.max(member.totalPoints, pointsFromTxs)
        : pointsFromTxs;

    const latestTx = [...memberApprovedTxs].sort((a, b) =>
      b.transactionDate.localeCompare(a.transactionDate)
    )[0];

    return {
      rankingId: `RNK-${member.memberId}-${targetPeriod || 'ALL'}`,
      memberId: member.memberId,
      memberName: member.fullName,
      memberPhoto: member.photo,
      joinDate: member.joinDate,
      period: targetPeriod || 'Sepanjang Waktu',
      totalVisits,
      totalPoints,
      totalSpend,
      lastVisitDate: latestTx?.transactionDate,
      rankPosition: 0,
    };
  });

  entries.sort((a, b) => {
    if (settings.rankingPrimaryIndicator === 'POINTS') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
    } else {
      // Primary indicator: VISITS (as mandated in PRD Section 5.H)
      if (b.totalVisits !== a.totalVisits) return b.totalVisits - a.totalVisits;
    }

    // Tie-breaker rules
    if (settings.rankingTieBreaker === 'POINTS') {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend;
    } else if (settings.rankingTieBreaker === 'TOTAL_SPEND') {
      if (b.totalSpend !== a.totalSpend) return b.totalSpend - a.totalSpend;
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    }

    return a.joinDate.localeCompare(b.joinDate);
  });

  return entries.map((entry, idx) => ({
    ...entry,
    rankPosition: idx + 1,
  }));
}

export function calculateNextRewardProgress(
  currentPoints: number,
  rewards: Reward[]
): {
  nextReward: Reward | null;
  pointsNeeded: number;
  progressPercent: number;
  redeemableCount: number;
} {
  const activeRewards = rewards
    .filter((r) => r.isActive && r.stock > 0)
    .sort((a, b) => a.requiredPoints - b.requiredPoints);

  if (activeRewards.length === 0) {
    return {
      nextReward: null,
      pointsNeeded: 0,
      progressPercent: 100,
      redeemableCount: 0,
    };
  }

  const redeemableCount = activeRewards.filter((r) => currentPoints >= r.requiredPoints).length;
  const nextTarget = activeRewards.find((r) => r.requiredPoints > currentPoints);

  if (!nextTarget) {
    const highestReward = activeRewards[activeRewards.length - 1];
    return {
      nextReward: highestReward,
      pointsNeeded: 0,
      progressPercent: 100,
      redeemableCount,
    };
  }

  const pointsNeeded = Math.max(0, nextTarget.requiredPoints - currentPoints);
  const progressPercent = Math.min(
    100,
    Math.max(0, Math.round((currentPoints / nextTarget.requiredPoints) * 100))
  );

  return {
    nextReward: nextTarget,
    pointsNeeded,
    progressPercent,
    redeemableCount,
  };
}

/**
 * Generates a deterministic 21x21 boolean QR matrix with standard 7x7 finder patterns
 * at top-left, top-right, and bottom-left corners, timing patterns, and encoded payload bits.
 */
export function generateQrMatrix(payload: string): boolean[][] {
  const size = 21;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const placeFinder = (rowOffset: number, colOffset: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = rowOffset + r;
        const cc = colOffset + c;
        if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
          reserved[rr][cc] = true;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
            const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
            matrix[rr][cc] = isBorder || isInner;
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    reserved[6][i] = true;
    reserved[i][6] = true;
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic bit stream from payload string
  let hash = 2166136261;
  const bytes: number[] = [];
  for (let i = 0; i < payload.length; i++) {
    const code = payload.charCodeAt(i);
    bytes.push(code);
    hash ^= code;
    hash = Math.imul(hash, 16777619);
  }

  let bitIndex = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c]) {
        const byteVal = bytes[bitIndex % bytes.length] || 0;
        const shift = bitIndex % 8;
        const mixed = ((byteVal >> shift) ^ ((hash >> (bitIndex % 16)) & 1) ^ ((r + c) % 2)) & 1;
        matrix[r][c] = mixed === 1;
        bitIndex++;
      }
    }
  }

  return matrix;
}
