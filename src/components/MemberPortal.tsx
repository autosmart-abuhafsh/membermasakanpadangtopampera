import React, { useMemo, useState } from 'react';
import {
  Announcement,
  Award,
  Member,
  PointLedger,
  PointPolicy,
  PurchasedItem,
  Redemption,
  Reward,
  SystemSettings,
  Transaction,
  User,
} from '../types/loyalty';
import {
  calculateNextRewardProgress,
  calculateTransactionPoints,
  computeCustomerRankings,
} from '../utils/loyaltyEngine';
import { MemberCardDigital, MinangCrestLogo } from './MemberCardDigital';
import { CustomerRankingView } from './CustomerRankingView';
import {
  Bell,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  History,
  Home,
  LogOut,
  PlusCircle,
  Receipt,
  Sparkles,
  Trophy,
  User as UserIcon,
  Utensils,
} from 'lucide-react';

export type MemberNavTab =
  | 'BERANDA'
  | 'KARTU_MEMBER'
  | 'CATAT_PEMBELIAN'
  | 'POIN_SAYA'
  | 'REWARDS'
  | 'RANKING'
  | 'PENGUMUMAN'
  | 'PROFIL';

interface MemberPortalProps {
  currentUser: User;
  member: Member;
  allMembers: Member[];
  transactions: Transaction[];
  pointLedger: PointLedger[];
  policy: PointPolicy;
  rewards: Reward[];
  redemptions: Redemption[];
  announcements: Announcement[];
  awards: Award[];
  settings: SystemSettings;
  onSubmitTransaction: (payload: {
    memberId: string;
    transactionAmount: number;
    purchasedItems: PurchasedItem[];
    receiptImage?: string;
    notes?: string;
  }) => Promise<void>;
  onRequestRedemption: (rewardId: string) => Promise<void>;
  onUpdateProfile: (updates: Partial<Member>) => Promise<void>;
  onLogout: () => void;
}

export const MemberPortal: React.FC<MemberPortalProps> = ({
  currentUser,
  member,
  allMembers,
  transactions,
  pointLedger,
  policy,
  rewards,
  redemptions,
  announcements,
  awards,
  settings,
  onSubmitTransaction,
  onRequestRedemption,
  onUpdateProfile,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<MemberNavTab>('BERANDA');
  const [purchaseAmount, setPurchaseAmount] = useState<string>('75000');
  const [selectedMenus, setSelectedMenus] = useState<Record<string, number>>({});
  const [purchaseNotes, setPurchaseNotes] = useState<string>('');
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptDataUrl, setReceiptDataUrl] = useState<string>('');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  // Profile form state
  const [profName, setProfName] = useState(member.fullName);
  const [profEmail, setProfEmail] = useState(member.email || '');
  const [profAddress, setProfAddress] = useState(member.address || '');
  const [profBirthDate, setProfBirthDate] = useState(member.birthDate || '');

  const myTransactions = useMemo(
    () => transactions.filter((t) => t.memberId === member.memberId),
    [transactions, member.memberId]
  );

  const myLedger = useMemo(
    () => pointLedger.filter((l) => l.memberId === member.memberId),
    [pointLedger, member.memberId]
  );

  const myRedemptions = useMemo(
    () => redemptions.filter((r) => r.memberId === member.memberId),
    [redemptions, member.memberId]
  );

  const publishedAnnouncements = useMemo(
    () => announcements.filter((a) => a.status === 'Published'),
    [announcements]
  );

  const progress = useMemo(
    () => calculateNextRewardProgress(member.totalPoints, rewards),
    [member.totalPoints, rewards]
  );

  const rankings = useMemo(
    () => computeCustomerRankings(allMembers, transactions, settings),
    [allMembers, transactions, settings]
  );

  const myRanking = useMemo(
    () => rankings.find((r) => r.memberId === member.memberId) || null,
    [rankings, member.memberId]
  );

  const purchasedItemsList = useMemo<PurchasedItem[]>(() => {
    const items: PurchasedItem[] = [];
    for (const rule of policy.menuRules) {
      const qty = selectedMenus[rule.menuId] || 0;
      if (qty > 0) {
        items.push({
          menuId: rule.menuId,
          menuName: rule.menuName,
          qty,
          price: rule.defaultPrice,
          bonusPointsPerItem: rule.bonusPoints,
        });
      }
    }
    return items;
  }, [policy.menuRules, selectedMenus]);

  const pointEstimate = useMemo(() => {
    const amt = Number(purchaseAmount) || 0;
    return calculateTransactionPoints(amt, purchasedItemsList, policy);
  }, [purchaseAmount, purchasedItemsList, policy]);

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setReceiptDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePurchaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(purchaseAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setFeedbackMsg({ type: 'error', text: 'Masukkan nominal pembelian yang valid.' });
      return;
    }
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onSubmitTransaction({
        memberId: member.memberId,
        transactionAmount: amt,
        purchasedItems: purchasedItemsList,
        receiptImage: receiptDataUrl || undefined,
        notes: purchaseNotes || (receiptFileName ? `Bukti struk: ${receiptFileName}` : undefined),
      });
      setFeedbackMsg({
        type: 'success',
        text: `Permintaan penambahan +${pointEstimate.totalPoints} poin untuk transaksi Rp${amt.toLocaleString('id-ID')} berhasil dikirim dan sedang menunggu verifikasi kasir.`,
      });
      setPurchaseNotes('');
      setSelectedMenus({});
      setReceiptFileName('');
      setReceiptDataUrl('');
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Gagal mengirim permintaan transaksi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRedeemClick = async (reward: Reward) => {
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onRequestRedemption(reward.rewardId);
      setFeedbackMsg({
        type: 'success',
        text: `Permintaan penukaran "${reward.rewardName}" (${reward.requiredPoints} Poin) telah dikirim ke kasir untuk verifikasi!`,
      });
    } catch (err: any) {
      setFeedbackMsg({
        type: 'error',
        text: err?.message || 'Gagal mengajukan penukaran reward.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) {
      setFeedbackMsg({ type: 'error', text: 'Nama lengkap tidak boleh kosong.' });
      return;
    }
    setSubmitting(true);
    setFeedbackMsg(null);
    try {
      await onUpdateProfile({
        fullName: profName.trim(),
        email: profEmail.trim(),
        address: profAddress.trim(),
        birthDate: profBirthDate,
      });
      setFeedbackMsg({ type: 'success', text: 'Profil member berhasil diperbarui.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err?.message || 'Gagal memperbarui profil.' });
    } finally {
      setSubmitting(false);
    }
  };

  const navItems: Array<{ id: MemberNavTab; label: string; icon: React.ReactNode }> = [
    { id: 'BERANDA', label: 'Beranda', icon: <Home className="w-4 h-4" /> },
    { id: 'KARTU_MEMBER', label: 'Kartu Member', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'CATAT_PEMBELIAN', label: 'Catat Pembelian', icon: <PlusCircle className="w-4 h-4" /> },
    { id: 'POIN_SAYA', label: 'Poin Saya', icon: <History className="w-4 h-4" /> },
    { id: 'REWARDS', label: 'Rewards', icon: <Gift className="w-4 h-4" /> },
    { id: 'RANKING', label: 'Ranking Member', icon: <Trophy className="w-4 h-4" /> },
    { id: 'PENGUMUMAN', label: 'Pengumuman', icon: <Bell className="w-4 h-4" /> },
    { id: 'PROFIL', label: 'Profil', icon: <UserIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[#F7F3EF] flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden md:flex md:w-64 lg:w-72 bg-[#391C19] text-white flex-col justify-between shrink-0 min-h-screen">
        <div>
          <div className="p-6 border-b border-white/10 flex items-center gap-3">
            <MinangCrestLogo className="w-10 h-10 shrink-0" />
            <div className="min-w-0">
              <p className="font-display text-base font-bold text-white truncate">
                {settings.restaurantName}
              </p>
              <p className="text-xs text-[#D9B432] truncate">Member Loyalty Portal</p>
            </div>
          </div>

          {/* Member Summary Mini Card */}
          <div className="p-4 mx-4 my-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-xs font-bold text-[#D9B432]">
                {member.memberId}
              </span>
              <span className="text-[11px] text-[#F7F3EF]/80">{member.memberStatus}</span>
            </div>
            <p className="font-semibold text-sm text-white truncate">{member.fullName}</p>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-[#F7F3EF]/70">Saldo Poin:</span>
              <span className="font-mono-tabular font-bold text-[#D9B432]">
                {member.totalPoints} Poin
              </span>
            </div>
          </div>

          <nav className="px-3 space-y-1" aria-label="Navigasi Member">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setFeedbackMsg(null);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-[#8E1118] text-white border border-[#D9B432]/40'
                    : 'text-[#F7F3EF]/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-white/10">
          <button
            type="button"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white bg-white/10 hover:bg-[#8E1118] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Keluar</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-[#391C19]/10 px-4 sm:px-8 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-xl font-bold text-[#391C19] truncate">
                Halo, {member.fullName}
              </h1>
              <p className="text-xs text-[#391C19]/70 truncate">
                Top Ampera Loyalty · ID:{' '}
                <span className="font-mono-tabular font-bold text-[#8E1118]">{member.memberId}</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('CATAT_PEMBELIAN')}
                className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-[#D9B432]" />
                <span className="sm:hidden">+ Tambah Poin</span>
                <span className="hidden sm:inline">+ Catat Pembelian / Tambah Poin</span>
              </button>
            </div>
          </div>

          {/* Mobile Secondary Navigation Strip for Poin Saya, Pengumuman, Profil & Logout */}
          <div className="md:hidden flex items-center justify-between gap-1.5 pt-2 border-t border-[#391C19]/10 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('POIN_SAYA')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                activeTab === 'POIN_SAYA' ? 'bg-[#8E1118] text-white' : 'bg-[#F7F3EF] text-[#391C19]'
              }`}
            >
              Poin Saya
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PENGUMUMAN')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                activeTab === 'PENGUMUMAN' ? 'bg-[#8E1118] text-white' : 'bg-[#F7F3EF] text-[#391C19]'
              }`}
            >
              Pengumuman
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PROFIL')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold whitespace-nowrap cursor-pointer ${
                activeTab === 'PROFIL' ? 'bg-[#8E1118] text-white' : 'bg-[#F7F3EF] text-[#391C19]'
              }`}
            >
              Profil
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="px-2.5 py-1 rounded text-[11px] font-semibold text-red-800 bg-red-50 whitespace-nowrap cursor-pointer"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {feedbackMsg && (
          <div
            className={`mx-4 sm:mx-8 mt-4 p-4 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <span>{feedbackMsg.text}</span>
            <button
              type="button"
              onClick={() => setFeedbackMsg(null)}
              className="font-bold underline shrink-0 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        )}

        <main className="p-4 sm:p-8 space-y-6 max-w-6xl w-full mx-auto">
          {/* TAB 1: BERANDA */}
          {activeTab === 'BERANDA' && (
            <div className="space-y-6">
              {/* Top Grid: Digital Member Card + Point Balance & Loyalty Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Digital Member Card Preview */}
                <div className="lg:col-span-5 bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col justify-between">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                      Digital Member Card
                    </span>
                    <span className="font-mono-tabular text-xs text-[#391C19]/65">
                      {member.memberId}
                    </span>
                  </div>
                  <MemberCardDigital
                    member={member}
                    settings={settings}
                    compact
                    onOpenFullCard={() => setActiveTab('KARTU_MEMBER')}
                  />
                </div>

                {/* Point Balance + Primary Actions + Loyalty Progress */}
                <div className="lg:col-span-7 bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-col justify-between space-y-5">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                        Ringkasan Saldo Poin & Kunjungan
                      </span>
                      <span className="font-mono-tabular text-xs font-semibold text-[#391C19]/75">
                        Kunjungan Valid: {member.totalVisits}x
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3 bg-[#F7F3EF] p-4 rounded-xl border border-[#391C19]/10">
                      <div>
                        <p className="text-[11px] text-[#391C19]/70">Total Saldo Poin</p>
                        <p
                          data-testid="member-point-balance"
                          className="font-mono-tabular text-2xl sm:text-3xl font-bold text-[#8E1118]"
                        >
                          {member.totalPoints}
                        </p>
                        <p className="text-[10px] text-[#391C19]/60">Poin Aktif</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#391C19]/70">Poin Diperoleh</p>
                        <p className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#391C19]">
                          {member.lifetimeEarnedPoints}
                        </p>
                        <p className="text-[10px] text-[#391C19]/60">Akumulasi</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[#391C19]/70">Poin Ditukarkan</p>
                        <p className="font-mono-tabular text-xl sm:text-2xl font-bold text-[#D9B432]">
                          {member.lifetimeRedeemedPoints}
                        </p>
                        <p className="text-[10px] text-[#391C19]/60">Reward Diklaim</p>
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Progress Toward Next Reward (Matches PRD Section 5.J) */}
                  <div className="bg-[#F7F3EF]/70 p-4 rounded-xl border border-[#D9B432]/50 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#391C19] flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#D9B432]" />
                        Loyalty Progress Menuju Hadiah Berikutnya
                      </span>
                      <span className="font-mono-tabular font-bold text-[#8E1118]">
                        {member.totalPoints} / {progress.nextReward?.requiredPoints || member.totalPoints}{' '}
                        Poin ({progress.progressPercent}%)
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-[#391C19]/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#8E1118] to-[#D9B432] transition-all duration-300"
                        style={{ width: `${progress.progressPercent}%` }}
                      />
                    </div>

                    <p className="text-xs text-[#391C19]/85">
                      {progress.nextReward && progress.pointsNeeded > 0 ? (
                        <>
                          Saldo saat ini <strong>{member.totalPoints} poin</strong> · Target reward{' '}
                          <strong>{progress.nextReward.requiredPoints} poin</strong> · Kurang{' '}
                          <strong className="text-[#8E1118]">{progress.pointsNeeded} poin lagi</strong>{' '}
                          untuk mendapatkan <strong>{progress.nextReward.rewardName}</strong>.
                        </>
                      ) : (
                        <>
                          Selamat! Saldo poin Anda mencukupi untuk menukarkan hadiah utama{' '}
                          <strong>{progress.nextReward?.rewardName}</strong>.
                        </>
                      )}
                    </p>
                  </div>

                  {/* 3 Primary Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('CATAT_PEMBELIAN')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 text-[#D9B432]" />
                      Catat Pembelian
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('REWARDS')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e3be3b] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Gift className="w-4 h-4" />
                      Tukarkan Reward
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('POIN_SAYA')}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-[#391C19] bg-[#F7F3EF] hover:bg-[#391C19]/10 border border-[#391C19]/15 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <History className="w-4 h-4 text-[#8E1118]" />
                      Lihat Riwayat Poin
                    </button>
                  </div>
                </div>
              </div>

              {/* Middle Row: Ranking Position & Top 3 + Announcements */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Ranking Summary */}
                <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                        Posisi Ranking Anda
                      </span>
                      <h3 className="font-display text-lg font-bold text-[#391C19]">
                        Peringkat #{myRanking?.rankPosition || '-'} · {member.totalVisits} Kunjungan
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('RANKING')}
                      className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Lihat Klasemen Penuh
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#391C19]/75">
                      Top 3 Pelanggan Paling Loyal Saat Ini:
                    </p>
                    {rankings.slice(0, 3).map((r) => (
                      <div
                        key={r.memberId}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          r.memberId === member.memberId
                            ? 'bg-[#D9B432]/15 border-[#D9B432]'
                            : 'bg-[#F7F3EF]/60 border-[#391C19]/10'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono-tabular text-xs font-bold text-[#8E1118] w-14 shrink-0">
                            TOP {r.rankPosition}
                          </span>
                          <span className="text-xs font-semibold text-[#391C19] truncate">
                            {r.memberName}
                            {r.memberId === member.memberId && ' (Anda)'}
                          </span>
                        </div>
                        <div className="text-right font-mono-tabular text-xs shrink-0">
                          <span className="font-bold text-[#8E1118]">{r.totalVisits}x Kunjungan</span>
                          <span className="text-[#391C19]/60"> · {r.totalPoints} Poin</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Latest Announcements */}
                <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                        Pengumuman & Promo
                      </span>
                      <h3 className="font-display text-lg font-bold text-[#391C19]">
                        Informasi Terbaru Top Ampera
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('PENGUMUMAN')}
                      className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                    >
                      Semua Pengumuman
                    </button>
                  </div>

                  <div className="space-y-3">
                    {publishedAnnouncements.slice(0, 2).map((ann) => (
                      <div
                        key={ann.announcementId}
                        className="p-3.5 rounded-lg bg-[#F7F3EF]/70 border border-[#391C19]/10 space-y-1"
                      >
                        <div className="flex items-center gap-2 text-[11px] text-[#8E1118] font-semibold">
                          <span>{ann.category}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-[#391C19]/65">{ann.publishDate}</span>
                        </div>
                        <h4 className="text-sm font-bold text-[#391C19]">{ann.title}</h4>
                        <p className="text-xs text-[#391C19]/80 line-clamp-2">{ann.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Activity Table */}
              <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-[#391C19]">
                    Riwayat Aktivitas & Transaksi Terbaru Anda
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActiveTab('POIN_SAYA')}
                    className="text-xs font-semibold text-[#8E1118] hover:underline cursor-pointer"
                  >
                    Lihat Buku Besar Poin
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                        <th className="py-3 px-4">Kode Transaksi</th>
                        <th className="py-3 px-4">Tanggal</th>
                        <th className="py-3 px-4 text-right">Nominal</th>
                        <th className="py-3 px-4 text-right">Estimasi / Poin</th>
                        <th className="py-3 px-4">Status Verifikasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#391C19]/10 text-xs">
                      {myTransactions.slice(0, 5).map((tx) => (
                        <tr key={tx.transactionId} className="hover:bg-[#F7F3EF]/50">
                          <td className="py-3 px-4 font-mono-tabular font-bold text-[#391C19]">
                            {tx.transactionCode}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-[#391C19]/75">
                            {tx.transactionDate.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                            Rp{tx.transactionAmount.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#8E1118]">
                            +{tx.verificationStatus === 'Approved' ? tx.approvedPoints : tx.calculatedPoints}{' '}
                            Poin
                          </td>
                          <td className="py-3 px-4">
                            {tx.verificationStatus === 'Approved' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Approved (Disetujui)
                              </span>
                            )}
                            {tx.verificationStatus === 'Pending' && (
                              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                                <Clock className="w-3.5 h-3.5" />
                                Pending (Menunggu Kasir)
                              </span>
                            )}
                            {(tx.verificationStatus === 'Rejected' ||
                              tx.verificationStatus === 'Cancelled') && (
                              <span className="font-semibold text-red-700">
                                {tx.verificationStatus}
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

          {/* TAB 2: KARTU MEMBER DIGITAL */}
          {activeTab === 'KARTU_MEMBER' && (
            <MemberCardDigital member={member} settings={settings} />
          )}

          {/* TAB 3: CATAT PEMBELIAN / TAMBAH POIN */}
          {activeTab === 'CATAT_PEMBELIAN' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handlePurchaseSubmit}
                className="lg:col-span-7 bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-5"
              >
                <div className="border-b border-[#391C19]/10 pb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                    Pengajuan Poin Pembelian
                  </span>
                  <h2 className="font-display text-xl font-bold text-[#391C19]">
                    + Catat Pembelian / Tambah Poin
                  </h2>
                  <p className="text-xs text-[#391C19]/75 mt-1">
                    Masukkan nominal struk belanja Anda di Top Ampera. Sistem menghitung estimasi poin otomatis dan meneruskan ke kasir untuk diverifikasi.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="member-purchase-amount"
                    className="block text-xs font-bold text-[#391C19] mb-1.5"
                  >
                    Nominal Transaksi Pembelian (Rp)
                  </label>
                  <input
                    id="member-purchase-amount"
                    type="number"
                    min={1000}
                    step={500}
                    required
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    placeholder="Contoh: 75000"
                    className="w-full px-4 py-2.5 text-base font-mono-tabular font-bold border border-[#391C19]/20 rounded-lg focus:outline-none focus:border-[#8E1118]"
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {[25000, 50000, 75000, 100000, 150000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPurchaseAmount(String(preset))}
                        className="px-2.5 py-1 text-xs font-mono-tabular font-semibold bg-[#F7F3EF] hover:bg-[#D9B432]/30 border border-[#391C19]/15 rounded-md cursor-pointer"
                      >
                        Rp{preset.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Menu Bonus Selector */}
                {policy.enableMenuBonus && (
                  <div className="space-y-2.5">
                    <label className="block text-xs font-bold text-[#391C19]">
                      Pilih Menu dengan Bonus Poin Tambahan (Opsional)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {policy.menuRules
                        .filter((r) => r.isActive)
                        .map((rule) => {
                          const qty = selectedMenus[rule.menuId] || 0;
                          return (
                            <div
                              key={rule.menuId}
                              className={`p-3 rounded-lg border flex items-center justify-between gap-2 ${
                                qty > 0
                                  ? 'bg-[#D9B432]/15 border-[#D9B432]'
                                  : 'bg-[#F7F3EF]/60 border-[#391C19]/10'
                              }`}
                            >
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#391C19] truncate">
                                  {rule.menuName}
                                </p>
                                <p className="text-[11px] font-mono-tabular text-[#8E1118] font-semibold">
                                  Bonus +{rule.bonusPoints} Poin / porsi
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  aria-label={`Kurangi ${rule.menuName}`}
                                  onClick={() =>
                                    setSelectedMenus((prev) => ({
                                      ...prev,
                                      [rule.menuId]: Math.max(0, (prev[rule.menuId] || 0) - 1),
                                    }))
                                  }
                                  className="w-6 h-6 rounded bg-white border border-[#391C19]/20 font-bold text-xs cursor-pointer"
                                >
                                  -
                                </button>
                                <span className="font-mono-tabular text-xs font-bold w-5 text-center">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Tambah ${rule.menuName}`}
                                  onClick={() =>
                                    setSelectedMenus((prev) => ({
                                      ...prev,
                                      [rule.menuId]: (prev[rule.menuId] || 0) + 1,
                                    }))
                                  }
                                  className="w-6 h-6 rounded bg-[#8E1118] text-white font-bold text-xs cursor-pointer"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Receipt Upload & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#391C19] mb-1">
                      Upload Foto Struk Pembelian (Opsional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleReceiptFileChange}
                      className="w-full text-xs text-[#391C19]/80 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-[#F7F3EF] file:text-[#8E1118] hover:file:bg-[#D9B432]/30"
                    />
                    {receiptFileName && (
                      <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                        Terlampir: {receiptFileName}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#391C19] mb-1">
                      Nomor Meja / Catatan Struk
                    </label>
                    <input
                      type="text"
                      value={purchaseNotes}
                      onChange={(e) => setPurchaseNotes(e.target.value)}
                      placeholder="Contoh: Makan siang Meja 05"
                      className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !pointEstimate.eligible}
                  className="w-full py-3 px-5 text-sm font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {submitting
                    ? 'Mengirim Permintaan...'
                    : `Kirim Permintaan Verifikasi (+${pointEstimate.totalPoints} Poin)`}
                </button>
              </form>

              {/* Right Column: Live Automatic Point Estimator */}
              <div className="lg:col-span-5 bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4">
                <div className="flex items-center gap-2 border-b border-[#391C19]/10 pb-3">
                  <Receipt className="w-5 h-5 text-[#8E1118]" />
                  <h3 className="font-display text-lg font-bold text-[#391C19]">
                    Kalkulator Estimasi Poin Otomatis
                  </h3>
                </div>

                <div className="bg-[#F7F3EF] p-4 rounded-xl border border-[#D9B432]/50 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#391C19]/75">Nominal Pembelian:</span>
                    <span className="font-mono-tabular font-bold text-[#391C19]">
                      Rp{(Number(purchaseAmount) || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#391C19]/75">Poin Dasar Nominal:</span>
                    <span className="font-mono-tabular font-bold text-[#391C19]">
                      +{pointEstimate.basePoints} Poin
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#391C19]/75">Bonus Menu Pilihan:</span>
                    <span className="font-mono-tabular font-bold text-[#8E1118]">
                      +{pointEstimate.menuBonusPoints} Poin
                    </span>
                  </div>
                  {pointEstimate.promoBonusPoints > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#391C19]/75">Bonus Promo Aktif:</span>
                      <span className="font-mono-tabular font-bold text-emerald-700">
                        +{pointEstimate.promoBonusPoints} Poin
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[#391C19]/15 flex items-center justify-between">
                    <span className="text-xs font-bold text-[#391C19]">Total Estimasi Poin:</span>
                    <span
                      data-testid="estimated-points-output"
                      className="font-mono-tabular text-2xl font-bold text-[#8E1118]"
                    >
                      +{pointEstimate.totalPoints} Poin
                    </span>
                  </div>
                </div>

                {!pointEstimate.eligible && pointEstimate.reason && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    {pointEstimate.reason}
                  </p>
                )}

                <div className="text-xs text-[#391C19]/75 space-y-1.5">
                  <p className="font-bold text-[#391C19]">Aturan Perolehan Poin Saat Ini:</p>
                  <p>{policy.termsAndConditions}</p>
                  <p className="text-[11px] text-[#391C19]/60">
                    Catatan Keamanan: Poin akan otomatis masuk ke saldo Anda segera setelah kasir mengonfirmasi transaksi.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: POIN SAYA & POINT LEDGER */}
          {activeTab === 'POIN_SAYA' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[#391C19]">
                      Buku Besar Poin (Point Ledger)
                    </h2>
                    <p className="text-xs text-[#391C19]/70">
                      Catatan lengkap seluruh perubahan poin: Earned, Bonus, Redeemed, Adjustment, Expired, dan Reversal.
                    </p>
                  </div>
                  <span className="font-mono-tabular text-sm font-bold text-[#8E1118]">
                    Saldo Akhir: {member.totalPoints} Poin
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                        <th className="py-3 px-4">Waktu</th>
                        <th className="py-3 px-4">Jenis Aktivitas</th>
                        <th className="py-3 px-4">Keterangan</th>
                        <th className="py-3 px-4 text-right">Poin Masuk</th>
                        <th className="py-3 px-4 text-right">Poin Keluar</th>
                        <th className="py-3 px-4 text-right">Saldo Setelah</th>
                        <th className="py-3 px-4">Petugas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#391C19]/10 text-xs">
                      {myLedger.map((entry) => (
                        <tr key={entry.ledgerId} className="hover:bg-[#F7F3EF]/50">
                          <td className="py-3 px-4 font-mono-tabular text-[#391C19]/75">
                            {entry.createdAt.slice(0, 16).replace('T', ' ')}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#8E1118]">
                            {entry.activityType}
                          </td>
                          <td className="py-3 px-4 text-[#391C19]">{entry.description}</td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-700">
                            {entry.pointIn > 0 ? `+${entry.pointIn}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-red-700">
                            {entry.pointOut > 0 ? `-${entry.pointOut}` : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#391C19]">
                            {entry.balanceAfter} Poin
                          </td>
                          <td className="py-3 px-4 text-[#391C19]/70">{entry.createdByName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: REWARDS & BENEFITS */}
          {activeTab === 'REWARDS' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                    Rewards & Benefits
                  </span>
                  <h2 className="font-display text-2xl font-bold text-[#391C19]">
                    Tukarkan Poin dengan Hidangan & Keuntungan Spesial
                  </h2>
                </div>
                <div className="bg-[#F7F3EF] px-4 py-2.5 rounded-xl border border-[#D9B432] text-right">
                  <p className="text-[11px] text-[#391C19]/70">Saldo Poin Anda</p>
                  <p className="font-mono-tabular text-xl font-bold text-[#8E1118]">
                    {member.totalPoints} Poin
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {rewards
                  .filter((r) => r.isActive)
                  .map((reward) => {
                    const canRedeem = member.totalPoints >= reward.requiredPoints && reward.stock > 0;
                    const diff = Math.max(0, reward.requiredPoints - member.totalPoints);
                    return (
                      <div
                        key={reward.rewardId}
                        className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#8E1118] flex items-center gap-1">
                              <Utensils className="w-3.5 h-3.5" />
                              {reward.category}
                            </span>
                            <span className="font-mono-tabular font-bold text-[#391C19] bg-[#D9B432]/25 px-2.5 py-0.5 rounded">
                              {reward.requiredPoints} Poin
                            </span>
                          </div>
                          <h3 className="font-display text-lg font-bold text-[#391C19]">
                            {reward.rewardName}
                          </h3>
                          <p className="text-xs text-[#391C19]/75 leading-relaxed">
                            {reward.description}
                          </p>
                          <p className="text-[11px] text-[#391C19]/60">
                            Stok tersedia: <strong className="font-mono-tabular">{reward.stock}</strong> · Berlaku s/d{' '}
                            <span className="font-mono-tabular">{reward.validityPeriod}</span>
                          </p>
                        </div>

                        <div className="pt-3 border-t border-[#391C19]/10">
                          {canRedeem ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleRedeemClick(reward)}
                              className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors cursor-pointer"
                            >
                              Tukarkan Reward ({reward.requiredPoints} Poin)
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="w-full py-2.5 px-4 text-xs font-semibold text-[#391C19]/50 bg-[#F7F3EF] rounded-lg cursor-not-allowed"
                            >
                              {reward.stock <= 0
                                ? 'Stok Habis'
                                : `Kurang ${diff} Poin Lagi`}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* My Redemptions List */}
              <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-[#391C19]/10">
                  <h3 className="font-display text-base font-bold text-[#391C19]">
                    Kode Penukaran Reward Saya ({myRedemptions.length})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                        <th className="py-3 px-4">Kode Unik</th>
                        <th className="py-3 px-4">Hadiah</th>
                        <th className="py-3 px-4 text-right">Poin Digunakan</th>
                        <th className="py-3 px-4">Tanggal Pengajuan</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#391C19]/10 text-xs">
                      {myRedemptions.map((red) => (
                        <tr key={red.redemptionId}>
                          <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                            {red.redemptionCode}
                          </td>
                          <td className="py-3 px-4 font-semibold text-[#391C19]">
                            {red.rewardName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular">
                            {red.pointsUsed} Poin
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-[#391C19]/70">
                            {red.requestedAt.slice(0, 10)}
                          </td>
                          <td className="py-3 px-4 font-semibold">
                            {red.status === 'Redeemed' || red.status === 'Approved' ? (
                              <span className="text-emerald-700">{red.status}</span>
                            ) : red.status === 'Pending' ? (
                              <span className="text-amber-700">Pending (Tunjukkan ke Kasir)</span>
                            ) : (
                              <span className="text-red-700">{red.status}</span>
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

          {/* TAB 6: RANKING MEMBER */}
          {activeTab === 'RANKING' && (
            <CustomerRankingView
              members={allMembers}
              transactions={transactions}
              awards={awards}
              settings={settings}
              policy={policy}
              currentUser={currentUser}
              currentMemberId={member.memberId}
            />
          )}

          {/* TAB 7: PENGUMUMAN */}
          {activeTab === 'PENGUMUMAN' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl p-6 border border-[#391C19]/10">
                <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                  Announcement Center
                </span>
                <h2 className="font-display text-2xl font-bold text-[#391C19]">
                  Pengumuman & Informasi Program Loyalty Top Ampera
                </h2>
              </div>

              <div className="space-y-4">
                {publishedAnnouncements.map((ann) => (
                  <article
                    key={ann.announcementId}
                    className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-2"
                  >
                    <div className="flex items-center gap-2 text-xs text-[#8E1118] font-semibold">
                      <span>{ann.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-[#391C19]/65">
                        Dipublikasikan {ann.publishDate}
                      </span>
                      {ann.isPinned && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#D9B432] font-bold">Informasi Prioritas</span>
                        </>
                      )}
                    </div>
                    <h3 className="font-display text-lg font-bold text-[#391C19]">{ann.title}</h3>
                    <p className="text-sm text-[#391C19]/85 leading-relaxed">{ann.content}</p>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* TAB 8: PROFIL MEMBER */}
          {activeTab === 'PROFIL' && (
            <form
              onSubmit={handleSaveProfile}
              className="bg-white rounded-xl p-6 border border-[#391C19]/10 max-w-2xl space-y-4"
            >
              <div className="border-b border-[#391C19]/10 pb-3">
                <h2 className="font-display text-xl font-bold text-[#391C19]">Profil Member Saya</h2>
                <p className="text-xs text-[#391C19]/70">
                  ID Member ({member.memberId}) bersifat permanen dan tidak berubah meskipun profil diperbarui.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    ID Member (Permanen)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={member.memberId}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold bg-[#F7F3EF] border border-[#391C19]/15 rounded-lg text-[#8E1118]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Nomor WhatsApp Terdaftar
                  </label>
                  <input
                    type="text"
                    disabled
                    value={member.phone}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular bg-[#F7F3EF] border border-[#391C19]/15 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    value={profEmail}
                    onChange={(e) => setProfEmail(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={profBirthDate}
                    onChange={(e) => setProfBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Alamat Domisili</label>
                <input
                  type="text"
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
              >
                Simpan Perubahan Profil
              </button>
            </form>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (<= 15% viewport height cap) */}
      <nav
        aria-label="Navigasi Bawah Smartphone"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-[#391C19]/15 z-40 grid grid-cols-5 h-14 px-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('BERANDA')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'BERANDA' ? 'text-[#8E1118]' : 'text-[#391C19]/65'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Beranda</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('KARTU_MEMBER')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'KARTU_MEMBER' ? 'text-[#8E1118]' : 'text-[#391C19]/65'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Kartu QR</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('CATAT_PEMBELIAN')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold cursor-pointer ${
            activeTab === 'CATAT_PEMBELIAN' ? 'text-[#8E1118]' : 'text-[#8E1118]/85'
          }`}
        >
          <PlusCircle className="w-5 h-5" />
          <span>+ Poin</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('REWARDS')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'REWARDS' ? 'text-[#8E1118]' : 'text-[#391C19]/65'
          }`}
        >
          <Gift className="w-4 h-4" />
          <span>Rewards</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('RANKING')}
          className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
            activeTab === 'RANKING' ? 'text-[#8E1118]' : 'text-[#391C19]/65'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Ranking</span>
        </button>
      </nav>
    </div>
  );
};
