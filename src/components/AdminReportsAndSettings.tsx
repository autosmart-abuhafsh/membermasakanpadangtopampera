import React, { useMemo, useState } from 'react';
import {
  ActivityLog,
  Award,
  CalculationMethod,
  Member,
  PointLedger,
  PointPolicy,
  PolicyChangeLog,
  Redemption,
  Reward,
  RoundingMode,
  SystemSettings,
  Transaction,
  User,
} from '../types/loyalty';
import { computeCustomerRankings } from '../utils/loyaltyEngine';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  Lock,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Shield,
  Sliders,
  Trash2,
  UserPlus,
} from 'lucide-react';

function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ============================================================================
 * 1. LOYALTY POINT SETTINGS (PRD SECTION 5.D)
 * ========================================================================== */
export const LoyaltyPointSettingsView: React.FC<{
  policy: PointPolicy;
  currentUser: User;
  policyHistory: PolicyChangeLog[];
  onSavePolicy: (updated: PointPolicy) => Promise<void>;
}> = ({ policy, currentUser, policyHistory, onSavePolicy }) => {
  const [draft, setDraft] = useState<PointPolicy>(policy);
  const [newMenuName, setNewMenuName] = useState('');
  const [newMenuCategory, setNewMenuCategory] = useState('Lauk Utama');
  const [newMenuPrice, setNewMenuPrice] = useState('28000');
  const [newMenuBonus, setNewMenuBonus] = useState('2');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  const isOwner = currentUser.role === 'OWNER';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    setSaving(true);
    setSavedBanner(null);
    try {
      await onSavePolicy(draft);
      setSavedBanner(
        'Kebijakan Loyalty Point berhasil disimpan. Berlaku untuk seluruh transaksi baru tanpa mengubah transaksi masa lalu.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddMenuRule = () => {
    if (!newMenuName.trim()) return;
    const rule = {
      menuId: `MNU-${Date.now().toString(36).toUpperCase()}`,
      menuName: newMenuName.trim(),
      category: newMenuCategory,
      defaultPrice: Number(newMenuPrice) || 25000,
      bonusPoints: Math.max(1, Number(newMenuBonus) || 1),
      isActive: true,
    };
    setDraft((prev) => ({
      ...prev,
      menuRules: [...prev.menuRules, rule],
    }));
    setNewMenuName('');
  };

  const handleAddRangeRule = () => {
    setDraft((prev) => ({
      ...prev,
      rangeRules: [
        ...prev.rangeRules,
        {
          id: `RNG-${Date.now().toString(36)}`,
          minAmount: 100000,
          maxAmount: null,
          points: 10,
        },
      ],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
            Loyalty Point Settings
          </span>
          <h2 className="font-display text-2xl font-bold text-[#391C19]">
            Pengaturan Kebijakan & Metode Perhitungan Poin
          </h2>
          <p className="text-xs text-[#391C19]/75 mt-0.5">
            Atur perhitungan poin berdasarkan kelipatan nominal, rentang belanja, maupun bonus menu spesial.
          </p>
        </div>

        {!isOwner && (
          <div className="bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg text-xs font-semibold text-amber-900 flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Mode Baca (Hanya Owner yang dapat mengubah kebijakan poin utama)
          </div>
        )}
      </div>

      {savedBanner && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            {savedBanner}
          </span>
          <button
            type="button"
            onClick={() => setSavedBanner(null)}
            className="underline font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Calculation Method Selection */}
        <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-5">
          <h3 className="font-display text-lg font-bold text-[#391C19]">
            1. Pilih Metode Perhitungan Poin Utama
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                id: 'NOMINAL_MULTIPLIER' as CalculationMethod,
                title: 'Metode 1 – Kelipatan Nominal',
                desc: 'Contoh: Setiap Rp25.000 mendapatkan 2 poin (Rp50.000 = 4 poin, Rp75.000 = 6 poin).',
              },
              {
                id: 'NOMINAL_RANGE' as CalculationMethod,
                title: 'Metode 2 – Rentang Nominal',
                desc: 'Contoh: Rp10rb–24.999 = 1 poin, Rp25rb–49.999 = 3 poin, Rp50rb–99.999 = 5 poin.',
              },
              {
                id: 'MENU_BASED' as CalculationMethod,
                title: 'Metode 3 – Fokus Bonus Menu',
                desc: 'Perhitungan berbasis kombinasi nominal dasar dan poin khusus menu pilihan.',
              },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!isOwner}
                onClick={() => setDraft((prev) => ({ ...prev, calculationMethod: m.id }))}
                className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                  draft.calculationMethod === m.id
                    ? 'bg-[#8E1118]/5 border-2 border-[#8E1118]'
                    : 'bg-[#F7F3EF]/60 border-[#391C19]/15 hover:bg-[#F7F3EF]'
                }`}
              >
                <p className="text-sm font-bold text-[#391C19]">{m.title}</p>
                <p className="text-xs text-[#391C19]/75 mt-1 leading-relaxed">{m.desc}</p>
              </button>
            ))}
          </div>

          {/* Method 1 Configuration */}
          {draft.calculationMethod !== 'NOMINAL_RANGE' && (
            <div className="bg-[#F7F3EF] p-5 rounded-xl border border-[#391C19]/10 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                Konfigurasi Metode 1 (Kelipatan Nominal Pembelian)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Setiap Pembelian Nominal (Rp)
                  </label>
                  <input
                    type="number"
                    disabled={!isOwner}
                    min={1000}
                    step={1000}
                    value={draft.nominalStep}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, nominalStep: Number(e.target.value) || 25000 }))
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold bg-white border border-[#391C19]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Mendapatkan Poin
                  </label>
                  <input
                    type="number"
                    disabled={!isOwner}
                    min={1}
                    value={draft.pointsPerStep}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, pointsPerStep: Number(e.target.value) || 1 }))
                    }
                    className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold bg-white border border-[#391C19]/20 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#391C19] mb-1">
                    Aturan Pembulatan Kelipatan
                  </label>
                  <select
                    disabled={!isOwner}
                    value={draft.roundingMode}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, roundingMode: e.target.value as RoundingMode }))
                    }
                    className="w-full px-3.5 py-2 text-sm bg-white border border-[#391C19]/20 rounded-lg"
                  >
                    <option value="FLOOR">Pembulatan ke Bawah (Kelipatan Penuh - Default)</option>
                    <option value="ROUND">Pembulatan Terdekat</option>
                    <option value="CEIL">Pembulatan ke Atas</option>
                  </select>
                </div>
              </div>

              {/* Live Simulation Table */}
              <div className="pt-2">
                <p className="text-xs font-semibold text-[#391C19]/75 mb-2">
                  Simulasi Otomatis (Setiap Rp{draft.nominalStep.toLocaleString('id-ID')} ={' '}
                  {draft.pointsPerStep} Poin):
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[1, 2, 3, 4].map((mult) => {
                    const nominal = draft.nominalStep * mult;
                    const pts = draft.pointsPerStep * mult;
                    return (
                      <div
                        key={mult}
                        className="bg-white p-2.5 rounded-lg border border-[#391C19]/10 text-xs font-mono-tabular"
                      >
                        Belanja <strong>Rp{nominal.toLocaleString('id-ID')}</strong> ={' '}
                        <strong className="text-[#8E1118]">{pts} Poin</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Method 2 Configuration */}
          {draft.calculationMethod === 'NOMINAL_RANGE' && (
            <div className="bg-[#F7F3EF] p-5 rounded-xl border border-[#391C19]/10 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
                  Konfigurasi Metode 2 (Rentang Nominal Belanja)
                </h4>
                {isOwner && (
                  <button
                    type="button"
                    onClick={handleAddRangeRule}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#8E1118] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Rentang
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {draft.rangeRules.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-[#391C19]/10 items-center"
                  >
                    <div>
                      <label className="block text-[10px] text-[#391C19]/70">Minimal (Rp)</label>
                      <input
                        type="number"
                        disabled={!isOwner}
                        value={rule.minAmount}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setDraft((prev) => ({
                            ...prev,
                            rangeRules: prev.rangeRules.map((r, i) =>
                              i === idx ? { ...r, minAmount: val } : r
                            ),
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#391C19]/70">
                        Maksimal (Kosong = Ke atas)
                      </label>
                      <input
                        type="number"
                        disabled={!isOwner}
                        value={rule.maxAmount ?? ''}
                        placeholder="Ke atas"
                        onChange={(e) => {
                          const raw = e.target.value;
                          setDraft((prev) => ({
                            ...prev,
                            rangeRules: prev.rangeRules.map((r, i) =>
                              i === idx ? { ...r, maxAmount: raw === '' ? null : Number(raw) } : r
                            ),
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#391C19]/70">Poin Diperoleh</label>
                      <input
                        type="number"
                        disabled={!isOwner}
                        value={rule.points}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          setDraft((prev) => ({
                            ...prev,
                            rangeRules: prev.rangeRules.map((r, i) =>
                              i === idx ? { ...r, points: val } : r
                            ),
                          }));
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular font-bold text-[#8E1118] border rounded"
                      />
                    </div>
                    <div className="flex justify-end pt-3">
                      {isOwner && draft.rangeRules.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((prev) => ({
                              ...prev,
                              rangeRules: prev.rangeRules.filter((_, i) => i !== idx),
                            }))
                          }
                          className="text-xs text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Method 3: Menu Bonus Rules */}
        <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                2. Poin Khusus Menu (Metode 3 – Bonus Menu Pilihan)
              </h3>
              <p className="text-xs text-[#391C19]/70">
                Berikan poin tambahan ketika pelanggan membeli menu andalan Top Ampera (seperti Rendang, Ayam Bakar, Paket Spesial).
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-[#8E1118] cursor-pointer">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={draft.enableMenuBonus}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, enableMenuBonus: e.target.checked }))
                }
                className="rounded border-[#391C19]/30"
              />
              Aktifkan Bonus Poin Menu
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {draft.menuRules.map((rule, idx) => (
              <div
                key={rule.menuId}
                className="p-3.5 rounded-lg bg-[#F7F3EF]/70 border border-[#391C19]/10 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#391C19] truncate">{rule.menuName}</p>
                  <p className="text-[11px] text-[#391C19]/70 font-mono-tabular">
                    {rule.category} · Rp{rule.defaultPrice.toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[#391C19]/70">Bonus:</span>
                  <input
                    type="number"
                    disabled={!isOwner}
                    min={0}
                    value={rule.bonusPoints}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0;
                      setDraft((prev) => ({
                        ...prev,
                        menuRules: prev.menuRules.map((m, i) =>
                          i === idx ? { ...m, bonusPoints: val } : m
                        ),
                      }));
                    }}
                    className="w-16 px-2 py-1 text-xs font-mono-tabular font-bold text-[#8E1118] bg-white border border-[#391C19]/20 rounded"
                  />
                  <span className="text-xs font-bold text-[#8E1118]">Poin</span>
                </div>
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="pt-3 border-t border-[#391C19]/10 grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[#391C19] mb-1">
                  Nama Menu Baru
                </label>
                <input
                  type="text"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                  placeholder="Contoh: Gulai Tunjang Spesial"
                  className="w-full px-3 py-1.5 text-xs border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#391C19] mb-1">
                  Kategori
                </label>
                <input
                  type="text"
                  value={newMenuCategory}
                  onChange={(e) => setNewMenuCategory(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#391C19] mb-1">
                  Bonus Poin
                </label>
                <input
                  type="number"
                  min={1}
                  value={newMenuBonus}
                  onChange={(e) => setNewMenuBonus(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono-tabular border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <button
                type="button"
                onClick={handleAddMenuRule}
                className="px-3 py-2 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e2be3b] rounded-lg cursor-pointer"
              >
                + Tambah Menu Bonus
              </button>
            </div>
          )}
        </div>

        {/* Additional Policy Parameters */}
        <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4">
          <h3 className="font-display text-lg font-bold text-[#391C19]">
            3. Pengaturan Tambahan, Promo Poin Ganda & Validasi Kunjungan
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Minimal Pembelian Dapat Poin (Rp)
              </label>
              <input
                type="number"
                disabled={!isOwner}
                value={draft.minimumPurchase}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, minimumPurchase: Number(e.target.value) || 0 }))
                }
                className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Batas Maksimal Poin / Transaksi
              </label>
              <input
                type="number"
                disabled={!isOwner}
                value={draft.maximumPointsPerTransaction}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    maximumPointsPerTransaction: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Jeda Anti-Split Kunjungan (Menit)
              </label>
              <input
                type="number"
                disabled={!isOwner}
                value={draft.visitCooldownMinutes}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    visitCooldownMinutes: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-3.5 py-2 text-sm font-mono-tabular border border-[#391C19]/20 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#391C19] cursor-pointer">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={draft.doublePointsPromoActive}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, doublePointsPromoActive: e.target.checked }))
                }
              />
              Aktifkan Promo Poin Ganda ({draft.promoMultiplier}x Lipat)
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#391C19] cursor-pointer">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={draft.pointsCanExpire}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, pointsCanExpire: e.target.checked }))
                }
              />
              Poin Memiliki Masa Berlaku ({draft.expiryMonths} Bulan)
            </label>

            <label className="flex items-center gap-2 text-xs font-semibold text-[#391C19] cursor-pointer">
              <input
                type="checkbox"
                disabled={!isOwner}
                checked={draft.allTransactionsCountAsVisit}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, allTransactionsCountAsVisit: e.target.checked }))
                }
              />
              Seluruh Transaksi Dihitung Kunjungan
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Ketentuan Khusus Program Loyalty
            </label>
            <textarea
              rows={2}
              disabled={!isOwner}
              value={draft.termsAndConditions}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, termsAndConditions: e.target.value }))
              }
              className="w-full px-3.5 py-2 text-xs border border-[#391C19]/20 rounded-lg"
            />
          </div>

          {isOwner && (
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Menyimpan Kebijakan...' : 'Simpan Perubahan Kebijakan Poin'}
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Policy Change Audit History */}
      <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#391C19]/10 flex items-center gap-2">
          <History className="w-4 h-4 text-[#8E1118]" />
          <h3 className="font-display text-base font-bold text-[#391C19]">
            Histori Perubahan Kebijakan (Audit Trail)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Nama Pengaturan</th>
                <th className="py-3 px-4">Nilai Sebelum</th>
                <th className="py-3 px-4">Nilai Sesudah</th>
                <th className="py-3 px-4">Diubah Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#391C19]/10 text-xs">
              {policyHistory.map((chg) => (
                <tr key={chg.changeId}>
                  <td className="py-3 px-4 font-mono-tabular text-[#391C19]/70">
                    {chg.timestamp.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#391C19]">{chg.settingName}</td>
                  <td className="py-3 px-4 font-mono-tabular text-red-700">{chg.previousValue}</td>
                  <td className="py-3 px-4 font-mono-tabular font-bold text-emerald-700">
                    {chg.newValue}
                  </td>
                  <td className="py-3 px-4 text-[#391C19]/80">{chg.changedByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. LAPORAN DAN MONITORING (PRD SECTION 7)
 * ========================================================================== */
export const ReportsAndMonitoringView: React.FC<{
  members: Member[];
  transactions: Transaction[];
  pointLedger: PointLedger[];
  rewards: Reward[];
  redemptions: Redemption[];
  awards: Award[];
  settings: SystemSettings;
}> = ({ members, transactions, pointLedger, rewards, redemptions, awards, settings }) => {
  const [reportTab, setReportTab] = useState<'MEMBER' | 'KUNJUNGAN' | 'POIN' | 'REWARD' | 'RANKING'>('MEMBER');
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2026-12-31');

  const filteredTxs = useMemo(
    () =>
      transactions.filter((t) => {
        const d = t.transactionDate.slice(0, 10);
        return (!startDate || d >= startDate) && (!endDate || d <= endDate);
      }),
    [transactions, startDate, endDate]
  );

  const approvedTxs = useMemo(
    () => filteredTxs.filter((t) => t.verificationStatus === 'Approved'),
    [filteredTxs]
  );

  const rankings = useMemo(
    () => computeCustomerRankings(members, transactions, settings),
    [members, transactions, settings]
  );

  const totalPointsGiven = pointLedger.reduce((sum, l) => sum + l.pointIn, 0);
  const totalPointsRedeemed = pointLedger.reduce((sum, l) => sum + l.pointOut, 0);
  const totalBonusPoints = pointLedger
    .filter((l) => l.activityType === 'Bonus Points')
    .reduce((sum, l) => sum + l.pointIn, 0);
  const totalRemainingPoints = members.reduce((sum, m) => sum + m.totalPoints, 0);

  const handleExportCurrentCsv = () => {
    if (reportTab === 'MEMBER') {
      exportToCsv(
        `Laporan-Member-TopAmpera-${endDate}.csv`,
        ['ID Member', 'Nama Lengkap', 'WhatsApp', 'Tanggal Bergabung', 'Status', 'Total Poin', 'Total Kunjungan'],
        members.map((m) => [
          m.memberId,
          m.fullName,
          m.phone,
          m.joinDate,
          m.memberStatus,
          m.totalPoints,
          m.totalVisits,
        ])
      );
    } else if (reportTab === 'KUNJUNGAN' || reportTab === 'POIN') {
      exportToCsv(
        `Laporan-Transaksi-Poin-TopAmpera-${endDate}.csv`,
        ['Kode Transaksi', 'Tanggal', 'ID Member', 'Nama Member', 'Nominal (Rp)', 'Poin Disetujui', 'Status', 'Kunjungan Valid'],
        filteredTxs.map((t) => [
          t.transactionCode,
          t.transactionDate.slice(0, 10),
          t.memberId,
          t.memberName,
          t.transactionAmount,
          t.approvedPoints,
          t.verificationStatus,
          t.visitCountStatus ? 'Ya' : 'Tidak',
        ])
      );
    } else if (reportTab === 'REWARD') {
      exportToCsv(
        `Laporan-Reward-TopAmpera-${endDate}.csv`,
        ['ID Reward', 'Nama Hadiah', 'Poin Dibutuhkan', 'Total Ditukarkan', 'Sisa Stok'],
        rewards.map((r) => [r.rewardId, r.rewardName, r.requiredPoints, r.redeemedCount, r.stock])
      );
    } else {
      exportToCsv(
        `Laporan-Ranking-Pelanggan-TopAmpera-${endDate}.csv`,
        ['Peringkat', 'ID Member', 'Nama Member', 'Total Kunjungan', 'Total Poin', 'Total Belanja (Rp)'],
        rankings.map((rk) => [
          rk.rankPosition,
          rk.memberId,
          rk.memberName,
          rk.totalVisits,
          rk.totalPoints,
          rk.totalSpend,
        ])
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#8E1118]">
            Laporan & Monitoring Eksekutif
          </span>
          <h2 className="font-display text-2xl font-bold text-[#391C19]">
            Pusat Laporan Program Loyalty Top Ampera
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Tanggal mulai laporan"
            className="px-3 py-1.5 text-xs font-mono-tabular bg-[#F7F3EF] border border-[#391C19]/20 rounded-lg"
          />
          <span className="text-xs text-[#391C19]/60">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Tanggal akhir laporan"
            className="px-3 py-1.5 text-xs font-mono-tabular bg-[#F7F3EF] border border-[#391C19]/20 rounded-lg"
          />
          <button
            type="button"
            onClick={handleExportCurrentCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e5c23e] rounded-lg cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Export CSV / Excel
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak / Export PDF
          </button>
        </div>
      </div>

      {/* 5 Report Category Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#391C19]/10">
        {[
          { id: 'MEMBER', label: 'A. Laporan Member' },
          { id: 'KUNJUNGAN', label: 'B. Laporan Kunjungan' },
          { id: 'POIN', label: 'C. Laporan Loyalty Point' },
          { id: 'REWARD', label: 'D. Laporan Reward' },
          { id: 'RANKING', label: 'E. Laporan Ranking' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setReportTab(t.id as any)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
              reportTab === t.id
                ? 'bg-[#8E1118] text-white'
                : 'text-[#391C19]/75 hover:bg-[#F7F3EF]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="printable-area" className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-6">
        {reportTab === 'MEMBER' && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              A. Ringkasan Pertumbuhan & Status Member
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Total Seluruh Member</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#391C19]">
                  {members.length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Member Aktif</p>
                <p className="font-mono-tabular text-2xl font-bold text-emerald-700">
                  {members.filter((m) => m.memberStatus === 'Active').length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Member Tidak Aktif</p>
                <p className="font-mono-tabular text-2xl font-bold text-amber-700">
                  {members.filter((m) => m.memberStatus !== 'Active').length}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Member Baru Bulan Ini</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#8E1118]">
                  {members.filter((m) => m.joinDate.startsWith('2026-11')).length}
                </p>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'KUNJUNGAN' && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              B. Statistik Kunjungan Pelanggan Terverifikasi
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Kunjungan Harian (Hari Ini)</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#8E1118]">
                  {approvedTxs.filter((t) => t.transactionDate.startsWith('2026-11-17')).length}x
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Kunjungan Mingguan (7 Hari)</p>
                <p className="font-mono-tabular text-2xl font-bold text-[#391C19]">
                  {approvedTxs.filter((t) => t.transactionDate.slice(0, 10) >= '2026-11-10').length}x
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Kunjungan Bulanan (Nov 2026)</p>
                <p className="font-mono-tabular text-2xl font-bold text-emerald-700">
                  {approvedTxs.filter((t) => t.visitCountStatus).length}x
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Pelanggan Teraktif</p>
                <p className="text-sm font-bold text-[#8E1118] truncate">
                  {rankings[0]?.memberName || '-'} ({rankings[0]?.totalVisits || 0}x)
                </p>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'POIN' && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              C. Neraca Loyalty Point (Point Ledger Audit)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Total Poin Diberikan</p>
                <p className="font-mono-tabular text-xl font-bold text-emerald-700">
                  +{totalPointsGiven}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Total Poin Ditukarkan</p>
                <p className="font-mono-tabular text-xl font-bold text-[#8E1118]">
                  -{totalPointsRedeemed}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Total Poin Tersisa</p>
                <p className="font-mono-tabular text-xl font-bold text-[#391C19]">
                  {totalRemainingPoints}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Bonus Poin Diberikan</p>
                <p className="font-mono-tabular text-xl font-bold text-[#D9B432]">
                  +{totalBonusPoints}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#F7F3EF]">
                <p className="text-xs text-[#391C19]/70">Poin Kedaluwarsa</p>
                <p className="font-mono-tabular text-xl font-bold text-[#391C19]/60">0</p>
              </div>
            </div>
          </div>
        )}

        {reportTab === 'REWARD' && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              D. Statistik Penukaran Hadiah & Ketersediaan Stok
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                    <th className="py-3 px-4">Hadiah</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4 text-right">Syarat Poin</th>
                    <th className="py-3 px-4 text-right">Jumlah Diklaim</th>
                    <th className="py-3 px-4 text-right">Stok Tersedia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#391C19]/10 text-xs">
                  {rewards.map((r) => (
                    <tr key={r.rewardId}>
                      <td className="py-3 px-4 font-bold text-[#391C19]">{r.rewardName}</td>
                      <td className="py-3 px-4 text-[#391C19]/75">{r.category}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                        {r.requiredPoints} Poin
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-[#8E1118]">
                        {r.redeemedCount}x Diklaim
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">{r.stock} Unit</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {reportTab === 'RANKING' && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              E. Rekapitulasi Ranking & Riwayat Pemenang
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                    <th className="py-3 px-4">Peringkat</th>
                    <th className="py-3 px-4">ID Member</th>
                    <th className="py-3 px-4">Nama Member</th>
                    <th className="py-3 px-4 text-right">Total Kunjungan</th>
                    <th className="py-3 px-4 text-right">Total Poin</th>
                    <th className="py-3 px-4 text-right">Total Transaksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#391C19]/10 text-xs">
                  {rankings.map((rk) => (
                    <tr key={rk.memberId}>
                      <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                        TOP #{rk.rankPosition}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular">{rk.memberId}</td>
                      <td className="py-3 px-4 font-semibold">{rk.memberName}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold">
                        {rk.totalVisits}x
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">{rk.totalPoints}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        Rp{rk.totalSpend.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. CENTRAL PROGRAM SETTINGS, ACCOUNT MANAGEMENT & ACTIVITY LOGS (PRD SEC 6)
 * ========================================================================== */
export const CentralSettingsAndAccountsView: React.FC<{
  settings: SystemSettings;
  users: User[];
  activityLogs: ActivityLog[];
  policyHistory: PolicyChangeLog[];
  currentUser: User;
  onSaveSettings: (updated: SystemSettings) => Promise<void>;
  onCreateStaffAccount: (payload: {
    fullName: string;
    email: string;
    phone: string;
    role: 'ADMIN' | 'KASIR';
    password?: string;
  }) => Promise<void>;
  onSetupOwnerSecurity: (payload: {
    fullName: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  onClearDemoData: () => Promise<void>;
  onResetDemoData: () => Promise<void>;
}> = ({
  settings,
  users,
  activityLogs,
  policyHistory,
  currentUser,
  onSaveSettings,
  onCreateStaffAccount,
  onSetupOwnerSecurity,
  onClearDemoData,
  onResetDemoData,
}) => {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRole, setStaffRole] = useState<'ADMIN' | 'KASIR'>('KASIR');
  const [staffPassword, setStaffPassword] = useState('');

  // Owner Security Setup
  const [ownerName, setOwnerName] = useState(currentUser.fullName);
  const [ownerEmail, setOwnerEmail] = useState(currentUser.email);
  const [ownerPhone, setOwnerPhone] = useState(currentUser.phone || '');
  const [ownerPass, setOwnerPass] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSaveCentral = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setStatusMsg('Pengaturan pusat program loyalty berhasil disimpan.');
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffEmail.trim()) return;
    await onCreateStaffAccount({
      fullName: staffName.trim(),
      email: staffEmail.trim(),
      phone: staffPhone.trim(),
      role: staffRole,
      password: staffPassword || undefined,
    });
    setStaffName('');
    setStaffEmail('');
    setStaffPhone('');
    setStaffPassword('');
    setStatusMsg('Akun staf Admin/Kasir berhasil ditambahkan.');
  };

  const handleUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ownerPass.length < 6) {
      setStatusMsg('Kata sandi Owner baru minimal 6 karakter.');
      return;
    }
    await onSetupOwnerSecurity({
      fullName: ownerName,
      email: ownerEmail,
      phone: ownerPhone,
      password: ownerPass,
    });
    setOwnerPass('');
    setStatusMsg('Kredensial keamanan Owner berhasil diperbarui.');
  };

  return (
    <div className="space-y-8">
      {statusMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-xs font-semibold flex items-center justify-between">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="underline font-bold cursor-pointer"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Central Settings Form */}
      <form
        onSubmit={handleSaveCentral}
        className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-5"
      >
        <div className="flex items-center justify-between border-b border-[#391C19]/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-[#8E1118]" />
            <div>
              <h2 className="font-display text-xl font-bold text-[#391C19]">
                Pengaturan Pusat Program Loyalty (10 Modul Kebijakan)
              </h2>
              <p className="text-xs text-[#391C19]/70">
                General, Kartu Member CR80, Ranking & Hadiah Top 3, serta Validasi Pendaftaran Member.
              </p>
            </div>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Simpan Pengaturan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Nama Brand Restoran
            </label>
            <input
              type="text"
              value={form.restaurantName}
              onChange={(e) => setForm((prev) => ({ ...prev, restaurantName: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">Cabang / Kota</label>
            <input
              type="text"
              value={form.branchLocation}
              onChange={(e) => setForm((prev) => ({ ...prev, branchLocation: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Alamat Lengkap Restoran (Tampil di Belakang Kartu)
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Slogan Kartu Member
            </label>
            <input
              type="text"
              value={form.slogan}
              onChange={(e) => setForm((prev) => ({ ...prev, slogan: e.target.value }))}
              className="w-full px-3.5 py-2 text-sm border border-[#391C19]/20 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#391C19]/10">
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Hadiah Default Juara Top 1
            </label>
            <input
              type="text"
              value={form.rank1RewardDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, rank1RewardDefault: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Hadiah Default Juara Top 2
            </label>
            <input
              type="text"
              value={form.rank2RewardDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, rank2RewardDefault: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Hadiah Default Juara Top 3
            </label>
            <input
              type="text"
              value={form.rank3RewardDefault}
              onChange={(e) => setForm((prev) => ({ ...prev, rank3RewardDefault: e.target.value }))}
              className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-bold text-[#391C19] mb-1">
              Bonus Poin Pendaftaran Member Baru
            </label>
            <input
              type="number"
              min={0}
              value={form.welcomeBonusPoints}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, welcomeBonusPoints: Number(e.target.value) || 0 }))
              }
              className="w-full px-3 py-2 text-xs font-mono-tabular border border-[#391C19]/20 rounded-lg"
            />
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#391C19] cursor-pointer">
              <input
                type="checkbox"
                checked={form.publicLeaderboardNames}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, publicLeaderboardNames: e.target.checked }))
                }
              />
              Tampilkan Nama Lengkap Member di Ranking Publik
            </label>
          </div>
          <div className="flex items-center pt-5">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#391C19] cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowSelfRegistration}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, allowSelfRegistration: e.target.checked }))
                }
              />
              Izinkan Pelanggan Mendaftar Mandiri
            </label>
          </div>
        </div>
      </form>

      {/* Account & Role Management + Owner Security Initialization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleAddStaff}
          className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#391C19]/10 pb-3">
            <UserPlus className="w-5 h-5 text-[#8E1118]" />
            <h3 className="font-display text-lg font-bold text-[#391C19]">
              Tambah Akun Admin / Kasir Baru
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Nama Lengkap</label>
              <input
                type="text"
                required
                value={staffName}
                onChange={(e) => setStaffName(e.target.value)}
                placeholder="Contoh: Rizky Pratama (Kasir Sore)"
                className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Role / Jabatan</label>
              <select
                value={staffRole}
                onChange={(e) => setStaffRole(e.target.value as 'ADMIN' | 'KASIR')}
                className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg bg-white"
              >
                <option value="KASIR">KASIR (Verifikasi Poin & Penukaran Reward)</option>
                <option value="ADMIN">ADMIN (Manajemen Member & Operasional)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">Email Login</label>
              <input
                type="email"
                required
                value={staffEmail}
                onChange={(e) => setStaffEmail(e.target.value)}
                placeholder="kasir2@topampera-batu.id"
                className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#391C19] mb-1">
                Kata Sandi Akun
              </label>
              <input
                type="password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg cursor-pointer"
          >
            + Buat Akun Staf
          </button>

          <div className="pt-3 border-t border-[#391C19]/10 space-y-2">
            <p className="text-xs font-bold text-[#391C19]">Daftar Akun Owner, Admin & Kasir:</p>
            {users
              .filter((u) => u.role !== 'MEMBER')
              .map((u) => (
                <div
                  key={u.userId}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F3EF] text-xs"
                >
                  <div>
                    <p className="font-bold text-[#391C19]">{u.fullName}</p>
                    <p className="text-[11px] text-[#391C19]/70">{u.email}</p>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#8E1118]">{u.role}</span>
                </div>
              ))}
          </div>
        </form>

        {/* Owner Security & Demo Data Management (PRD Section 13) */}
        <div className="space-y-6">
          <form
            onSubmit={handleUpdateOwner}
            className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-[#391C19]/10 pb-3">
              <Shield className="w-5 h-5 text-[#8E1118]" />
              <h3 className="font-display text-lg font-bold text-[#391C19]">
                Inisialisasi & Keamanan Akun Owner Utama
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Nama Owner</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#391C19] mb-1">Email Owner</label>
                <input
                  type="email"
                  required
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-[#391C19] mb-1">
                  Tetapkan Kata Sandi Baru Owner (Terenkripsi Scrypt)
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={ownerPass}
                  onChange={(e) => setOwnerPass(e.target.value)}
                  placeholder="Masukkan kata sandi baru minimal 6 karakter"
                  className="w-full px-3 py-2 text-xs border border-[#391C19]/20 rounded-lg"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-[#391C19] bg-[#D9B432] hover:bg-[#e5c23e] rounded-lg cursor-pointer"
            >
              Perbarui Kredensial Keamanan Owner
            </button>
          </form>

          {/* Demo Data Control */}
          <div className="bg-white rounded-xl p-6 border border-[#391C19]/10 space-y-3">
            <h3 className="font-display text-base font-bold text-[#391C19]">
              Manajemen Data Contoh (Demonstrasi vs Produksi)
            </h3>
            <p className="text-xs text-[#391C19]/75">
              Sesuai spesifikasi sistem, data contoh disediakan secara terpisah agar Anda dapat menguji seluruh fitur dan dapat dihapus kapan saja ketika siap digunakan untuk operasional murni.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onClearDemoData}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Hapus Seluruh Data Contoh (Demo)
              </button>
              <button
                type="button"
                onClick={onResetDemoData}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#391C19] bg-[#F7F3EF] hover:bg-[#391C19]/10 border border-[#391C19]/15 rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Muat Ulang Data Contoh Awal
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Logs Table */}
      <div className="bg-white rounded-xl border border-[#391C19]/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-[#391C19]/10 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-[#391C19]">
            Activity Logs (Riwayat Aktivitas Owner, Admin, Kasir & Member)
          </h3>
          <span className="text-xs font-mono-tabular text-[#391C19]/65">
            {activityLogs.length} Aktivitas Tercatat
          </span>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F7F3EF] text-[11px] font-semibold uppercase tracking-wider text-[#391C19]/75 border-b border-[#391C19]/10">
                <th className="py-3 px-4">Waktu</th>
                <th className="py-3 px-4">Pelaku</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Aktivitas</th>
                <th className="py-3 px-4">Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#391C19]/10 text-xs">
              {activityLogs.map((log) => (
                <tr key={log.logId} className="hover:bg-[#F7F3EF]/50">
                  <td className="py-3 px-4 font-mono-tabular text-[#391C19]/70">
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#391C19]">{log.userName}</td>
                  <td className="py-3 px-4 font-mono-tabular font-bold text-[#8E1118]">
                    {log.userRole}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#391C19]">{log.activity}</td>
                  <td className="py-3 px-4 text-[#391C19]/80">{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
