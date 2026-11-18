import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNextRewardProgress,
  calculateTransactionPoints,
  computeCustomerRankings,
  formatMemberId,
  generateQrMatrix,
  normalizePhone,
  validateVisitEligibility,
} from './loyaltyEngine';
import { Member, PointPolicy, Reward, SystemSettings, Transaction } from '../types/loyalty';

const samplePolicy: PointPolicy = {
  policyId: 'POL-1',
  policyName: 'Kebijakan Standar Top Ampera',
  calculationMethod: 'NOMINAL_MULTIPLIER',
  nominalStep: 25000,
  pointsPerStep: 2,
  roundingMode: 'FLOOR',
  rangeRules: [
    { id: 'r1', minAmount: 10000, maxAmount: 24999, points: 1 },
    { id: 'r2', minAmount: 25000, maxAmount: 49999, points: 3 },
    { id: 'r3', minAmount: 50000, maxAmount: 99999, points: 5 },
    { id: 'r4', minAmount: 100000, maxAmount: null, points: 10 },
  ],
  enableMenuBonus: true,
  menuRules: [
    { menuId: 'M-RENDANG', menuName: 'Rendang Sapi Spesial', category: 'Lauk Utama', defaultPrice: 28000, bonusPoints: 2, isActive: true },
    { menuId: 'M-AYAMBAKAR', menuName: 'Ayam Bakar Padang', category: 'Lauk Utama', defaultPrice: 24000, bonusPoints: 1, isActive: true },
  ],
  minimumPurchase: 25000,
  maximumPointsPerTransaction: 50,
  fixedBonusPerTransaction: 0,
  doublePointsPromoActive: false,
  promoMultiplier: 2,
  promoName: 'Promo Akhir Pekan',
  promoStartDate: '2026-11-01',
  promoEndDate: '2026-11-30',
  pointsCanExpire: true,
  expiryMonths: 12,
  allTransactionsCountAsVisit: false,
  minimumVisitPurchase: 25000,
  visitCooldownMinutes: 120,
  termsAndConditions: 'Poin berlaku 12 bulan.',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  isActive: true,
  updatedAt: '2026-11-01T00:00:00Z',
  updatedBy: 'OWNER',
};

test('formatMemberId formats sequential IDs as TA-0001', () => {
  assert.equal(formatMemberId(1), 'TA-0001');
  assert.equal(formatMemberId(12), 'TA-0012');
  assert.equal(formatMemberId(105), 'TA-0105');
});

test('normalizePhone normalizes Indonesian WhatsApp numbers consistently', () => {
  assert.equal(normalizePhone('+62 812-3456-7890'), '081234567890');
  assert.equal(normalizePhone('6281234567890'), '081234567890');
  assert.equal(normalizePhone('0812-3456-7890'), '081234567890');
});

test('calculateTransactionPoints Method 1 (Nominal Multiplier) matches PRD examples', () => {
  // PRD: setiap Rp25.000 mendapatkan 2 poin: Rp25k=2, Rp50k=4, Rp75k=6, Rp100k=8
  const policyNoMenu = { ...samplePolicy, enableMenuBonus: false };
  assert.equal(calculateTransactionPoints(25000, [], policyNoMenu).totalPoints, 2);
  assert.equal(calculateTransactionPoints(50000, [], policyNoMenu).totalPoints, 4);
  assert.equal(calculateTransactionPoints(75000, [], policyNoMenu).totalPoints, 6);
  assert.equal(calculateTransactionPoints(100000, [], policyNoMenu).totalPoints, 8);
  // Floor rounding: Rp49.000 -> 1 multiple -> 2 points
  assert.equal(calculateTransactionPoints(49000, [], policyNoMenu).totalPoints, 2);
});

test('calculateTransactionPoints Method 2 (Nominal Range) & Method 3 (Menu Bonus)', () => {
  const rangePolicy: PointPolicy = {
    ...samplePolicy,
    calculationMethod: 'NOMINAL_RANGE',
    minimumPurchase: 10000,
  };
  // Rp60.000 falls into 50.000-99.999 = 5 base points + 2 Rendang (4 bonus points) = 9 points
  const res = calculateTransactionPoints(
    60000,
    [{ menuId: 'M-RENDANG', menuName: 'Rendang Sapi Spesial', qty: 2, price: 28000, bonusPointsPerItem: 2 }],
    rangePolicy
  );
  assert.equal(res.basePoints, 5);
  assert.equal(res.menuBonusPoints, 4);
  assert.equal(res.totalPoints, 9);
});

test('validateVisitEligibility prevents splitting visits within cooldown window', () => {
  const existingTxs: Transaction[] = [
    {
      transactionId: 'TX-1',
      transactionCode: 'INV-20261117-001',
      memberId: 'TA-0001',
      memberName: 'Budi Santoso',
      transactionDate: '2026-11-17T12:00:00.000Z',
      transactionAmount: 50000,
      purchasedItems: [],
      calculatedPoints: 4,
      basePoints: 4,
      menuBonusPoints: 0,
      promoBonusPoints: 0,
      approvedPoints: 4,
      verificationStatus: 'Approved',
      visitCountStatus: true,
      source: 'CASHIER_DIRECT',
    },
  ];

  // 30 minutes later -> should be blocked from counting as a second visit (cooldown is 120 mins)
  const checkTooSoon = validateVisitEligibility(
    existingTxs,
    '2026-11-17T12:30:00.000Z',
    50000,
    samplePolicy
  );
  assert.equal(checkTooSoon.countsAsVisit, false);

  // 3 hours later -> counts as a valid new visit
  const checkLater = validateVisitEligibility(
    existingTxs,
    '2026-11-17T15:05:00.000Z',
    50000,
    samplePolicy
  );
  assert.equal(checkLater.countsAsVisit, true);
});

test('computeCustomerRankings sorts Top 1, Top 2, Top 3 by verified visits then points', () => {
  const members: Member[] = [
    {
      memberId: 'TA-0001',
      userId: 'U1',
      fullName: 'Siti Rahmawati',
      phone: '0811111111',
      joinDate: '2026-01-10',
      memberStatus: 'Active',
      totalPoints: 120,
      lifetimeEarnedPoints: 120,
      lifetimeRedeemedPoints: 0,
      totalVisits: 5,
      qrCode: 'TA-0001',
      createdAt: '2026-01-10',
      updatedAt: '2026-11-10',
    },
    {
      memberId: 'TA-0002',
      userId: 'U2',
      fullName: 'Hendra Wijaya',
      phone: '0822222222',
      joinDate: '2026-01-05',
      memberStatus: 'Active',
      totalPoints: 80,
      lifetimeEarnedPoints: 80,
      lifetimeRedeemedPoints: 0,
      totalVisits: 9,
      qrCode: 'TA-0002',
      createdAt: '2026-01-05',
      updatedAt: '2026-11-10',
    },
  ];

  const settings: SystemSettings = {
    restaurantName: 'Top Ampera',
    branchLocation: 'Kota Wisata Batu',
    address: 'Jl. Diponegoro No. 88, Kota Wisata Batu',
    phoneContact: '0812-3456-7890',
    slogan: 'Kelezatan Asli Minang di Jantung Kota Wisata Batu',
    cardFrontTitle: 'TOP AMPERA MEMBER',
    cardLabel: 'Loyalty Member',
    cardTerms: [],
    rankingPeriodType: 'ALL_TIME',
    activeRankingPeriod: '2026-11',
    rankingStartDate: '',
    rankingEndDate: '',
    rankingPrimaryIndicator: 'VISITS',
    rankingTieBreaker: 'POINTS',
    publicLeaderboardNames: true,
    rank1RewardDefault: 'Voucher Makan Gratis',
    rank2RewardDefault: 'Gratis 1 Porsi Nasi Padang',
    rank3RewardDefault: 'Gratis Minuman',
    allowSelfRegistration: true,
    welcomeBonusPoints: 5,
    requireReceiptUpload: false,
  };

  const rankings = computeCustomerRankings(members, [], settings);
  assert.equal(rankings[0].memberId, 'TA-0002'); // 9 visits beats 5 visits even with fewer points
  assert.equal(rankings[0].rankPosition, 1);
  assert.equal(rankings[1].memberId, 'TA-0001');
  assert.equal(rankings[1].rankPosition, 2);
});

test('calculateNextRewardProgress matches PRD 22 points -> target 30 points -> 8 needed', () => {
  const rewards: Reward[] = [
    {
      rewardId: 'RW-1',
      rewardName: 'Gratis Es Teh',
      category: 'Minuman',
      description: 'Es teh manis segar',
      requiredPoints: 10,
      stock: 50,
      redeemedCount: 0,
      maxRedemptionPerMember: 5,
      validityPeriod: '2026-12-31',
      terms: 'Berlaku makan di tempat',
      isActive: true,
      createdAt: '2026-01-01',
    },
    {
      rewardId: 'RW-2',
      rewardName: 'Gratis 1 Porsi Nasi Padang',
      category: 'Makanan',
      description: 'Pilihan lauk rendang/ayam',
      requiredPoints: 30,
      stock: 30,
      redeemedCount: 0,
      maxRedemptionPerMember: 3,
      validityPeriod: '2026-12-31',
      terms: 'Berlaku setiap hari',
      isActive: true,
      createdAt: '2026-01-01',
    },
  ];

  const progress = calculateNextRewardProgress(22, rewards);
  assert.equal(progress.nextReward?.rewardName, 'Gratis 1 Porsi Nasi Padang');
  assert.equal(progress.pointsNeeded, 8);
  assert.equal(progress.progressPercent, 73);
  assert.equal(progress.redeemableCount, 1);
});

test('generateQrMatrix produces a 21x21 matrix with intact finder patterns', () => {
  const matrix = generateQrMatrix('TOPAMPERA:MEMBER:TA-0001');
  assert.equal(matrix.length, 21);
  assert.equal(matrix[0].length, 21);
  assert.equal(matrix[0][0], true);
  assert.equal(matrix[2][2], true);
});
