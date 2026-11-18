import React, { useMemo, useState } from 'react';
import { Award, Member, PointPolicy, RankingEntry, SystemSettings, Transaction, User } from '../types/loyalty';
import { computeCustomerRankings } from '../utils/loyaltyEngine';
import { Award as AwardIcon, CheckCircle2, Crown, Medal, ShieldAlert, Trophy, Users } from 'lucide-react';

interface CustomerRankingViewProps {
  members: Member[];
  transactions: Transaction[];
  awards: Award[];
  settings: SystemSettings;
  policy: PointPolicy;
  currentUser: User | null;
  currentMemberId?: string;
  onAssignAward?: (payload: {
    memberId: string;
    period: string;
    periodLabel: string;
    rank: 1 | 2 | 3;
    totalVisitsSnapshot: number;
    totalPointsSnapshot: number;
    rewardDescription: string;
    notes?: string;
    status: 'Ditetapkan' | 'Sudah Diberikan';
    isPublished: boolean;
    publishAnnouncement: boolean;
  }) => Promise<void>;
  onUpdateAwardStatus?: (awardId: string, status: 'Ditetapkan' | 'Sudah Diberikan') => Promise<void>;
}

function maskMemberName(name: string, isPublic: boolean, isSelf: boolean, isStaff: boolean): string {
  if (isPublic || isSelf || isStaff) return name;
  const parts = name.trim().split(' ');
  return parts
    .map((p, i) => (i === 0 ? p : `${p.charAt(0)}***`))
    .join(' ');
}

export const CustomerRankingView: React.FC<CustomerRankingViewProps> = ({
  members,
  transactions,
  awards,
  settings,
  policy,
  currentUser,
  currentMemberId,
  onAssignAward,
  onUpdateAwardStatus,
}) => {
  const [periodMode, setPeriodMode] = useState<'MONTHLY' | 'ANNUAL' | 'ALL_TIME'>(settings.rankingPeriodType);
  const [selectedMonth, setSelectedMonth] = useState(settings.activeRankingPeriod || '2026-11');
  const [awardModalTarget, setAwardModalTarget] = useState<{
    entry: RankingEntry;
    rank: 1 | 2 | 3;
  } | null>(null);
  const [rewardDesc, setRewardDesc] = useState('');
  const [awardNotes, setAwardNotes] = useState('');
  const [awardStatus, setAwardStatus] = useState<'Ditetapkan' | 'Sudah Diberikan'>('Ditetapkan');
  const [publishAnn, setPublishAnn] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isStaff = Boolean(currentUser && (currentUser.role === 'OWNER' || currentUser.role === 'ADMIN' || currentUser.role === 'KASIR'));
  const isOwner = Boolean(currentUser && currentUser.role === 'OWNER');

  const effectiveSettings = useMemo<SystemSettings>(
    () => ({
      ...settings,
      rankingPeriodType: periodMode,
      activeRankingPeriod:
        periodMode === 'MONTHLY'
          ? selectedMonth
          : periodMode === 'ANNUAL'
          ? selectedMonth.slice(0, 4)
          : 'ALL',
    }),
    [settings, periodMode, selectedMonth]
  );

  const rankings = useMemo(
    () =>
      computeCustomerRankings(
        members,
        transactions,
        effectiveSettings,
        effectiveSettings.activeRankingPeriod
      ),
    [members, transactions, effectiveSettings]
  );

  const top1 = rankings[0] || null;
  const top2 = rankings[1] || null;
  const top3 = rankings[2] || null;

  const openAwardModal = (entry: RankingEntry, rank: 1 | 2 | 3) => {
    const defaultReward =
      rank === 1
        ? settings.rank1RewardDefault
        : rank === 2
        ? settings.rank2RewardDefault
        : settings.rank3RewardDefault;
    setRewardDesc(defaultReward);
    setAwardNotes('');
    setAwardStatus('Ditetapkan');
    setPublishAnn(true);
    setAwardModalTarget({ entry, rank });
  };

  const handleConfirmAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardModalTarget || !onAssignAward) return;
    setSubmitting(true);
    try {
      const periodLabel =
        periodMode === 'MONTHLY'
          ? `Bulan ${selectedMonth}`
          : periodMode === 'ANNUAL'
          ? `Tahun ${selectedMonth.slice(0, 4)}`
          : 'Sepanjang Waktu';
      await onAssignAward({
        memberId: awardModalTarget.entry.memberId,
        period: selectedMonth,
        periodLabel,
        rank: awardModalTarget.rank,
        totalVisitsSnapshot: awardModalTarget.entry.totalVisits,
        totalPointsSnapshot: awardModalTarget.entry.totalPoints,
        rewardDescription: rewardDesc,
        notes: awardNotes,
        status: awardStatus,
        isPublished: true,
        publishAnnouncement: publishAnn,
      });
      setAwardModalTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Period Filter */}
      <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#8E1118]">
            TOP AMPERA LOYAL CUSTOMER
          </p>
          <h2 className="font-display text-2xl font-bold text-[#391C19] mt-0.5">
            Peringkat Pelanggan Paling Loyal (Top 1, Top 2, Top 3)
          </h2>
          <p className="text-xs text-[#391C19]/75 mt-1">
            Berdasarkan jumlah kunjungan yang telah diverifikasi kasir · Jeda validasi anti-pecah transaksi: {policy.visitCooldownMinutes} menit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-[#F7F3EF] p-1 rounded-lg border border-[#391C19]/10">
            <button
              type="button"
              onClick={() => setPeriodMode('MONTHLY')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                periodMode === 'MONTHLY'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Bulanan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('ANNUAL')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                periodMode === 'ANNUAL'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Tahunan
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('ALL_TIME')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                periodMode === 'ALL_TIME'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Sepanjang Waktu
            </button>
          </div>

          {periodMode === 'MONTHLY' && (
            <label className="flex items-center gap-2 text-xs font-medium text-[#391C19]">
              <span>Periode:</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Pilih bulan ranking"
                className="px-3 py-1.5 text-xs font-mono-tabular bg-[#F7F3EF] border border-[#391C19]/20 rounded-lg"
              />
            </label>
          )}
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* TOP 2 - SILVER */}
        {top2 && (
          <div className="order-2 md:order-1 bg-white rounded-xl p-6 border border-slate-300 flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Medal className="w-4 h-4 text-slate-500" />
                  TOP 2 · SILVER
                </span>
                <span className="font-mono-tabular text-xs text-[#391C19]/60">{top2.memberId}</span>
              </div>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center font-display text-lg font-bold text-slate-700 shrink-0">
                  {top2.memberName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-[#391C19] truncate">
                    {maskMemberName(
                      top2.memberName,
                      settings.publicLeaderboardNames,
                      currentMemberId === top2.memberId,
                      isStaff
                    )}
                  </h3>
                  <p className="text-xs text-[#391C19]/70">
                    Hadiah: {settings.rank2RewardDefault}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#391C19]/10">
                <div>
                  <p className="text-[11px] text-[#391C19]/65">Total Kunjungan</p>
                  <p className="font-mono-tabular text-xl font-bold text-[#8E1118]">
                    {top2.totalVisits}x
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#391C19]/65">Total Poin</p>
                  <p className="font-mono-tabular text-xl font-bold text-[#391C19]">
                    {top2.totalPoints} Poin
                  </p>
                </div>
              </div>
            </div>

            {isOwner && onAssignAward && (
              <button
                type="button"
                onClick={() => openAwardModal(top2, 2)}
                className="mt-5 w-full py-2 px-3 text-xs font-semibold text-[#391C19] bg-[#F7F3EF] hover:bg-[#D9B432]/25 border border-[#391C19]/15 rounded-lg transition-colors cursor-pointer"
              >
                Tetapkan Pemenang Top 2
              </button>
            )}
          </div>
        )}

        {/* TOP 1 - GOLD CROWN */}
        {top1 && (
          <div className="order-1 md:order-2 bg-gradient-to-b from-[#8E1118] to-[#590A0E] text-white rounded-xl p-6 border-2 border-[#D9B432] shadow-md flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#D9B432]">
                  <Crown className="w-4 h-4 text-[#D9B432]" />
                  TOP 1 · MAHKOTA EMAS
                </span>
                <span className="font-mono-tabular text-xs text-[#F3E4A8]">{top1.memberId}</span>
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div className="w-14 h-14 rounded-full bg-[#D9B432] text-[#391C19] border-2 border-white flex items-center justify-center font-display text-xl font-bold shrink-0">
                  {top1.memberName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-bold text-white truncate">
                    {maskMemberName(
                      top1.memberName,
                      settings.publicLeaderboardNames,
                      currentMemberId === top1.memberId,
                      isStaff
                    )}
                  </h3>
                  <p className="text-xs text-[#F3E4A8] mt-0.5">
                    Hadiah Utama: {settings.rank1RewardDefault}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/15">
                <div>
                  <p className="text-[11px] text-[#F7F3EF]/75">Kunjungan Terverifikasi</p>
                  <p className="font-mono-tabular text-2xl font-bold text-[#D9B432]">
                    {top1.totalVisits}x
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#F7F3EF]/75">Total Poin</p>
                  <p className="font-mono-tabular text-2xl font-bold text-white">
                    {top1.totalPoints} Poin
                  </p>
                </div>
              </div>
            </div>

            {isOwner && onAssignAward && (
              <button
                type="button"
                onClick={() => openAwardModal(top1, 1)}
                className="mt-5 w-full py-2.5 px-4 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e5c349] rounded-lg transition-colors cursor-pointer"
              >
                Tetapkan Pemenang Top 1
              </button>
            )}
          </div>
        )}

        {/* TOP 3 - BRONZE */}
        {top3 && (
          <div className="order-3 bg-white rounded-xl p-6 border border-amber-700/30 flex flex-col justify-between relative">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-800">
                  <Trophy className="w-4 h-4 text-amber-700" />
                  TOP 3 · BRONZE
                </span>
                <span className="font-mono-tabular text-xs text-[#391C19]/60">{top3.memberId}</span>
              </div>

              <div className="flex items-center gap-3.5 mb-5">
                <div className="w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-600/40 flex items-center justify-center font-display text-lg font-bold text-amber-900 shrink-0">
                  {top3.memberName.charAt(0)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-bold text-[#391C19] truncate">
                    {maskMemberName(
                      top3.memberName,
                      settings.publicLeaderboardNames,
                      currentMemberId === top3.memberId,
                      isStaff
                    )}
                  </h3>
                  <p className="text-xs text-[#391C19]/70">
                    Hadiah: {settings.rank3RewardDefault}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[#391C19]/10">
                <div>
                  <p className="text-[11px] text-[#391C19]/65">Total Kunjungan</p>
                  <p className="font-mono-tabular text-xl font-bold text-[#8E1118]">
                    {top3.totalVisits}x
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-[#391C19]/65">Total Poin</p>
                  <p className="font-mono-tabular text-xl font-bold text-[#391C19]">
                    {top3.totalPoints} Poin
                  </p>
                </div>
              </div>
            </div>

            {isOwner && onAssignAward && (
              <button
                type="button"
                onClick={() => openAwardModal(top3, 3)}
                className="mt-5 w-full py-2 px-3 text-xs font-semibold text-[#391C19] bg-[#F7F3EF] hover:bg-[#D9B432]/25 border border-[#391C19]/15 rounded-lg transition-colors cursor-pointer"
              >
                Tetapkan Pemenang Top 3
              </button>
            )}
          </div>
        )}
      </div>

      {/* Full Leaderboard Table */}
      <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#391C19]/10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#8E1118]" />
            <h3 className="font-display text-base font-bold text-[#391C19]">
              Klasemen Lengkap Member Aktif ({rankings.length} Member)
            </h3>
          </div>
          <p className="text-xs text-[#391C19]/65">
            Indikator Utama: <strong>Jumlah Kunjungan Terverifikasi</strong> · Pemecah Seri (Tie-Breaker):{' '}
            <strong>Total Poin</strong>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                <th className="py-3 px-4">Peringkat</th>
                <th className="py-3 px-4">ID Member</th>
                <th className="py-3 px-4">Nama Pelanggan</th>
                <th className="py-3 px-4 text-right">Kunjungan Valid</th>
                <th className="py-3 px-4 text-right">Total Poin</th>
                <th className="py-3 px-4 text-right">Total Pembelian</th>
                <th className="py-3 px-4">Tanggal Bergabung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#391C19]/10 text-sm">
              {rankings.map((entry) => {
                const isSelf = currentMemberId === entry.memberId;
                return (
                  <tr
                    key={entry.memberId}
                    className={`hover:bg-[#F7F3EF]/60 transition-colors ${
                      isSelf ? 'bg-[#D9B432]/15 font-semibold' : ''
                    }`}
                  >
                    <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                      #{entry.rankPosition}
                      {entry.rankPosition === 1 && ' · Gold'}
                      {entry.rankPosition === 2 && ' · Silver'}
                      {entry.rankPosition === 3 && ' · Bronze'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs font-semibold text-[#391C19]">
                      {entry.memberId}
                    </td>
                    <td className="py-3 px-4 text-[#391C19]">
                      {maskMemberName(
                        entry.memberName,
                        settings.publicLeaderboardNames,
                        isSelf,
                        isStaff
                      )}
                      {isSelf && (
                        <span className="ml-2 text-xs font-semibold text-[#8E1118]">(Anda)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#8E1118]">
                      {entry.totalVisits} Kunjungan
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-[#391C19]">
                      {entry.totalPoints} Poin
                    </td>
                    <td className="py-3 px-4 text-right font-mono-tabular text-xs text-[#391C19]/80">
                      Rp{entry.totalSpend.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-[#391C19]/70">
                      {entry.joinDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Historical Award Winners Archive */}
      <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AwardIcon className="w-4 h-4 text-[#D9B432]" />
            <h3 className="font-display text-base font-bold text-[#391C19]">
              Riwayat Pemenang & Penghargaan Loyalitas
            </h3>
          </div>
          <span className="text-xs text-[#391C19]/65">{awards.length} Penghargaan Tercatat</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                <th className="py-3 px-4">Periode</th>
                <th className="py-3 px-4">Juara</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4 text-right">Rekor Kunjungan</th>
                <th className="py-3 px-4">Hadiah Apresiasi</th>
                <th className="py-3 px-4">Status Penyerahan</th>
                {isOwner && <th className="py-3 px-4 text-right">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#391C19]/10 text-sm">
              {awards.map((awd) => (
                <tr key={awd.awardId} className="hover:bg-[#F7F3EF]/50">
                  <td className="py-3 px-4 font-medium text-[#391C19]">{awd.periodLabel}</td>
                  <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                    TOP {awd.rank}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-[#391C19]">{awd.memberName}</span>
                    <span className="ml-1.5 font-mono-tabular text-xs text-[#391C19]/60">
                      ({awd.memberId})
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular">
                    {awd.totalVisitsSnapshot}x ({awd.totalPointsSnapshot} Poin)
                  </td>
                  <td className="py-3 px-4 text-xs text-[#391C19]">
                    <p className="font-semibold">{awd.rewardDescription}</p>
                    {awd.notes && <p className="text-[#391C19]/65 mt-0.5">{awd.notes}</p>}
                  </td>
                  <td className="py-3 px-4 text-xs">
                    {awd.status === 'Sudah Diberikan' ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Sudah Diberikan
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Ditetapkan (Menunggu Klaim)
                      </span>
                    )}
                  </td>
                  {isOwner && (
                    <td className="py-3 px-4 text-right">
                      {awd.status !== 'Sudah Diberikan' && onUpdateAwardStatus && (
                        <button
                          type="button"
                          onClick={() => onUpdateAwardStatus(awd.awardId, 'Sudah Diberikan')}
                          className="px-3 py-1 text-xs font-semibold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Tandai Sudah Diberikan
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Assign Winner Award */}
      {awardModalTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assign-award-title"
        >
          <form
            onSubmit={handleConfirmAward}
            className="bg-white rounded-2xl max-w-lg w-full p-6 border border-[#391C19]/15 shadow-xl space-y-4"
          >
            <div className="border-b border-[#391C19]/10 pb-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                Penetapan Penghargaan Loyalitas
              </p>
              <h3 id="assign-award-title" className="font-display text-lg font-bold text-[#391C19]">
                Tetapkan Juara TOP {awardModalTarget.rank}: {awardModalTarget.entry.memberName} (
                {awardModalTarget.entry.memberId})
              </h3>
            </div>

            <div className="bg-[#F7F3EF] p-3.5 rounded-lg text-xs space-y-1">
              <p>
                <strong>Kunjungan Terverifikasi:</strong>{' '}
                <span className="font-mono-tabular font-bold text-[#8E1118]">
                  {awardModalTarget.entry.totalVisits} Kunjungan
                </span>
              </p>
              <p>
                <strong>Total Poin:</strong>{' '}
                <span className="font-mono-tabular font-bold">
                  {awardModalTarget.entry.totalPoints} Poin
                </span>
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#391C19] mb-1">
                Deskripsi Hadiah Penghargaan
              </label>
              <input
                type="text"
                required
                value={rewardDesc}
                onChange={(e) => setRewardDesc(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#391C19] mb-1">
                Catatan Penghargaan (Opsional)
              </label>
              <textarea
                rows={2}
                value={awardNotes}
                onChange={(e) => setAwardNotes(e.target.value)}
                placeholder="Contoh: Dapat diambil langsung di kasir utama Top Ampera Batu."
                className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#391C19] mb-1">
                  Status Penyerahan Hadiah
                </label>
                <select
                  value={awardStatus}
                  onChange={(e) =>
                    setAwardStatus(e.target.value as 'Ditetapkan' | 'Sudah Diberikan')
                  }
                  className="w-full px-3 py-2 text-sm border border-[#391C19]/20 rounded-lg bg-white"
                >
                  <option value="Ditetapkan">Ditetapkan (Menunggu Klaim)</option>
                  <option value="Sudah Diberikan">Sudah Diberikan</option>
                </select>
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-medium text-[#391C19] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publishAnn}
                    onChange={(e) => setPublishAnn(e.target.checked)}
                    className="rounded border-[#391C19]/30 text-[#8E1118]"
                  />
                  Terbitkan ke Pengumuman Member
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#391C19]/10">
              <button
                type="button"
                onClick={() => setAwardModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-[#391C19] bg-[#F7F3EF] rounded-lg cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Menyimpan...' : 'Simpan & Tetapkan Penghargaan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
