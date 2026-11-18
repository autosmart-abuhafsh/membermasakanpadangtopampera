import React, { useMemo, useState } from 'react';
import {
  Announcement,
  Award,
  Member,
  PointPolicy,
  Reward,
  SystemSettings,
  Transaction,
} from '../types/loyalty';
import { computeCustomerRankings } from '../utils/loyaltyEngine';
import { CardFrontFace, MinangCrestLogo } from './MemberCardDigital';
import {
  Award as AwardIcon,
  CheckCircle2,
  Crown,
  Gift,
  LogIn,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Utensils,
} from 'lucide-react';

interface LandingAndAuthViewProps {
  members: Member[];
  transactions: Transaction[];
  rewards: Reward[];
  announcements: Announcement[];
  awards: Award[];
  policy: PointPolicy;
  settings: SystemSettings;
  onLogin: (identifier: string, password?: string) => Promise<void>;
  onQuickSwitchUser: (userId: string) => Promise<void>;
  onRegisterMember: (payload: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    birthDate?: string;
    password?: string;
  }) => Promise<void>;
}

export const LandingAndAuthView: React.FC<LandingAndAuthViewProps> = ({
  members,
  transactions,
  rewards,
  announcements,
  policy,
  settings,
  onLogin,
  onQuickSwitchUser,
  onRegisterMember,
}) => {
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const rankings = useMemo(
    () => computeCustomerRankings(members, transactions, settings),
    [members, transactions, settings]
  );

  const sampleCardMember: Member = members[0] || {
    memberId: 'TA-0001',
    userId: 'USR-MEM-1',
    fullName: 'Budi Santoso',
    phone: '081234560001',
    joinDate: '2026-06-15',
    memberStatus: 'Active',
    totalPoints: 22,
    lifetimeEarnedPoints: 32,
    lifetimeRedeemedPoints: 10,
    totalVisits: 5,
    qrCode: 'TOPAMPERA:MEMBER:TA-0001:8F92A1',
    createdAt: '2026-06-15',
    updatedAt: '2026-11-16',
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      setAuthError('Masukkan Nomor WhatsApp, ID Member (TA-XXXX), atau Email.');
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      await onLogin(loginIdentifier.trim(), loginPassword || undefined);
    } catch (err: any) {
      setAuthError(err?.message || 'Gagal masuk. Periksa kembali kredensial Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setAuthError('Nama lengkap wajib diisi.');
      return;
    }
    if (regPhone.replace(/\D/g, '').length < 9) {
      setAuthError('Nomor WhatsApp aktif wajib diisi (minimal 9 digit).');
      return;
    }
    setLoading(true);
    setAuthError(null);
    try {
      await onRegisterMember({
        fullName: regName.trim(),
        phone: regPhone.trim(),
        email: regEmail.trim() || undefined,
        address: regAddress.trim() || undefined,
        birthDate: regBirthDate || undefined,
        password: regPassword || undefined,
      });
    } catch (err: any) {
      setAuthError(err?.message || 'Gagal mendaftarkan member baru.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3EF] text-[#391C19] flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-[#391C19]/10 px-6 lg:px-12 py-4 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-xl font-bold tracking-tight text-[#8E1118] whitespace-nowrap shrink-0"
        >
          Top Ampera
        </a>

        <nav
          aria-label="Navigasi Utama"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#391C19]/80"
        >
          <a
            href="#program-loyalty"
            className="hover:text-[#8E1118] transition-colors whitespace-nowrap shrink-0"
          >
            Program Loyalty
          </a>
          <a
            href="#katalog-reward"
            className="hover:text-[#8E1118] transition-colors whitespace-nowrap shrink-0"
          >
            Rewards Poin
          </a>
          <a
            href="#ranking-pelanggan"
            className="hover:text-[#8E1118] transition-colors whitespace-nowrap shrink-0"
          >
            Ranking Top 3
          </a>
          <a
            href="#pengumuman-terbaru"
            className="hover:text-[#8E1118] transition-colors whitespace-nowrap shrink-0"
          >
            Pengumuman
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <a
            href="#portal-akses"
            onClick={() => setAuthMode('REGISTER')}
            className="px-4 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Daftar Member Gratis
          </a>
        </div>
      </header>

      {/* Hero + Auth Split Section */}
      <section className="max-w-7xl w-full mx-auto px-6 lg:px-12 py-10 lg:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Brand Value Proposition & Digital Card Showcase */}
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#8E1118]">
                <MinangCrestLogo className="w-6 h-6" />
                <span>Masakan Padang Kota Wisata Batu · Loyalty & Member System</span>
              </div>

              <h1
                className="font-display font-bold text-[#391C19] leading-tight"
                style={{ fontSize: 'clamp(2.1rem, 3.6vw, 3.25rem)', textWrap: 'balance' }}
              >
                Kumpulkan Poin dari Setiap Hidangan Padang Favorit Anda di Top Ampera.
              </h1>

              <p className="text-base text-[#391C19]/80 leading-relaxed max-w-2xl">
                Nikmati keistimewaan menjadi Member Resmi Top Ampera Kota Wisata Batu. Dapatkan{' '}
                <strong className="text-[#8E1118]">
                  {policy.pointsPerStep} Poin setiap kelipatan Rp
                  {policy.nominalStep.toLocaleString('id-ID')}
                </strong>
                , tukarkan dengan <strong>Gratis 1 Porsi Nasi Padang</strong>,{' '}
                <strong>Es Teh Manis</strong>, hingga <strong>Penghargaan Bulanan Top 1, 2, dan 3</strong>.
              </p>
            </div>

            {/* Interactive Digital Card Preview */}
            <div className="bg-white rounded-2xl p-6 border border-[#391C19]/10 flex flex-col xl:flex-row items-center gap-6">
              <div className="w-full sm:w-[370px] shrink-0">
                <CardFrontFace member={sampleCardMember} settings={settings} />
              </div>
              <div className="space-y-2.5 text-xs">
                <p className="font-display text-base font-bold text-[#391C19]">
                  Kartu Member Digital Berstandar CR80
                </p>
                <p className="text-[#391C19]/75 leading-relaxed">
                  Setiap member otomatis mendapatkan ID unik (<span className="font-mono-tabular font-bold text-[#8E1118]">TA-0001</span>) dan QR Code verifikasi yang dapat dibuka dari HP atau dicetak dengan ukuran ID Card profesional (85,6 × 54 mm).
                </p>
                <div className="pt-1 flex flex-wrap items-center gap-2 font-semibold text-[#8E1118]">
                  <span className="whitespace-nowrap">+{settings.welcomeBonusPoints} Poin Bonus Pendaftaran</span>
                  <span aria-hidden="true">·</span>
                  <span className="whitespace-nowrap">Tanpa Biaya Admin</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Login & Member Self-Registration Card */}
          <div
            id="portal-akses"
            className="lg:col-span-5 bg-white rounded-2xl p-6 sm:p-8 border border-[#391C19]/15 shadow-sm flex flex-col justify-between space-y-6"
          >
            <div>
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-[#F7F3EF] rounded-xl border border-[#391C19]/10 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('LOGIN');
                    setAuthError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    authMode === 'LOGIN'
                      ? 'bg-[#8E1118] text-white'
                      : 'text-[#391C19]/75 hover:text-[#391C19]'
                  }`}
                >
                  Masuk Akun (Login)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('REGISTER');
                    setAuthError(null);
                  }}
                  className={`py-2.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    authMode === 'REGISTER'
                      ? 'bg-[#8E1118] text-white'
                      : 'text-[#391C19]/75 hover:text-[#391C19]'
                  }`}
                >
                  Daftar Member Baru
                </button>
              </div>

              {authError && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs font-semibold">
                  {authError}
                </div>
              )}

              {authMode === 'LOGIN' ? (
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#391C19]">
                      Masuk ke Top Ampera Loyalty
                    </h2>
                    <p className="text-xs text-[#391C19]/70 mt-0.5">
                      Gunakan Nomor WhatsApp, ID Member (contoh: TA-0001), atau Email Staf/Owner.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="login-identifier"
                      className="block text-xs font-bold text-[#391C19] mb-1"
                    >
                      Nomor WhatsApp / ID Member / Email
                    </label>
                    <input
                      id="login-identifier"
                      type="text"
                      required
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="Contoh: TA-0001 atau 081234560001"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#391C19]/20 rounded-lg focus:outline-none focus:border-[#8E1118]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-bold text-[#391C19] mb-1"
                    >
                      Kata Sandi (Opsional untuk Member, Wajib untuk Admin/Owner)
                    </label>
                    <input
                      id="login-password"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full px-3.5 py-2.5 text-sm border border-[#391C19]/20 rounded-lg focus:outline-none focus:border-[#8E1118]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-xl transition-colors cursor-pointer"
                  >
                    {loading ? 'Memproses...' : 'Masuk Sekarang'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-[#391C19]">
                      Pendaftaran Member Baru
                    </h2>
                    <p className="text-xs text-[#391C19]/70 mt-0.5">
                      Dapatkan Kartu Member Digital ber-QR Code dan bonus +{settings.welcomeBonusPoints} poin pertama.
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-fullname"
                      className="block text-xs font-bold text-[#391C19] mb-1"
                    >
                      Nama Lengkap Sesuai Identitas *
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="Contoh: Rendra Pratama"
                      className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-xs font-bold text-[#391C19] mb-1"
                    >
                      Nomor WhatsApp Aktif (1 Nomor = 1 Akun) *
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="Contoh: 081234567899"
                      className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="reg-address"
                        className="block text-xs font-bold text-[#391C19] mb-1"
                      >
                        Domisili / Kota
                      </label>
                      <input
                        id="reg-address"
                        type="text"
                        value={regAddress}
                        onChange={(e) => setRegAddress(e.target.value)}
                        placeholder="Kota Wisata Batu"
                        className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block text-xs font-bold text-[#391C19] mb-1"
                      >
                        PIN / Kata Sandi
                      </label>
                      <input
                        id="reg-password"
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Buat kata sandi"
                        className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-xl transition-colors cursor-pointer"
                  >
                    {loading ? 'Menerbitkan Kartu...' : 'Daftar & Terbitkan Kartu Member Digital'}
                  </button>
                </form>
              )}
            </div>

            {/* Quick Role Access Demo Bar inside Auth Card */}
            <div className="pt-4 border-t border-[#391C19]/10 space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#391C19]/70">
                Akses Cepat Simulasi Role (Owner, Kasir & Member):
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onQuickSwitchUser('USR-MEM-1')}
                  className="px-3 py-2 text-left rounded-lg bg-[#F7F3EF] hover:bg-[#D9B432]/25 border border-[#391C19]/15 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#8E1118]">Member (TA-0001)</p>
                  <p className="text-[10px] text-[#391C19]/75 truncate">
                    Budi Santoso · 22 Poin
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickSwitchUser('USR-MEM-2')}
                  className="px-3 py-2 text-left rounded-lg bg-[#F7F3EF] hover:bg-[#D9B432]/25 border border-[#391C19]/15 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#8E1118]">Member Top 1 (TA-0002)</p>
                  <p className="text-[10px] text-[#391C19]/75 truncate">
                    Hj. Siti Rahmawati · 86 Poin
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickSwitchUser('USR-KASIR-1')}
                  className="px-3 py-2 text-left rounded-lg bg-[#F7F3EF] hover:bg-[#D9B432]/25 border border-[#391C19]/15 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#391C19]">Dashboard Kasir</p>
                  <p className="text-[10px] text-[#391C19]/75 truncate">
                    Nadia Putri · Verifikasi
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onQuickSwitchUser('USR-OWNER')}
                  className="px-3 py-2 text-left rounded-lg bg-[#391C19] text-white hover:bg-[#8E1118] transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-[#D9B432]">Dashboard Owner</p>
                  <p className="text-[10px] text-[#F7F3EF]/85 truncate">
                    H. Rizal Chaniago · Full Access
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: How the Loyalty Point System Works */}
      <section id="program-loyalty" className="bg-white border-y border-[#391C19]/10 py-14">
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-[#8E1118]">
              Cara Kerja Program Loyalty
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#391C19] mt-1">
              01. Mekanisme Pengumpulan Poin & Keuntungan Member
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl bg-[#F7F3EF] border border-[#391C19]/10 space-y-2">
              <p className="font-mono-tabular text-xs font-bold text-[#8E1118]">01. Pendaftaran</p>
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                Terbitkan Kartu Member Digital CR80
              </h3>
              <p className="text-xs text-[#391C19]/80 leading-relaxed">
                Daftarkan nama dan nomor WhatsApp Anda. Sistem langsung menerbitkan ID Member permanen (TA-XXXX) beserta QR Code verifikasi yang dapat diunduh atau dicetak.
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#F7F3EF] border border-[#391C19]/10 space-y-2">
              <p className="font-mono-tabular text-xs font-bold text-[#8E1118]">02. Perolehan Poin</p>
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                Setiap Rp{policy.nominalStep.toLocaleString('id-ID')} Dapat {policy.pointsPerStep}{' '}
                Poin + Bonus Menu
              </h3>
              <p className="text-xs text-[#391C19]/80 leading-relaxed">
                Catat pembelian dari aplikasi atau tunjukkan QR Code ke kasir. Dapatkan poin ekstra saat memesan menu spesial seperti Rendang Daging Sapi (+2 Poin) dan Paket Wisata Batu (+5 Poin).
              </p>
            </div>

            <div className="p-6 rounded-xl bg-[#F7F3EF] border border-[#391C19]/10 space-y-2">
              <p className="font-mono-tabular text-xs font-bold text-[#8E1118]">
                03. Hadiah & Apresiasi Top 3
              </p>
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                Tukarkan Hadiah & Raih Peringkat Loyalitas
              </h3>
              <p className="text-xs text-[#391C19]/80 leading-relaxed">
                Tukarkan poin dengan Es Teh, Nasi Padang, hingga Paket Keluarga. Pelanggan dengan kunjungan terverifikasi terbanyak meraih penghargaan Top 1, Top 2, dan Top 3 setiap periode.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Rewards Showcase & Top 3 Podium Preview */}
      <section id="katalog-reward" className="max-w-7xl w-full mx-auto px-6 lg:px-12 py-14 space-y-12">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#8E1118]">
                Rewards & Benefits
              </p>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#391C19] mt-1">
                02. Daftar Hadiah Penukaran Poin Top Ampera
              </h2>
            </div>
            <span className="text-xs text-[#391C19]/70">
              Mulai dari 10 Poin hingga 100 Poin
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {rewards
              .filter((r) => r.isActive)
              .map((rw) => (
                <div
                  key={rw.rewardId}
                  className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <span className="font-mono-tabular text-xs font-bold text-[#8E1118] bg-[#D9B432]/25 px-2.5 py-0.5 rounded inline-block">
                      {rw.requiredPoints} Poin
                    </span>
                    <h3 className="font-display text-base font-bold text-[#391C19]">
                      {rw.rewardName}
                    </h3>
                    <p className="text-xs text-[#391C19]/75 leading-relaxed">{rw.description}</p>
                  </div>
                  <p className="text-[11px] font-mono-tabular text-[#391C19]/60 pt-2 border-t border-[#391C19]/10">
                    Stok: {rw.stock} tersedia
                  </p>
                </div>
              ))}
          </div>
        </div>

        {/* Top 3 Loyal Customer Preview */}
        <div id="ranking-pelanggan" className="space-y-6 pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#8E1118]">
              Top Ampera Loyal Customer
            </p>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#391C19] mt-1">
              03. Podium Pelanggan Paling Loyal Bulan Ini
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rankings.slice(0, 3).map((rk) => (
              <div
                key={rk.memberId}
                className={`rounded-xl p-6 border flex flex-col justify-between ${
                  rk.rankPosition === 1
                    ? 'bg-gradient-to-b from-[#8E1118] to-[#590A0E] text-white border-[#D9B432]'
                    : 'bg-white text-[#391C19] border-[#391C19]/15'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className={rk.rankPosition === 1 ? 'text-[#D9B432]' : 'text-[#8E1118]'}>
                      TOP {rk.rankPosition} LOYAL MEMBER
                    </span>
                    <span className="font-mono-tabular opacity-80">{rk.memberId}</span>
                  </div>
                  <h3 className="font-display text-xl font-bold">{rk.memberName}</h3>
                </div>
                <div className="mt-5 pt-4 border-t border-current/15 flex items-center justify-between font-mono-tabular text-xs">
                  <span>
                    Kunjungan Valid: <strong>{rk.totalVisits}x</strong>
                  </span>
                  <span>
                    Total Poin: <strong>{rk.totalPoints} Poin</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Latest Announcements */}
        <div id="pengumuman-terbaru" className="space-y-5 pt-4">
          <h2 className="font-display text-2xl font-bold text-[#391C19]">
            04. Pengumuman & Informasi Restoran
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {announcements
              .filter((a) => a.status === 'Published')
              .slice(0, 3)
              .map((ann) => (
                <article
                  key={ann.announcementId}
                  className="bg-white rounded-xl p-5 border border-[#391C19]/10 space-y-2"
                >
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-[#8E1118]">
                    <span>{ann.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-tabular text-[#391C19]/65">{ann.publishDate}</span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[#391C19]">{ann.title}</h3>
                  <p className="text-xs text-[#391C19]/80 leading-relaxed">{ann.content}</p>
                </article>
              ))}
          </div>
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="mt-auto bg-[#391C19] text-[#F7F3EF]/85 py-8 px-6 lg:px-12 border-t border-[#D9B432]/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <MinangCrestLogo className="w-8 h-8" />
            <div>
              <p className="font-display font-bold text-white">
                {settings.restaurantName} – Masakan Padang {settings.branchLocation}
              </p>
              <p className="text-[#F7F3EF]/70">{settings.address}</p>
            </div>
          </div>
          <div className="font-mono-tabular text-[#D9B432]">
            Layanan Pelanggan WhatsApp: {settings.phoneContact}
          </div>
        </div>
      </footer>
    </div>
  );
};
