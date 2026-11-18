import React, { useMemo, useState } from 'react';
import {
  ActivityLog,
  Announcement,
  Award,
  LedgerActivityType,
  Member,
  MemberStatus,
  PointLedger,
  PointPolicy,
  PolicyChangeLog,
  PurchasedItem,
  Redemption,
  Reward,
  SystemSettings,
  Transaction,
  User,
} from '../types/loyalty';
import { calculateTransactionPoints, computeCustomerRankings } from '../utils/loyaltyEngine';
import { MemberCardDigital, MinangCrestLogo } from './MemberCardDigital';
import { CustomerRankingView } from './CustomerRankingView';
import {
  CentralSettingsAndAccountsView,
  LoyaltyPointSettingsView,
  ReportsAndMonitoringView,
} from './AdminReportsAndSettings';
import {
  Activity,
  Award as AwardIcon,
  BarChart3,
  Bell,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  CreditCard,
  Download,
  Edit3,
  Eye,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  QrCode,
  Search,
  Settings,
  Shield,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

export type AdminNavSection =
  | 'DASHBOARD'
  | 'MEMBERS'
  | 'TRANSACTIONS'
  | 'POINT_POLICY'
  | 'REWARDS'
  | 'RANKING'
  | 'ANNOUNCEMENTS'
  | 'REPORTS'
  | 'SETTINGS'
  | 'ACCOUNTS'
  | 'LOGS';

interface AdminPortalProps {
  currentUser: User;
  users: User[];
  members: Member[];
  transactions: Transaction[];
  pointLedger: PointLedger[];
  policy: PointPolicy;
  rewards: Reward[];
  redemptions: Redemption[];
  announcements: Announcement[];
  awards: Award[];
  activityLogs: ActivityLog[];
  policyHistory: PolicyChangeLog[];
  settings: SystemSettings;
  onCreateMember: (payload: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    birthDate?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateMember: (memberId: string, updates: Partial<Member>) => Promise<void>;
  onDeleteMember: (memberId: string) => Promise<void>;
  onCreateDirectTransaction: (payload: {
    memberId: string;
    transactionAmount: number;
    purchasedItems: PurchasedItem[];
    notes?: string;
  }) => Promise<void>;
  onVerifyTransaction: (
    transactionId: string,
    decision: 'Approved' | 'Rejected' | 'Cancelled',
    rejectionReason?: string
  ) => Promise<void>;
  onAdjustPoints: (payload: {
    memberId: string;
    activityType: LedgerActivityType;
    pointDelta: number;
    description: string;
  }) => Promise<void>;
  onSavePolicy: (policy: PointPolicy) => Promise<void>;
  onCreateReward: (payload: Partial<Reward>) => Promise<void>;
  onUpdateReward: (rewardId: string, updates: Partial<Reward>) => Promise<void>;
  onDeleteReward: (rewardId: string) => Promise<void>;
  onVerifyRedemption: (
    redemptionId: string,
    decision: 'Approved' | 'Redeemed' | 'Rejected',
    rejectionReason?: string
  ) => Promise<void>;
  onAssignAward: (payload: any) => Promise<void>;
  onUpdateAwardStatus: (awardId: string, status: 'Ditetapkan' | 'Sudah Diberikan') => Promise<void>;
  onCreateAnnouncement: (payload: Partial<Announcement>) => Promise<void>;
  onUpdateAnnouncement: (announcementId: string, updates: Partial<Announcement>) => Promise<void>;
  onDeleteAnnouncement: (announcementId: string) => Promise<void>;
  onSaveSettings: (settings: SystemSettings) => Promise<void>;
  onCreateStaffAccount: (payload: any) => Promise<void>;
  onSetupOwnerSecurity: (payload: any) => Promise<void>;
  onClearDemoData: () => Promise<void>;
  onResetDemoData: () => Promise<void>;
  onLogout: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  currentUser,
  users,
  members,
  transactions,
  pointLedger,
  policy,
  rewards,
  redemptions,
  announcements,
  awards,
  activityLogs,
  policyHistory,
  settings,
  onCreateMember,
  onUpdateMember,
  onDeleteMember,
  onCreateDirectTransaction,
  onVerifyTransaction,
  onAdjustPoints,
  onSavePolicy,
  onCreateReward,
  onUpdateReward,
  onDeleteReward,
  onVerifyRedemption,
  onAssignAward,
  onUpdateAwardStatus,
  onCreateAnnouncement,
  onUpdateAnnouncement,
  onDeleteAnnouncement,
  onSaveSettings,
  onCreateStaffAccount,
  onSetupOwnerSecurity,
  onClearDemoData,
  onResetDemoData,
  onLogout,
}) => {
  const [activeSection, setActiveSection] = useState<AdminNavSection>('DASHBOARD');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Member Management state
  const [memberSearch, setMemberSearch] = useState('');
  const [memberStatusFilter, setMemberStatusFilter] = useState<'ALL' | MemberStatus>('ALL');
  const [memberJoinDateFilter, setMemberJoinDateFilter] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingCardMember, setViewingCardMember] = useState<Member | null>(null);
  const [confirmDeleteMember, setConfirmDeleteMember] = useState<Member | null>(null);

  // New/Edit Member form fields
  const [mFullName, setMFullName] = useState('');
  const [mPhone, setMPhone] = useState('');
  const [mEmail, setMEmail] = useState('');
  const [mAddress, setMAddress] = useState('');
  const [mBirthDate, setMBirthDate] = useState('');
  const [mStatus, setMStatus] = useState<MemberStatus>('Active');
  const [mNotes, setMNotes] = useState('');

  // Transaction & Verification state
  const [qrLookupQuery, setQrLookupQuery] = useState('');
  const [directMemberId, setDirectMemberId] = useState(members[0]?.memberId || 'TA-0001');
  const [directAmount, setDirectAmount] = useState('75000');
  const [directSelectedMenus, setDirectSelectedMenus] = useState<Record<string, number>>({});
  const [directNotes, setDirectNotes] = useState('');

  // Point Adjustment state
  const [adjMemberId, setAdjMemberId] = useState(members[0]?.memberId || 'TA-0001');
  const [adjType, setAdjType] = useState<LedgerActivityType>('Point Adjustment');
  const [adjDelta, setAdjDelta] = useState('5');
  const [adjReason, setAdjReason] = useState('');

  // Reward Modal state
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [rwName, setRwName] = useState('');
  const [rwCategory, setRwCategory] = useState<Reward['category']>('Makanan');
  const [rwDesc, setRwDesc] = useState('');
  const [rwPoints, setRwPoints] = useState('25');
  const [rwStock, setRwStock] = useState('50');
  const [rwMaxPerMember, setRwMaxPerMember] = useState('5');
  const [rwValidity, setRwValidity] = useState('2026-12-31');
  const [rwTerms, setRwTerms] = useState('Tunjukkan kode penukaran kepada kasir.');

  // Announcement Modal state
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annCategory, setAnnCategory] = useState<Announcement['category']>('Promo Khusus Member');
  const [annContent, setAnnContent] = useState('');
  const [annPinned, setAnnPinned] = useState(false);
  const [annStatus, setAnnStatus] = useState<'Published' | 'Draft'>('Published');

  const isOwner = currentUser.role === 'OWNER';

  // Computed Real-time Dashboard KPIs (PRD Section 5.A - 8 metrics from DB)
  const kpis = useMemo(() => {
    const totalMembers = members.length;
    const activeMembers = members.filter((m) => m.memberStatus === 'Active').length;
    const approvedTxs = transactions.filter((t) => t.verificationStatus === 'Approved');
    const totalTransactions = approvedTxs.length;
    const totalVisits = members.reduce((sum, m) => sum + m.totalVisits, 0);
    const totalPointsGiven = pointLedger.reduce((sum, l) => sum + l.pointIn, 0);
    const totalPointsRedeemed = pointLedger.reduce((sum, l) => sum + l.pointOut, 0);
    const totalRewardsClaimed = redemptions.filter(
      (r) => r.status === 'Redeemed' || r.status === 'Approved'
    ).length;
    const newMembersThisMonth = members.filter((m) => m.joinDate.startsWith('2026-11')).length;

    return {
      totalMembers,
      activeMembers,
      totalTransactions,
      totalVisits,
      totalPointsGiven,
      totalPointsRedeemed,
      totalRewardsClaimed,
      newMembersThisMonth,
    };
  }, [members, transactions, pointLedger, redemptions]);

  const pendingTransactions = useMemo(
    () => transactions.filter((t) => t.verificationStatus === 'Pending'),
    [transactions]
  );

  const pendingRedemptions = useMemo(
    () => redemptions.filter((r) => r.status === 'Pending'),
    [redemptions]
  );

  const rankings = useMemo(
    () => computeCustomerRankings(members, transactions, settings),
    [members, transactions, settings]
  );

  // Filtered Members for Member Management
  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => {
      const matchesQuery =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.memberId.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.qrCode.toLowerCase().includes(q);
      const matchesStatus = memberStatusFilter === 'ALL' || m.memberStatus === memberStatusFilter;
      const matchesDate = !memberJoinDateFilter || m.joinDate >= memberJoinDateFilter;
      return matchesQuery && matchesStatus && matchesDate;
    });
  }, [members, memberSearch, memberStatusFilter, memberJoinDateFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const paginatedMembers = filteredMembers.slice(
    (memberPage - 1) * pageSize,
    memberPage * pageSize
  );

  // QR Lookup match
  const qrMatchedMember = useMemo(() => {
    const q = qrLookupQuery.trim().toLowerCase();
    if (!q) return null;
    return (
      members.find(
        (m) =>
          m.qrCode.toLowerCase() === q ||
          m.memberId.toLowerCase() === q ||
          m.phone === q
      ) || null
    );
  }, [members, qrLookupQuery]);

  // Direct Cashier Transaction Point Estimation
  const directItemsList = useMemo<PurchasedItem[]>(() => {
    const list: PurchasedItem[] = [];
    for (const rule of policy.menuRules) {
      const qty = directSelectedMenus[rule.menuId] || 0;
      if (qty > 0) {
        list.push({
          menuId: rule.menuId,
          menuName: rule.menuName,
          qty,
          price: rule.defaultPrice,
          bonusPointsPerItem: rule.bonusPoints,
        });
      }
    }
    return list;
  }, [policy.menuRules, directSelectedMenus]);

  const directPointCalc = useMemo(
    () => calculateTransactionPoints(Number(directAmount) || 0, directItemsList, policy),
    [directAmount, directItemsList, policy]
  );

  const openAddMember = () => {
    setEditingMember(null);
    setMFullName('');
    setMPhone('');
    setMEmail('');
    setMAddress('');
    setMBirthDate('');
    setMStatus('Active');
    setMNotes('');
    setShowAddMemberModal(true);
  };

  const openEditMember = (m: Member) => {
    setEditingMember(m);
    setMFullName(m.fullName);
    setMPhone(m.phone);
    setMEmail(m.email || '');
    setMAddress(m.address || '');
    setMBirthDate(m.birthDate || '');
    setMStatus(m.memberStatus);
    setMNotes(m.notes || '');
    setShowAddMemberModal(true);
  };

  const handleSaveMemberForm = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingMember) {
        await onUpdateMember(editingMember.memberId, {
          fullName: mFullName,
          phone: mPhone,
          email: mEmail,
          address: mAddress,
          birthDate: mBirthDate,
          memberStatus: mStatus,
          notes: mNotes,
        });
        setBanner({
          type: 'success',
          text: `Data member ${editingMember.memberId} (${mFullName}) berhasil diperbarui.`,
        });
      } else {
        await onCreateMember({
          fullName: mFullName,
          phone: mPhone,
          email: mEmail,
          address: mAddress,
          birthDate: mBirthDate,
          notes: mNotes,
        });
        setBanner({
          type: 'success',
          text: `Member baru "${mFullName}" berhasil didaftarkan dan mendapatkan ID Member unik.`,
        });
      }
      setShowAddMemberModal(false);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Gagal menyimpan data member.' });
    }
  };

  const handleDirectTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateDirectTransaction({
        memberId: directMemberId,
        transactionAmount: Number(directAmount) || 0,
        purchasedItems: directItemsList,
        notes: directNotes || 'Transaksi langsung di kasir',
      });
      setBanner({
        type: 'success',
        text: `Transaksi kasir berhasil dicatat dan +${directPointCalc.totalPoints} poin langsung ditambahkan ke member ${directMemberId}.`,
      });
      setDirectNotes('');
      setDirectSelectedMenus({});
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Gagal mencatat transaksi kasir.' });
    }
  };

  const handleAdjustPointsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onAdjustPoints({
        memberId: adjMemberId,
        activityType: adjType,
        pointDelta: Number(adjDelta) || 0,
        description: adjReason,
      });
      setBanner({
        type: 'success',
        text: `Penyesuaian poin untuk member ${adjMemberId} berhasil dicatat ke dalam Point Ledger.`,
      });
      setAdjReason('');
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Gagal menyesuaikan poin.' });
    }
  };

  const handleSaveRewardModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingReward) {
        await onUpdateReward(editingReward.rewardId, {
          rewardName: rwName,
          category: rwCategory,
          description: rwDesc,
          requiredPoints: Number(rwPoints) || 10,
          stock: Number(rwStock) || 0,
          maxRedemptionPerMember: Number(rwMaxPerMember) || 5,
          validityPeriod: rwValidity,
          terms: rwTerms,
        });
        setBanner({ type: 'success', text: `Reward "${rwName}" berhasil diperbarui.` });
      } else {
        await onCreateReward({
          rewardName: rwName,
          category: rwCategory,
          description: rwDesc,
          requiredPoints: Number(rwPoints) || 10,
          stock: Number(rwStock) || 50,
          maxRedemptionPerMember: Number(rwMaxPerMember) || 5,
          validityPeriod: rwValidity,
          terms: rwTerms,
          isActive: true,
        });
        setBanner({ type: 'success', text: `Reward baru "${rwName}" berhasil ditambahkan.` });
      }
      setShowRewardModal(false);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Gagal menyimpan reward.' });
    }
  };

  const handleSaveAnnouncementModal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onCreateAnnouncement({
        title: annTitle,
        category: annCategory,
        content: annContent,
        isPinned: annPinned,
        status: annStatus,
      });
      setBanner({ type: 'success', text: `Pengumuman "${annTitle}" berhasil diterbitkan.` });
      setShowAnnModal(false);
      setAnnTitle('');
      setAnnContent('');
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Gagal menyimpan pengumuman.' });
    }
  };

  const navItems: Array<{
    id: AdminNavSection;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }> = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'MEMBERS', label: 'Manajemen Member', icon: <Users className="w-4 h-4" /> },
    {
      id: 'TRANSACTIONS',
      label: 'Transaksi & Verifikasi',
      icon: <ClipboardCheck className="w-4 h-4" />,
      badge: pendingTransactions.length,
    },
    { id: 'POINT_POLICY', label: 'Loyalty Point', icon: <Coins className="w-4 h-4" /> },
    {
      id: 'REWARDS',
      label: 'Reward Management',
      icon: <Gift className="w-4 h-4" />,
      badge: pendingRedemptions.length,
    },
    { id: 'RANKING', label: 'Customer Ranking', icon: <Trophy className="w-4 h-4" /> },
    { id: 'ANNOUNCEMENTS', label: 'Pengumuman', icon: <Bell className="w-4 h-4" /> },
    { id: 'REPORTS', label: 'Laporan', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'SETTINGS', label: 'Pengaturan', icon: <Settings className="w-4 h-4" /> },
    { id: 'ACCOUNTS', label: 'Manajemen Akun', icon: <Shield className="w-4 h-4" /> },
    { id: 'LOGS', label: 'Activity Logs', icon: <Activity className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F7F3EF] flex flex-col lg:flex-row">
      {/* Desktop Sidebar (264px width) */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 bg-[#391C19] text-white flex-col justify-between shrink-0 min-h-screen">
        <div>
          <div className="p-5 border-b border-white/10 flex items-center gap-3">
            <MinangCrestLogo className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-white truncate">
                {settings.restaurantName}
              </p>
              <p className="text-xs text-[#D9B432] truncate">
                {currentUser.role === 'OWNER'
                  ? 'Owner Super Admin Console'
                  : 'Dashboard Kasir & Operasional'}
              </p>
            </div>
          </div>

          <nav className="p-3 space-y-1" aria-label="Navigasi Admin">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setBanner(null);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeSection === item.id
                    ? 'bg-[#8E1118] text-white border border-[#D9B432]/40'
                    : 'text-[#F7F3EF]/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="font-mono-tabular text-[11px] font-bold bg-[#D9B432] text-[#391C19] px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs">
            <p className="font-bold text-white truncate">{currentUser.fullName}</p>
            <p className="text-[#D9B432] font-mono-tabular text-[11px]">{currentUser.role}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-[#8E1118] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="bg-white border-b border-[#391C19]/10 px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Buka menu navigasi admin"
              className="lg:hidden p-2 rounded-lg bg-[#F7F3EF] text-[#391C19] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#8E1118] truncate">
                {settings.restaurantName} · {settings.branchLocation}
              </p>
              <h1 className="font-display text-lg sm:text-xl font-bold text-[#391C19] truncate">
                {navItems.find((n) => n.id === activeSection)?.label || 'Dashboard'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={openAddMember}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e5c23e] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Tambah Member</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('TRANSACTIONS')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Verifikasi ({pendingTransactions.length})</span>
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#391C19] text-white p-4 space-y-1 border-b border-white/10">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveSection(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold ${
                  activeSection === item.id ? 'bg-[#8E1118] text-white' : 'text-[#F7F3EF]/80'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
                {item.badge ? (
                  <span className="font-mono-tabular bg-[#D9B432] text-[#391C19] px-1.5 py-0.5 rounded text-[10px] font-bold">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}

        {/* Global Status Banner */}
        {banner && (
          <div
            className={`mx-4 sm:mx-8 mt-4 p-4 rounded-xl border text-xs font-semibold flex items-center justify-between gap-3 ${
              banner.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="underline font-bold shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        <main className="p-4 sm:p-8 space-y-8 max-w-7xl w-full mx-auto">
          {/* =================================================================
           * SECTION 1: DASHBOARD ADMIN (PRD SECTION 5.A)
           * =============================================================== */}
          {activeSection === 'DASHBOARD' && (
            <div className="space-y-8">
              {/* 8 Real-Time Statistics Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '1. Total Member', value: kpis.totalMembers, unit: 'Pelanggan' },
                  { label: '2. Member Aktif', value: kpis.activeMembers, unit: 'Active' },
                  { label: '3. Total Transaksi Member', value: kpis.totalTransactions, unit: 'Disetujui' },
                  { label: '4. Total Kunjungan', value: kpis.totalVisits, unit: 'Kunjungan Valid' },
                  { label: '5. Total Poin Diberikan', value: `+${kpis.totalPointsGiven}`, unit: 'Poin Masuk' },
                  { label: '6. Total Poin Ditukarkan', value: `-${kpis.totalPointsRedeemed}`, unit: 'Poin Keluar' },
                  { label: '7. Total Reward Diklaim', value: kpis.totalRewardsClaimed, unit: 'Hadiah' },
                  { label: '8. Member Baru Bulan Ini', value: kpis.newMembersThisMonth, unit: 'Nov 2026' },
                ].map((stat, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl p-4 border border-[#391C19]/10 flex flex-col justify-between"
                  >
                    <p className="text-xs font-semibold text-[#391C19]/70">{stat.label}</p>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-mono-tabular text-2xl font-bold text-[#8E1118]">
                        {stat.value}
                      </span>
                      <span className="text-[11px] text-[#391C19]/60">{stat.unit}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pending Queues Alert Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Permintaan Poin Menunggu Verifikasi */}
                <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#391C19]">
                        Permintaan Poin Menunggu Verifikasi ({pendingTransactions.length})
                      </h3>
                      <p className="text-xs text-[#391C19]/65">
                        Pengajuan klaim pembelian dari aplikasi member
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('TRANSACTIONS')}
                      className="text-xs font-bold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Buka Semua
                    </button>
                  </div>

                  {pendingTransactions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#391C19]/60">
                      Seluruh pengajuan poin member telah selesai diverifikasi.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#391C19]/10">
                      {pendingTransactions.slice(0, 4).map((tx) => (
                        <div
                          key={tx.transactionId}
                          className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F7F3EF]/50"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#391C19]">
                              {tx.memberName}{' '}
                              <span className="font-mono-tabular text-[#8E1118]">
                                ({tx.memberId})
                              </span>
                            </p>
                            <p className="text-xs font-mono-tabular text-[#391C19]/75">
                              {tx.transactionCode} · Rp{tx.transactionAmount.toLocaleString('id-ID')} ·{' '}
                              <strong className="text-[#8E1118]">+{tx.calculatedPoints} Poin</strong>
                            </p>
                            {tx.notes && (
                              <p className="text-[11px] text-[#391C19]/60 truncate">{tx.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => onVerifyTransaction(tx.transactionId, 'Approved')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Setujui
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onVerifyTransaction(
                                  tx.transactionId,
                                  'Rejected',
                                  'Bukti struk tidak sesuai'
                                )
                              }
                              className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                            >
                              Tolak
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Permintaan Reward Menunggu Persetujuan */}
                <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
                    <div>
                      <h3 className="font-display text-base font-bold text-[#391C19]">
                        Permintaan Reward Menunggu Persetujuan ({pendingRedemptions.length})
                      </h3>
                      <p className="text-xs text-[#391C19]/65">
                        Penukaran hadiah yang diajukan member
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('REWARDS')}
                      className="text-xs font-bold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Kelola Reward
                    </button>
                  </div>

                  {pendingRedemptions.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#391C19]/60">
                      Tidak ada antrean penukaran reward saat ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#391C19]/10">
                      {pendingRedemptions.map((red) => (
                        <div
                          key={red.redemptionId}
                          className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-[#F7F3EF]/50"
                        >
                          <div>
                            <p className="text-xs font-bold text-[#391C19]">
                              {red.memberName}{' '}
                              <span className="font-mono-tabular text-[#8E1118]">
                                ({red.memberId})
                              </span>
                            </p>
                            <p className="text-xs text-[#391C19]/80">
                              Hadiah: <strong>{red.rewardName}</strong> ({red.pointsUsed} Poin)
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onVerifyRedemption(red.redemptionId, 'Redeemed')}
                              className="px-3 py-1.5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
                            >
                              Verifikasi & Serahkan Hadiah
                            </button>
                            <button
                              type="button"
                              onClick={() => onVerifyRedemption(red.redemptionId, 'Rejected')}
                              className="px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg cursor-pointer"
                            >
                              Tolak
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 5 Data Visualization Charts Row (PRD Section 5.A) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1 & 2: Pertumbuhan Member & Aktivitas Kunjungan per Bulan */}
                <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[#391C19]">
                      Pertumbuhan Member & Kunjungan Bulanan
                    </h3>
                    <span className="text-[11px] font-mono-tabular text-[#8E1118] font-bold">
                      Jun – Nov 2026
                    </span>
                  </div>
                  <div className="h-40 flex items-end justify-between gap-2 pt-4 px-2 border-b border-[#391C19]/10">
                    {[
                      { month: 'Jun', visits: 8, members: 2 },
                      { month: 'Jul', visits: 12, members: 3 },
                      { month: 'Agu', visits: 15, members: 4 },
                      { month: 'Sep', visits: 19, members: 4 },
                      { month: 'Okt', visits: 25, members: 5 },
                      { month: 'Nov', visits: kpis.totalVisits, members: kpis.totalMembers },
                    ].map((bar) => {
                      const heightPct = Math.min(100, Math.max(18, Math.round((bar.visits / 32) * 100)));
                      return (
                        <div key={bar.month} className="flex-1 flex flex-col items-center gap-1">
                          <span className="font-mono-tabular text-[10px] font-bold text-[#8E1118]">
                            {bar.visits}x
                          </span>
                          <div
                            className="w-full bg-gradient-to-t from-[#8E1118] to-[#D9B432] rounded-t-md"
                            style={{ height: `${heightPct}px` }}
                          />
                          <span className="text-[10px] font-medium text-[#391C19]/75">
                            {bar.month}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-[#391C19]/65">
                    Tren kenaikan kunjungan terverifikasi seiring bertambahnya member aktif.
                  </p>
                </div>

                {/* Chart 3 & 4: Pengumpulan Poin vs Penukaran Reward */}
                <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-4">
                  <h3 className="font-display text-sm font-bold text-[#391C19]">
                    Grafik Pengumpulan Poin vs Penukaran Reward
                  </h3>
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[#391C19]">Total Poin Diberikan</span>
                        <span className="font-mono-tabular font-bold text-emerald-700">
                          +{kpis.totalPointsGiven} Poin
                        </span>
                      </div>
                      <div className="h-3 bg-[#F7F3EF] rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[#391C19]">Total Poin Ditukarkan</span>
                        <span className="font-mono-tabular font-bold text-[#8E1118]">
                          -{kpis.totalPointsRedeemed} Poin
                        </span>
                      </div>
                      <div className="h-3 bg-[#F7F3EF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#8E1118] rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                (kpis.totalPointsRedeemed / Math.max(1, kpis.totalPointsGiven)) * 100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-[#391C19]">Saldo Poin Aktif Beredar</span>
                        <span className="font-mono-tabular font-bold text-[#D9B432]">
                          {kpis.totalPointsGiven - kpis.totalPointsRedeemed} Poin
                        </span>
                      </div>
                      <div className="h-3 bg-[#F7F3EF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#D9B432] rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round(
                                ((kpis.totalPointsGiven - kpis.totalPointsRedeemed) /
                                  Math.max(1, kpis.totalPointsGiven)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chart 5: Top 3 Member Paling Loyal & Perbandingan Aktivitas */}
                <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[#391C19]">
                      Top 3 Member Paling Loyal Bulan Ini
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('RANKING')}
                      className="text-xs font-bold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Detail Podium
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {rankings.slice(0, 3).map((rk) => (
                      <div
                        key={rk.memberId}
                        className="p-3 rounded-lg bg-[#F7F3EF] border border-[#391C19]/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono-tabular text-xs font-bold text-[#8E1118]">
                            TOP {rk.rankPosition}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#391C19] truncate">
                              {rk.memberName}
                            </p>
                            <p className="font-mono-tabular text-[10px] text-[#391C19]/65">
                              {rk.memberId}
                            </p>
                          </div>
                        </div>
                        <div className="text-right font-mono-tabular shrink-0">
                          <p className="text-xs font-bold text-[#8E1118]">{rk.totalVisits}x Kunjungan</p>
                          <p className="text-[10px] text-[#391C19]/70">{rk.totalPoints} Poin</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom Row: Member Terbaru & Transaksi Terbaru */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#391C19]/10 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[#391C19]">Member Terbaru</h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('MEMBERS')}
                      className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Lihat Semua Member
                    </button>
                  </div>
                  <div className="divide-y divide-[#391C19]/10 text-xs">
                    {members.slice(0, 4).map((m) => (
                      <div key={m.memberId} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-[#391C19]">
                            {m.fullName}{' '}
                            <span className="font-mono-tabular text-[#8E1118]">({m.memberId})</span>
                          </p>
                          <p className="font-mono-tabular text-[11px] text-[#391C19]/65">
                            WA: {m.phone} · Gabung: {m.joinDate}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-bold text-[#391C19]">
                          {m.totalPoints} Poin
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#391C19]/10 flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-[#391C19]">
                      Transaksi Terbaru
                    </h3>
                    <button
                      type="button"
                      onClick={() => setActiveSection('TRANSACTIONS')}
                      className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Riwayat Lengkap
                    </button>
                  </div>
                  <div className="divide-y divide-[#391C19]/10 text-xs">
                    {transactions.slice(0, 4).map((t) => (
                      <div
                        key={t.transactionId}
                        className="px-5 py-3 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-[#391C19]">
                            {t.memberName}{' '}
                            <span className="font-mono-tabular text-[#391C19]/65">
                              ({t.transactionCode})
                            </span>
                          </p>
                          <p className="font-mono-tabular text-[11px] text-[#391C19]/65">
                            Rp{t.transactionAmount.toLocaleString('id-ID')} · {t.verificationStatus}
                          </p>
                        </div>
                        <span className="font-mono-tabular font-bold text-[#8E1118]">
                          +{t.calculatedPoints} Poin
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * SECTION 2: MANAJEMEN MEMBER (PRD SECTION 5.B)
           * =============================================================== */}
          {activeSection === 'MEMBERS' && (
            <div className="space-y-6">
              {/* Filter & Search Bar */}
              <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 text-[#391C19]/50 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setMemberPage(1);
                      }}
                      placeholder="Cari Nama, ID Member (TA-0001), atau Nomor WhatsApp..."
                      className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                    />
                  </div>

                  <select
                    value={memberStatusFilter}
                    onChange={(e) => {
                      setMemberStatusFilter(e.target.value as any);
                      setMemberPage(1);
                    }}
                    aria-label="Filter status member"
                    className="px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg bg-white"
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Suspended">Suspended</option>
                  </select>

                  <input
                    type="date"
                    value={memberJoinDateFilter}
                    onChange={(e) => {
                      setMemberJoinDateFilter(e.target.value);
                      setMemberPage(1);
                    }}
                    aria-label="Filter tanggal bergabung"
                    className="px-3 py-2 text-xs font-mono-tabular border border-[#391C19]/20 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={openAddMember}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Member Baru
                  </button>
                </div>
              </div>

              {/* Member Data Table */}
              <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                        <th className="py-3 px-4">No</th>
                        <th className="py-3 px-4">ID Member</th>
                        <th className="py-3 px-4">Nama Lengkap</th>
                        <th className="py-3 px-4">Nomor WhatsApp</th>
                        <th className="py-3 px-4">Tanggal Bergabung</th>
                        <th className="py-3 px-4 text-right">Total Poin</th>
                        <th className="py-3 px-4 text-right">Total Kunjungan</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#391C19]/10 text-xs">
                      {paginatedMembers.map((m, idx) => (
                        <tr key={m.memberId} className="hover:bg-[#F7F3EF]/60">
                          <td className="py-3 px-4 font-mono-tabular text-[#391C19]/70">
                            {(memberPage - 1) * pageSize + idx + 1}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                            {m.memberId}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#391C19]">{m.fullName}</td>
                          <td className="py-3 px-4 font-mono-tabular">{m.phone}</td>
                          <td className="py-3 px-4 font-mono-tabular text-[#391C19]/75">
                            {m.joinDate}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#8E1118]">
                            {m.totalPoints} Poin
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                            {m.totalVisits}x
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {m.memberStatus === 'Active' ? (
                              <span className="text-emerald-700">Active</span>
                            ) : m.memberStatus === 'Inactive' ? (
                              <span className="text-amber-700">Inactive</span>
                            ) : (
                              <span className="text-red-700">Suspended</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewingCardMember(m)}
                                aria-label={`Lihat kartu member ${m.fullName}`}
                                className="px-2.5 py-1 text-xs font-semibold text-[#8E1118] bg-[#F7F3EF] hover:bg-[#D9B432]/30 rounded cursor-pointer"
                              >
                                Kartu QR
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditMember(m)}
                                aria-label={`Edit member ${m.fullName}`}
                                className="px-2.5 py-1 text-xs font-semibold text-[#391C19] bg-[#F7F3EF] hover:bg-[#391C19]/10 rounded cursor-pointer"
                              >
                                Edit
                              </button>
                              {isOwner && (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteMember(m)}
                                  aria-label={`Hapus member ${m.fullName}`}
                                  className="px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 rounded cursor-pointer"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-3.5 bg-[#F7F3EF]/60 border-t border-[#391C19]/10 flex items-center justify-between text-xs">
                  <span>
                    Menampilkan {paginatedMembers.length} dari {filteredMembers.length} member
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={memberPage <= 1}
                      onClick={() => setMemberPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded bg-white border border-[#391C19]/20 disabled:opacity-40 cursor-pointer"
                    >
                      Sebelumnya
                    </button>
                    <span className="font-mono-tabular font-semibold">
                      Hal {memberPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={memberPage >= totalPages}
                      onClick={() => setMemberPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded bg-white border border-[#391C19]/20 disabled:opacity-40 cursor-pointer"
                    >
                      Berikutnya
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * SECTION 3: TRANSAKSI, VERIFIKASI & POINT LEDGER (PRD SEC 5.E & 5.F)
           * =============================================================== */}
          {activeSection === 'TRANSACTIONS' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Direct Cashier Transaction Input & QR Scanner Lookup */}
                <div className="lg:col-span-5 space-y-6">
                  {/* QR Code / Member ID Verification Lookup */}
                  <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-3">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-5 h-5 text-[#8E1118]" />
                      <h3 className="font-display text-base font-bold text-[#391C19]">
                        Verifikasi Cepat QR Code / ID Member
                      </h3>
                    </div>
                    <input
                      type="text"
                      value={qrLookupQuery}
                      onChange={(e) => {
                        setQrLookupQuery(e.target.value);
                        const found = members.find(
                          (m) =>
                            m.memberId.toLowerCase() === e.target.value.trim().toLowerCase() ||
                            m.qrCode.toLowerCase() === e.target.value.trim().toLowerCase()
                        );
                        if (found) setDirectMemberId(found.memberId);
                      }}
                      placeholder="Tempel hasil scan QR atau ketik TA-0001..."
                      className="w-full px-3.5 py-2 text-xs font-mono-tabular border border-[#391C19]/20 rounded-lg"
                    />
                    {qrMatchedMember && (
                      <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs space-y-1">
                        <p className="font-bold text-emerald-950">
                          Terverifikasi: {qrMatchedMember.fullName} ({qrMatchedMember.memberId})
                        </p>
                        <p className="font-mono-tabular text-emerald-800">
                          Saldo: <strong>{qrMatchedMember.totalPoints} Poin</strong> · Kunjungan:{' '}
                          <strong>{qrMatchedMember.totalVisits}x</strong>
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Direct Cashier Transaction Form */}
                  <form
                    onSubmit={handleDirectTransactionSubmit}
                    className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-4"
                  >
                    <h3 className="font-display text-base font-bold text-[#391C19]">
                      Input Transaksi Kasir Langsung (Otomatis Disetujui)
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-[#391C19] mb-1">
                        Pilih Member
                      </label>
                      <select
                        value={directMemberId}
                        onChange={(e) => setDirectMemberId(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg bg-white"
                      >
                        {members
                          .filter((m) => m.memberStatus === 'Active')
                          .map((m) => (
                            <option key={m.memberId} value={m.memberId}>
                              {m.memberId} – {m.fullName} ({m.totalPoints} Poin)
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#391C19] mb-1">
                        Nominal Transaksi (Rp)
                      </label>
                      <input
                        type="number"
                        min={1000}
                        step={500}
                        required
                        value={directAmount}
                        onChange={(e) => setDirectAmount(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold border border-[#391C19]/20 rounded-lg"
                      />
                    </div>

                    <div className="bg-[#F7F3EF] p-3 rounded-lg flex items-center justify-between text-xs">
                      <span>Poin Otomatis Dihitung:</span>
                      <span className="font-mono-tabular text-base font-bold text-[#8E1118]">
                        +{directPointCalc.totalPoints} Poin
                      </span>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
                    >
                      Simpan & Tambahkan Poin Sekarang
                    </button>
                  </form>

                  {/* Manual Point Adjustment (Requires Reason per PRD Section 5.F) */}
                  <form
                    onSubmit={handleAdjustPointsSubmit}
                    className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-3"
                  >
                    <h3 className="font-display text-base font-bold text-[#391C19]">
                      Penyesuaian Poin & Audit Ledger
                    </h3>
                    <p className="text-[11px] text-[#391C19]/70">
                      Sesuai aturan keamanan, perubahan saldo poin wajib menyertakan alasan tertulis pada Point Ledger.
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-[#391C19] mb-1">
                          Member
                        </label>
                        <select
                          value={adjMemberId}
                          onChange={(e) => setAdjMemberId(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border rounded bg-white"
                        >
                          {members.map((m) => (
                            <option key={m.memberId} value={m.memberId}>
                              {m.memberId} - {m.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-[#391C19] mb-1">
                          Jenis Aktivitas
                        </label>
                        <select
                          value={adjType}
                          onChange={(e) => setAdjType(e.target.value as LedgerActivityType)}
                          className="w-full px-2.5 py-1.5 text-xs border rounded bg-white"
                        >
                          <option value="Point Adjustment">Point Adjustment</option>
                          <option value="Bonus Points">Bonus Points</option>
                          <option value="Reversal Points">Reversal Points</option>
                          <option value="Expired Points">Expired Points</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#391C19] mb-1">
                        Jumlah Perubahan Poin (Positif = Tambah, Negatif = Kurang)
                      </label>
                      <input
                        type="number"
                        required
                        value={adjDelta}
                        onChange={(e) => setAdjDelta(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono-tabular font-bold border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-[#391C19] mb-1">
                        Alasan Penyesuaian (Wajib Diisi)
                      </label>
                      <input
                        type="text"
                        required
                        value={adjReason}
                        onChange={(e) => setAdjReason(e.target.value)}
                        placeholder="Contoh: Koreksi struk makan malam meja 08"
                        className="w-full px-3 py-1.5 text-xs border rounded"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e5c23e] rounded-lg cursor-pointer"
                    >
                      Catat Penyesuaian Poin
                    </button>
                  </form>
                </div>

                {/* Right Column: Pending Verification Queue & Full Transaction Table */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Pending Requests Table */}
                  <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
                      <h3 className="font-display text-base font-bold text-[#391C19]">
                        Antrean Pengajuan Poin Member ({pendingTransactions.length} Pending)
                      </h3>
                    </div>

                    {pendingTransactions.length === 0 ? (
                      <div className="p-6 text-center text-xs text-[#391C19]/60">
                        Tidak ada pengajuan poin yang menunggu verifikasi.
                      </div>
                    ) : (
                      <div className="divide-y divide-[#391C19]/10">
                        {pendingTransactions.map((tx) => (
                          <div
                            key={tx.transactionId}
                            className="p-4 flex flex-wrap items-center justify-between gap-4"
                          >
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-[#391C19]">
                                {tx.memberName}{' '}
                                <span className="font-mono-tabular text-[#8E1118]">
                                  ({tx.memberId})
                                </span>{' '}
                                · <span className="font-mono-tabular">{tx.transactionCode}</span>
                              </p>
                              <p className="text-xs font-mono-tabular">
                                Nominal: <strong>Rp{tx.transactionAmount.toLocaleString('id-ID')}</strong>{' '}
                                → Estimasi:{' '}
                                <strong className="text-[#8E1118]">+{tx.calculatedPoints} Poin</strong>
                              </p>
                              {tx.purchasedItems.length > 0 && (
                                <p className="text-[11px] text-[#391C19]/75">
                                  Menu Bonus:{' '}
                                  {tx.purchasedItems.map((i) => `${i.qty}x ${i.menuName}`).join(', ')}
                                </p>
                              )}
                              {tx.notes && (
                                <p className="text-[11px] text-[#391C19]/60">Catatan: {tx.notes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onVerifyTransaction(tx.transactionId, 'Approved')}
                                className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
                              >
                                Setujui (+{tx.calculatedPoints} Poin)
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onVerifyTransaction(
                                    tx.transactionId,
                                    'Rejected',
                                    'Ditolak oleh kasir'
                                  )
                                }
                                className="px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg cursor-pointer"
                              >
                                Tolak
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* All Transactions History */}
                  <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#391C19]/10">
                      <h3 className="font-display text-base font-bold text-[#391C19]">
                        Riwayat Seluruh Transaksi Member ({transactions.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-96">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                            <th className="py-3 px-4">Kode</th>
                            <th className="py-3 px-4">Tanggal</th>
                            <th className="py-3 px-4">Member</th>
                            <th className="py-3 px-4 text-right">Nominal</th>
                            <th className="py-3 px-4 text-right">Poin</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4">Petugas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#391C19]/10 text-xs">
                          {transactions.slice(0, 25).map((tx) => (
                            <tr key={tx.transactionId} className="hover:bg-[#F7F3EF]/50">
                              <td className="py-2.5 px-4 font-mono-tabular font-semibold">
                                {tx.transactionCode}
                              </td>
                              <td className="py-2.5 px-4 font-mono-tabular text-[#391C19]/70">
                                {tx.transactionDate.slice(0, 10)}
                              </td>
                              <td className="py-2.5 px-4">
                                <span className="font-semibold">{tx.memberName}</span>{' '}
                                <span className="font-mono-tabular text-[#8E1118]">
                                  ({tx.memberId})
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular">
                                Rp{tx.transactionAmount.toLocaleString('id-ID')}
                              </td>
                              <td className="py-2.5 px-4 text-right font-mono-tabular font-bold text-[#8E1118]">
                                +{tx.verificationStatus === 'Approved' ? tx.approvedPoints : tx.calculatedPoints}
                              </td>
                              <td className="py-2.5 px-4 font-semibold">
                                {tx.verificationStatus}
                              </td>
                              <td className="py-2.5 px-4 text-[#391C19]/70">
                                {tx.verifiedByName || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * SECTION 4: LOYALTY POINT SETTINGS (PRD SECTION 5.D)
           * =============================================================== */}
          {activeSection === 'POINT_POLICY' && (
            <LoyaltyPointSettingsView
              policy={policy}
              currentUser={currentUser}
              policyHistory={policyHistory}
              onSavePolicy={onSavePolicy}
            />
          )}

          {/* =================================================================
           * SECTION 5: REWARD MANAGEMENT (PRD SECTION 5.G)
           * =============================================================== */}
          {activeSection === 'REWARDS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                    Rewards & Benefits Management
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[#391C19]">
                    Katalog Hadiah & Verifikasi Penukaran Poin
                  </h2>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReward(null);
                      setRwName('');
                      setRwDesc('');
                      setRwPoints('25');
                      setRwStock('50');
                      setShowRewardModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Hadiah Baru
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {rewards.map((rw) => (
                  <div
                    key={rw.rewardId}
                    className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-[#8E1118]">{rw.category}</span>
                        <span className="font-mono-tabular font-bold bg-[#D9B432]/25 px-2.5 py-0.5 rounded">
                          {rw.requiredPoints} Poin
                        </span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#391C19]">
                        {rw.rewardName}
                      </h3>
                      <p className="text-xs text-[#391C19]/75">{rw.description}</p>
                      <p className="text-[11px] font-mono-tabular text-[#391C19]/65">
                        Stok: <strong>{rw.stock}</strong> · Telah Ditukar: <strong>{rw.redeemedCount}x</strong>
                      </p>
                    </div>

                    {isOwner && (
                      <div className="pt-3 border-t border-[#391C19]/10 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReward(rw);
                            setRwName(rw.rewardName);
                            setRwCategory(rw.category);
                            setRwDesc(rw.description);
                            setRwPoints(String(rw.requiredPoints));
                            setRwStock(String(rw.stock));
                            setRwMaxPerMember(String(rw.maxRedemptionPerMember));
                            setRwValidity(rw.validityPeriod);
                            setRwTerms(rw.terms);
                            setShowRewardModal(true);
                          }}
                          className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                        >
                          Edit Ketentuan
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReward(rw.rewardId)}
                          className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
                        >
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Redemption Queue & History */}
              <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#391C19]/10">
                  <h3 className="font-display text-base font-bold text-[#391C19]">
                    Daftar Penukaran Reward & Kode Verifikasi ({redemptions.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                        <th className="py-3 px-4">Kode Penukaran</th>
                        <th className="py-3 px-4">Member</th>
                        <th className="py-3 px-4">Hadiah</th>
                        <th className="py-3 px-4 text-right">Poin</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Verifikasi Kasir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#391C19]/10 text-xs">
                      {redemptions.map((red) => (
                        <tr key={red.redemptionId}>
                          <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                            {red.redemptionCode}
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {red.memberName} ({red.memberId})
                          </td>
                          <td className="py-3 px-4">{red.rewardName}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold">
                            {red.pointsUsed} Poin
                          </td>
                          <td className="py-3 px-4 font-semibold">{red.status}</td>
                          <td className="py-3 px-4 text-right">
                            {red.status === 'Pending' ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => onVerifyRedemption(red.redemptionId, 'Redeemed')}
                                  className="px-3 py-1 text-xs font-bold text-white bg-emerald-700 rounded cursor-pointer"
                                >
                                  Setujui & Serahkan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onVerifyRedemption(red.redemptionId, 'Rejected')}
                                  className="px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 rounded cursor-pointer"
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : (
                              <span className="text-[#391C19]/60">
                                Diverifikasi oleh {red.approvedByName || 'Kasir'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* =================================================================
           * SECTION 6: CUSTOMER RANKING (PRD SECTION 5.H)
           * =============================================================== */}
          {activeSection === 'RANKING' && (
            <CustomerRankingView
              members={members}
              transactions={transactions}
              awards={awards}
              settings={settings}
              policy={policy}
              currentUser={currentUser}
              onAssignAward={onAssignAward}
              onUpdateAwardStatus={onUpdateAwardStatus}
            />
          )}

          {/* =================================================================
           * SECTION 7: ANNOUNCEMENT CENTER (PRD SECTION 5.I)
           * =============================================================== */}
          {activeSection === 'ANNOUNCEMENTS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                    Announcement Center
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[#391C19]">
                    Manajemen Pengumuman & Informasi Member
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAnnModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Buat Pengumuman Baru
                </button>
              </div>

              <div className="space-y-4">
                {announcements.map((ann) => (
                  <div
                    key={ann.announcementId}
                    className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-col sm:flex-row items-start justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-xs text-[#8E1118] font-semibold">
                        <span>{ann.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-[#391C19]/65">
                          {ann.publishDate}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Status: {ann.status}</span>
                      </div>
                      <h3 className="font-display text-lg font-bold text-[#391C19]">{ann.title}</h3>
                      <p className="text-xs text-[#391C19]/80 leading-relaxed">{ann.content}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateAnnouncement(ann.announcementId, {
                            status: ann.status === 'Published' ? 'Archived' : 'Published',
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-[#F7F3EF] rounded-lg cursor-pointer"
                      >
                        {ann.status === 'Published' ? 'Arsipkan' : 'Publikasikan'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAnnouncement(ann.announcementId)}
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 rounded-lg cursor-pointer"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* =================================================================
           * SECTION 8: LAPORAN DAN MONITORING (PRD SECTION 7)
           * =============================================================== */}
          {activeSection === 'REPORTS' && (
            <ReportsAndMonitoringView
              members={members}
              transactions={transactions}
              pointLedger={pointLedger}
              rewards={rewards}
              redemptions={redemptions}
              awards={awards}
              settings={settings}
            />
          )}

          {/* =================================================================
           * SECTION 9, 10, 11: PENGATURAN, AKUN & ACTIVITY LOGS
           * =============================================================== */}
          {(activeSection === 'SETTINGS' ||
            activeSection === 'ACCOUNTS' ||
            activeSection === 'LOGS') && (
            <CentralSettingsAndAccountsView
              settings={settings}
              users={users}
              activityLogs={activityLogs}
              policyHistory={policyHistory}
              currentUser={currentUser}
              onSaveSettings={onSaveSettings}
              onCreateStaffAccount={onCreateStaffAccount}
              onSetupOwnerSecurity={onSetupOwnerSecurity}
              onClearDemoData={onClearDemoData}
              onResetDemoData={onResetDemoData}
            />
          )}
        </main>
      </div>

      {/* =====================================================================
       * MODALS: ADD/EDIT MEMBER, VIEW DIGITAL CARD, CONFIRM DELETE, REWARD, ANN
       * =================================================================== */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-modal-title"
        >
          <form
            onSubmit={handleSaveMemberForm}
            className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#391C19]/15 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#391C19]/10 pb-3">
              <h3 id="member-modal-title" className="font-display text-lg font-bold text-[#391C19]">
                {editingMember
                  ? `Edit Data Member (${editingMember.memberId})`
                  : 'Pendaftaran Member Baru Top Ampera'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="p-1 text-[#391C19]/60 hover:text-[#391C19] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Nama Lengkap Pelanggan *
              </label>
              <input
                type="text"
                required
                value={mFullName}
                onChange={(e) => setMFullName(e.target.value)}
                placeholder="Contoh: H. Ahmad Fauzi"
                className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">
                  Nomor WhatsApp Aktif *
                </label>
                <input
                  type="tel"
                  required
                  value={mPhone}
                  onChange={(e) => setMPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Status Member</label>
                <select
                  value={mStatus}
                  onChange={(e) => setMStatus(e.target.value as MemberStatus)}
                  className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg bg-white"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Suspended">Suspended</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Alamat Domisili
              </label>
              <input
                type="text"
                value={mAddress}
                onChange={(e) => setMAddress(e.target.value)}
                placeholder="Kota Wisata Batu / Malang Raya"
                className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#391C19]/10">
              <button
                type="button"
                onClick={() => setShowAddMemberModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#F7F3EF] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
              >
                {editingMember ? 'Simpan Perubahan' : 'Terbitkan ID & Kartu Member'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* View Member Digital Card Modal */}
      {viewingCardMember && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[#F7F3EF] rounded-2xl max-w-4xl w-full p-6 border border-[#391C19]/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                Detail Kartu Member: {viewingCardMember.fullName} ({viewingCardMember.memberId})
              </h3>
              <button
                type="button"
                onClick={() => setViewingCardMember(null)}
                className="p-1.5 bg-white rounded-lg text-[#391C19] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <MemberCardDigital member={viewingCardMember} settings={settings} />
          </div>
        </div>
      )}

      {/* Confirm Delete Member Modal */}
      {confirmDeleteMember && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-[#391C19]/15 space-y-4">
            <h3 className="font-display text-lg font-bold text-red-800">
              Konfirmasi Penghapusan Data Member
            </h3>
            <p className="text-xs text-[#391C19]/80 leading-relaxed">
              Apakah Anda yakin ingin menghapus data member{' '}
              <strong>
                {confirmDeleteMember.fullName} ({confirmDeleteMember.memberId})
              </strong>
              ? Tindakan ini akan dicatat pada Activity Logs.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteMember(null)}
                className="px-4 py-2 text-xs font-semibold bg-[#F7F3EF] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onDeleteMember(confirmDeleteMember.memberId);
                  setConfirmDeleteMember(null);
                  setBanner({
                    type: 'success',
                    text: `Member ${confirmDeleteMember.memberId} telah dihapus.`,
                  });
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-700 hover:bg-red-800 rounded-lg cursor-pointer"
              >
                Ya, Hapus Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Reward Modal */}
      {showRewardModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveRewardModal}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              {editingReward ? 'Edit Hadiah Loyalty' : 'Tambah Hadiah Baru'}
            </h3>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Nama Hadiah *</label>
              <input
                type="text"
                required
                value={rwName}
                onChange={(e) => setRwName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Kategori</label>
                <select
                  value={rwCategory}
                  onChange={(e) => setRwCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Voucher Diskon">Voucher Diskon</option>
                  <option value="Spesial">Spesial</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Poin Butuh *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={rwPoints}
                  onChange={(e) => setRwPoints(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular font-bold border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Stok</label>
                <input
                  type="number"
                  min={0}
                  value={rwStock}
                  onChange={(e) => setRwStock(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono-tabular border rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Deskripsi</label>
              <textarea
                rows={2}
                value={rwDesc}
                onChange={(e) => setRwDesc(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRewardModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#F7F3EF] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#8E1118] rounded-lg cursor-pointer"
              >
                Simpan Hadiah
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Announcement Modal */}
      {showAnnModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveAnnouncementModal}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              Buat Pengumuman Member Baru
            </h3>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Judul *</label>
              <input
                type="text"
                required
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Kategori</label>
                <select
                  value={annCategory}
                  onChange={(e) => setAnnCategory(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="Informasi Program Loyalty">Informasi Program Loyalty</option>
                  <option value="Promo Khusus Member">Promo Khusus Member</option>
                  <option value="Bonus Poin">Bonus Poin</option>
                  <option value="Menu Baru">Menu Baru</option>
                  <option value="Pemenang Ranking">Pemenang Ranking</option>
                  <option value="Operasional Restoran">Operasional Restoran</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Status</label>
                <select
                  value={annStatus}
                  onChange={(e) => setAnnStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border rounded-lg bg-white"
                >
                  <option value="Published">Published (Terbit)</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Isi Informasi *</label>
              <textarea
                rows={3}
                required
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                className="w-full px-3.5 py-2 text-xs border rounded-lg"
              />
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={annPinned}
                onChange={(e) => setAnnPinned(e.target.checked)}
              />
              Jadikan Pengumuman Prioritas (Pinned)
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAnnModal(false)}
                className="px-4 py-2 text-xs font-semibold bg-[#F7F3EF] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-bold text-white bg-[#8E1118] rounded-lg cursor-pointer"
              >
                Terbitkan Pengumuman
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
