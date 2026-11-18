export type UserRole = 'OWNER' | 'ADMIN' | 'KASIR' | 'MEMBER';
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type MemberStatus = 'Active' | 'Inactive' | 'Suspended';
export type VerificationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
export type LedgerActivityType =
  | 'Earned Points'
  | 'Bonus Points'
  | 'Redeemed Points'
  | 'Point Adjustment'
  | 'Expired Points'
  | 'Reversal Points';
export type CalculationMethod = 'NOMINAL_MULTIPLIER' | 'NOMINAL_RANGE' | 'MENU_BASED';
export type RoundingMode = 'FLOOR' | 'ROUND' | 'CEIL';
export type RedemptionStatus = 'Available' | 'Pending' | 'Approved' | 'Redeemed' | 'Rejected' | 'Expired';
export type RankingPeriodType = 'MONTHLY' | 'ANNUAL' | 'ALL_TIME';

export interface User {
  userId: string;
  email: string;
  fullName: string;
  phone?: string;
  passwordHash?: string;
  role: UserRole;
  permissions: string[];
  status: AccountStatus;
  createdAt: string;
}

export interface Member {
  memberId: string; // e.g., TA-0001 (immutable)
  userId: string;
  fullName: string;
  phone: string;
  email?: string;
  photo?: string;
  address?: string;
  birthDate?: string;
  joinDate: string;
  memberStatus: MemberStatus;
  totalPoints: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  totalVisits: number;
  qrCode: string;
  notes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PurchasedItem {
  menuId: string;
  menuName: string;
  qty: number;
  price: number;
  bonusPointsPerItem: number;
}

export interface Transaction {
  transactionId: string;
  transactionCode: string;
  memberId: string;
  memberName: string;
  transactionDate: string;
  transactionAmount: number;
  purchasedItems: PurchasedItem[];
  calculatedPoints: number;
  basePoints: number;
  menuBonusPoints: number;
  promoBonusPoints: number;
  approvedPoints: number;
  verificationStatus: VerificationStatus;
  verifiedBy?: string;
  verifiedByName?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  receiptImage?: string;
  visitCountStatus: boolean; // true if counted as an eligible verified visit
  source: 'MEMBER_REQUEST' | 'CASHIER_DIRECT';
  notes?: string;
  isDemo?: boolean;
}

export interface PointLedger {
  ledgerId: string;
  memberId: string;
  memberName: string;
  transactionId?: string;
  activityType: LedgerActivityType;
  pointIn: number;
  pointOut: number;
  balanceAfter: number;
  description: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  isDemo?: boolean;
}

export interface NominalRangeRule {
  id: string;
  minAmount: number;
  maxAmount: number | null; // null means and above
  points: number;
}

export interface MenuBonusRule {
  menuId: string;
  menuName: string;
  category: string;
  defaultPrice: number;
  bonusPoints: number;
  isActive: boolean;
}

export interface PointPolicy {
  policyId: string;
  policyName: string;
  calculationMethod: CalculationMethod;
  nominalStep: number; // e.g., 25000
  pointsPerStep: number; // e.g., 2
  roundingMode: RoundingMode;
  rangeRules: NominalRangeRule[];
  enableMenuBonus: boolean;
  menuRules: MenuBonusRule[];
  minimumPurchase: number;
  maximumPointsPerTransaction: number; // 0 means unlimited
  fixedBonusPerTransaction: number;
  doublePointsPromoActive: boolean;
  promoMultiplier: number; // e.g., 2
  promoName: string;
  promoStartDate: string;
  promoEndDate: string;
  pointsCanExpire: boolean;
  expiryMonths: number;
  allTransactionsCountAsVisit: boolean;
  minimumVisitPurchase: number;
  visitCooldownMinutes: number; // Prevents splitting 1 visit into multiple transactions
  termsAndConditions: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface Reward {
  rewardId: string;
  rewardName: string;
  category: 'Makanan' | 'Minuman' | 'Voucher Diskon' | 'Spesial';
  description: string;
  image?: string;
  requiredPoints: number;
  stock: number;
  redeemedCount: number;
  maxRedemptionPerMember: number;
  validityPeriod: string;
  terms: string;
  isActive: boolean;
  createdAt: string;
}

export interface Redemption {
  redemptionId: string;
  memberId: string;
  memberName: string;
  rewardId: string;
  rewardName: string;
  pointsUsed: number;
  redemptionCode: string;
  status: RedemptionStatus;
  requestedAt: string;
  approvedBy?: string;
  approvedByName?: string;
  redeemedAt?: string;
  rejectionReason?: string;
  isDemo?: boolean;
}

export interface RankingEntry {
  rankingId: string;
  memberId: string;
  memberName: string;
  memberPhoto?: string;
  joinDate: string;
  period: string;
  totalVisits: number;
  totalPoints: number;
  totalSpend: number;
  lastVisitDate?: string;
  rankPosition: number;
  awardStatus?: 'Belum Ditetapkan' | 'Ditetapkan' | 'Sudah Diberikan';
  awardDescription?: string;
}

export interface Announcement {
  announcementId: string;
  title: string;
  category:
    | 'Informasi Program Loyalty'
    | 'Promo Khusus Member'
    | 'Bonus Poin'
    | 'Promo Tanggal Tertentu'
    | 'Menu Baru'
    | 'Pemenang Ranking'
    | 'Operasional Restoran'
    | 'Informasi Penting';
  content: string;
  image?: string;
  publishDate: string;
  expiryDate: string;
  isPinned: boolean;
  targetAudience: 'ALL_MEMBERS' | 'TOP_MEMBERS' | 'NEW_MEMBERS';
  status: 'Draft' | 'Published' | 'Archived';
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface Award {
  awardId: string;
  memberId: string;
  memberName: string;
  period: string; // e.g., "2026-11"
  periodLabel: string; // e.g., "November 2026"
  rank: 1 | 2 | 3;
  totalVisitsSnapshot: number;
  totalPointsSnapshot: number;
  rewardDescription: string;
  notes?: string;
  status: 'Ditetapkan' | 'Sudah Diberikan';
  isPublished: boolean;
  assignedBy: string;
  givenAt?: string;
  createdAt: string;
}

export interface ActivityLog {
  logId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  activity: string;
  description: string;
  timestamp: string;
}

export interface PolicyChangeLog {
  changeId: string;
  settingName: string;
  previousValue: string;
  newValue: string;
  changedBy: string;
  changedByName: string;
  timestamp: string;
}

export interface SystemSettings {
  restaurantName: string;
  branchLocation: string;
  address: string;
  phoneContact: string;
  slogan: string;
  cardFrontTitle: string;
  cardLabel: string;
  cardTerms: string[];
  rankingPeriodType: RankingPeriodType;
  activeRankingPeriod: string; // e.g. "2026-11"
  rankingStartDate: string;
  rankingEndDate: string;
  rankingPrimaryIndicator: 'VISITS' | 'POINTS';
  rankingTieBreaker: 'POINTS' | 'TOTAL_SPEND' | 'EARLIEST_JOIN';
  publicLeaderboardNames: boolean;
  rank1RewardDefault: string;
  rank2RewardDefault: string;
  rank3RewardDefault: string;
  allowSelfRegistration: boolean;
  welcomeBonusPoints: number;
  requireReceiptUpload: boolean;
}
