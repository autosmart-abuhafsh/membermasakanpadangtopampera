import React, { useState } from 'react';
import { Member, SystemSettings } from '../types/loyalty';
import { generateQrMatrix } from '../utils/loyaltyEngine';
import { CreditCard, Download, Eye, Printer, RotateCw, ShieldCheck, Sparkles, X } from 'lucide-react';

interface MemberCardDigitalProps {
  member: Member;
  settings: SystemSettings;
  compact?: boolean;
  onOpenFullCard?: () => void;
}

export const QrCodeSvg: React.FC<{ payload: string; size?: number }> = ({ payload, size = 84 }) => {
  const matrix = generateQrMatrix(payload);
  const grid = matrix.length;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid + 2} ${grid + 2}`}
      className="bg-white rounded-md p-0.5 border border-[#D9B432]/40 shrink-0"
      role="img"
      aria-label={`QR Code verifikasi member ${payload}`}
    >
      <rect width={grid + 2} height={grid + 2} fill="#FFFFFF" />
      {matrix.map((row, rIdx) =>
        row.map((cell, cIdx) =>
          cell ? (
            <rect
              key={`${rIdx}-${cIdx}`}
              x={cIdx + 1}
              y={rIdx + 1}
              width={1}
              height={1}
              fill="#391C19"
            />
          ) : null
        )
      )}
    </svg>
  );
};

export const MinangCrestLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
    <circle cx="24" cy="24" r="22" fill="#8E1118" stroke="#D9B432" strokeWidth="2.5" />
    {/* Traditional Minangkabau Rumah Gadang Bagonjong Roof Silhouette */}
    <path
      d="M8 26C12 19 15 12 16 9C18 15 21 18 24 18C27 18 30 15 32 9C33 12 36 19 40 26H8Z"
      fill="#D9B432"
    />
    <path d="M13 26H35V35H13V26Z" fill="#F7F3EF" />
    <rect x="21" y="29" width="6" height="6" fill="#8E1118" />
    <path d="M10 36H38" stroke="#D9B432" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const CardFrontFace: React.FC<{
  member: Member;
  settings: SystemSettings;
  isPrintMode?: boolean;
}> = ({ member, settings, isPrintMode = false }) => {
  return (
    <div
      className={`cr80-card ${
        isPrintMode ? 'cr80-print-card' : ''
      } bg-gradient-to-br from-[#8E1118] via-[#750D13] to-[#391C19] text-white p-5 flex flex-col justify-between border border-[#D9B432]/50 shadow-md select-none`}
    >
      {/* Subtle Minang geometric gold accent lines */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle at 85% 15%, #D9B432 0%, transparent 45%), radial-gradient(circle at 10% 90%, #D9B432 0%, transparent 40%)',
        }}
      />

      {/* Top Row: Brand & Loyalty Label */}
      <div className="relative z-10 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <MinangCrestLogo className="w-9 h-9 shrink-0" />
          <div>
            <p className="text-[10px] tracking-widest uppercase text-[#D9B432] font-semibold leading-tight">
              {settings.cardFrontTitle || 'TOP AMPERA MEMBER'}
            </p>
            <h4 className="font-display text-sm font-bold tracking-tight text-white leading-snug">
              {settings.restaurantName} · {settings.branchLocation}
            </h4>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase text-[#D9B432] border border-[#D9B432]/50 rounded px-2 py-0.5 bg-[#391C19]/60">
            <Sparkles className="w-2.5 h-2.5" />
            {settings.cardLabel || 'LOYALTY MEMBER'}
          </span>
        </div>
      </div>

      {/* Middle & Bottom Row: Member Identity + QR Code */}
      <div className="relative z-10 flex items-end justify-between gap-3 pt-2">
        <div className="space-y-1.5 min-w-0">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#F7F3EF]/75">Nama Member</p>
            <p className="text-base font-bold text-white truncate">{member.fullName}</p>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-[#F7F3EF]/75 whitespace-nowrap">ID Member</p>
              <p className="font-mono-tabular text-xs sm:text-sm font-semibold text-[#D9B432] whitespace-nowrap">{member.memberId}</p>
            </div>
            <div className="shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-[#F7F3EF]/75 whitespace-nowrap">Bergabung</p>
              <p className="font-mono-tabular text-xs text-[#F7F3EF] whitespace-nowrap">{member.joinDate}</p>
            </div>
            <div className="shrink-0">
              <p className="text-[9px] uppercase tracking-wider text-[#F7F3EF]/75 whitespace-nowrap">Status</p>
              <p className="text-xs font-medium text-[#D9B432] whitespace-nowrap">{member.memberStatus}</p>
            </div>
          </div>
        </div>

        {/* Unique QR Code */}
        <div className="flex flex-col items-center shrink-0">
          <QrCodeSvg payload={member.qrCode || `TOPAMPERA:MEMBER:${member.memberId}`} size={74} />
          <span className="mt-1 font-mono-tabular text-[9px] text-[#F7F3EF]/80 tracking-wider">
            SCAN VERIFIKASI
          </span>
        </div>
      </div>
    </div>
  );
};

export const CardBackFace: React.FC<{
  member: Member;
  settings: SystemSettings;
  isPrintMode?: boolean;
}> = ({ member, settings, isPrintMode = false }) => {
  return (
    <div
      className={`cr80-card ${
        isPrintMode ? 'cr80-print-card' : ''
      } bg-[#F7F3EF] text-[#391C19] p-5 flex flex-col justify-between border border-[#D9B432] shadow-md select-none`}
    >
      {/* Top Magnetic-style Gold/Maroon Header Strip */}
      <div>
        <div className="flex items-center justify-between border-b border-[#8E1118]/20 pb-2 mb-2">
          <div className="flex items-center gap-2">
            <MinangCrestLogo className="w-6 h-6" />
            <span className="font-display text-xs font-bold text-[#8E1118]">
              {settings.restaurantName} Loyalty Program
            </span>
          </div>
          <span className="font-mono-tabular text-[10px] font-semibold text-[#8E1118]">
            ID: {member.memberId}
          </span>
        </div>
        <p className="text-[11px] italic font-medium text-[#8E1118] mb-2">
          "{settings.slogan}"
        </p>

        {/* Terms & Conditions */}
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#391C19]">
            Ketentuan Penggunaan Kartu:
          </p>
          <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-[#391C19]/90 leading-snug">
            {(settings.cardTerms && settings.cardTerms.length > 0
              ? settings.cardTerms
              : [
                  'Tunjukkan kartu atau QR Code kepada kasir saat bertransaksi.',
                  'Poin dihitung otomatis sesuai nominal pembelian yang diverifikasi.',
                  'Kartu ini milik Top Ampera dan tidak dapat dipindahtangankan.',
                ]
            )
              .slice(0, 4)
              .map((term, idx) => (
                <li key={idx} className="truncate">
                  {term}
                </li>
              ))}
          </ol>
        </div>
      </div>

      {/* Footer Contact Info */}
      <div className="pt-2 border-t border-[#391C19]/15 flex items-end justify-between gap-2 text-[9.5px] text-[#391C19]/80">
        <div className="min-w-0">
          <p className="font-semibold text-[#8E1118] truncate">{settings.address}</p>
          <p className="font-mono-tabular">Layanan Pelanggan WhatsApp: {settings.phoneContact}</p>
        </div>
        <div className="text-right shrink-0">
          <span className="font-mono-tabular text-[9px] text-[#391C19]/70">CR80 · 85.6×54mm</span>
        </div>
      </div>
    </div>
  );
};

export const MemberCardDigital: React.FC<MemberCardDigitalProps> = ({
  member,
  settings,
  compact = false,
  onOpenFullCard,
}) => {
  const [activeSide, setActiveSide] = useState<'FRONT' | 'BACK' | 'BOTH'>('BOTH');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const handlePrintCard = () => {
    setShowPrintModal(true);
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleDownloadCardSvg = () => {
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="856" height="540" viewBox="0 0 856 540">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#8E1118"/>
          <stop offset="60%" stop-color="#6B0C11"/>
          <stop offset="100%" stop-color="#391C19"/>
        </linearGradient>
      </defs>
      <rect width="856" height="540" rx="28" fill="url(#bg)" stroke="#D9B432" stroke-width="6"/>
      <text x="50" y="75" fill="#D9B432" font-family="sans-serif" font-size="22" font-weight="bold" letter-spacing="3">${
        settings.cardFrontTitle || 'TOP AMPERA MEMBER'
      }</text>
      <text x="50" y="115" fill="#FFFFFF" font-family="Georgia, serif" font-size="32" font-weight="bold">${
        settings.restaurantName
      } - ${settings.branchLocation}</text>
      <text x="50" y="290" fill="#F7F3EF" font-family="sans-serif" font-size="18" opacity="0.8">NAMA MEMBER</text>
      <text x="50" y="335" fill="#FFFFFF" font-family="sans-serif" font-size="38" font-weight="bold">${
        member.fullName
      }</text>
      <text x="50" y="415" fill="#F7F3EF" font-family="sans-serif" font-size="18" opacity="0.8">ID MEMBER</text>
      <text x="50" y="460" fill="#D9B432" font-family="monospace" font-size="36" font-weight="bold">${
        member.memberId
      }</text>
      <text x="310" y="415" fill="#F7F3EF" font-family="sans-serif" font-size="18" opacity="0.8">BERGABUNG</text>
      <text x="310" y="460" fill="#FFFFFF" font-family="monospace" font-size="28">${member.joinDate}</text>
      <text x="50" y="505" fill="#F3E4A8" font-family="sans-serif" font-size="16">${settings.slogan}</text>
    </svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kartu-Member-TopAmpera-${member.memberId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadStatus(`Kartu ${member.memberId} berhasil diunduh.`);
    setTimeout(() => setDownloadStatus(null), 4000);
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <CardFrontFace member={member} settings={settings} />
        <div className="flex flex-wrap items-center gap-2">
          {onOpenFullCard && (
            <button
              type="button"
              onClick={onOpenFullCard}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              Lihat Kartu Depan & Belakang
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#391C19] bg-white border border-[#391C19]/20 hover:bg-[#F7F3EF] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-[#8E1118]" />
            Cetak / Simpan PDF
          </button>
        </div>

        {showPrintModal && (
          <PrintCardModal
            member={member}
            settings={settings}
            onClose={() => setShowPrintModal(false)}
            onPrint={handlePrintCard}
            onDownloadSvg={handleDownloadCardSvg}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toolbar Controls */}
      <div className="bg-white rounded-xl p-4 border border-[#391C19]/10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-lg font-bold text-[#391C19]">
            Kartu Member Digital (Standar ID CR80)
          </h3>
          <p className="text-xs text-[#391C19]/70">
            Ukuran cetak presisi 85,6 × 54 mm · Dilengkapi QR Code verifikasi unik tanpa data sensitif.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-[#F7F3EF] p-1 rounded-lg border border-[#391C19]/10">
            <button
              type="button"
              onClick={() => setActiveSide('BOTH')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSide === 'BOTH'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Depan & Belakang
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('FRONT')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSide === 'FRONT'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Tampak Depan
            </button>
            <button
              type="button"
              onClick={() => setActiveSide('BACK')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                activeSide === 'BACK'
                  ? 'bg-[#8E1118] text-white'
                  : 'text-[#391C19]/75 hover:text-[#391C19]'
              }`}
            >
              Tampak Belakang
            </button>
          </div>

          <button
            type="button"
            onClick={handleDownloadCardSvg}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#391C19] bg-white border border-[#391C19]/20 hover:bg-[#F7F3EF] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#8E1118]" />
            Download Kartu
          </button>

          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Preview & Cetak PDF (CR80)
          </button>
        </div>
      </div>

      {downloadStatus && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between">
          <span>{downloadStatus}</span>
          <button
            type="button"
            onClick={() => setDownloadStatus(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Card Display Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {(activeSide === 'BOTH' || activeSide === 'FRONT') && (
          <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#391C19]/70">
                Bagian Depan Kartu · Identitas & QR Code
              </span>
              <span className="font-mono-tabular text-xs text-[#8E1118] font-semibold">
                {member.memberId}
              </span>
            </div>
            <CardFrontFace member={member} settings={settings} />
          </div>
        )}

        {(activeSide === 'BOTH' || activeSide === 'BACK') && (
          <div className="bg-white rounded-xl p-5 border border-[#391C19]/10 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#391C19]/70">
                Bagian Belakang Kartu · Ketentuan & Kontak
              </span>
              <button
                type="button"
                onClick={() =>
                  setActiveSide((prev) => (prev === 'FRONT' ? 'BACK' : prev === 'BACK' ? 'BOTH' : 'BOTH'))
                }
                className="inline-flex items-center gap-1 text-xs text-[#8E1118] hover:underline cursor-pointer"
              >
                <RotateCw className="w-3 h-3" />
                Putar Sisi
              </button>
            </div>
            <CardBackFace member={member} settings={settings} />
          </div>
        )}
      </div>

      {/* Verification Security Notice */}
      <div className="bg-white rounded-xl p-4 border border-[#391C19]/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#8E1118] shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-[#391C19]">
              Keamanan Kode Verifikasi QR ({member.qrCode})
            </p>
            <p className="text-xs text-[#391C19]/75">
              QR Code ini hanya berisi token verifikasi identitas member ({member.memberId}) tanpa menyimpan kata sandi atau data sensitif. Kasir dapat memindai atau memasukkan kode ini saat memverifikasi poin dan penukaran reward.
            </p>
          </div>
        </div>
        <div className="font-mono-tabular text-xs bg-[#F7F3EF] px-3 py-1.5 rounded border border-[#391C19]/10 shrink-0">
          Ukuran Standar: 85,6 × 54 mm (CR80)
        </div>
      </div>

      {showPrintModal && (
        <PrintCardModal
          member={member}
          settings={settings}
          onClose={() => setShowPrintModal(false)}
          onPrint={handlePrintCard}
          onDownloadSvg={handleDownloadCardSvg}
        />
      )}
    </div>
  );
};

const PrintCardModal: React.FC<{
  member: Member;
  settings: SystemSettings;
  onClose: () => void;
  onPrint: () => void;
  onDownloadSvg: () => void;
}> = ({ member, settings, onClose, onPrint, onDownloadSvg }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="print-card-modal-title"
    >
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 border border-[#391C19]/15 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#391C19]/10 pb-4 no-print">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-5 h-5 text-[#8E1118]" />
            <div>
              <h3 id="print-card-modal-title" className="font-display text-lg font-bold text-[#391C19]">
                Preview Cetak Kartu Member (Standar CR80 · 85,6 × 54 mm)
              </h3>
              <p className="text-xs text-[#391C19]/70">
                Siap dicetak langsung pada printer ID Card (PVC) atau disimpan sebagai PDF berkualitas tinggi.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup preview cetak kartu"
            className="p-1.5 rounded-lg text-[#391C19]/60 hover:text-[#391C19] hover:bg-[#F7F3EF] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Sheet Area */}
        <div
          id="printable-area"
          className="bg-[#F7F3EF] p-6 rounded-xl border border-dashed border-[#391C19]/25 flex flex-col items-center gap-6"
        >
          <div className="text-center space-y-1">
            <p className="font-display text-sm font-bold text-[#8E1118]">
              LEMBAR CETAK KARTU MEMBER RESMI – {settings.restaurantName.toUpperCase()}
            </p>
            <p className="text-[11px] text-[#391C19]/75 font-mono-tabular">
              Member: {member.fullName} ({member.memberId}) · Dimensi Presisi CR80: 85,6 mm × 54,0 mm
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full justify-items-center">
            <div className="space-y-1.5 flex flex-col items-center w-full">
              <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#391C19]/70">
                SISI DEPAN (FRONT)
              </span>
              <CardFrontFace member={member} settings={settings} isPrintMode />
            </div>

            <div className="space-y-1.5 flex flex-col items-center w-full">
              <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-[#391C19]/70">
                SISI BELAKANG (BACK)
              </span>
              <CardBackFace member={member} settings={settings} isPrintMode />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 no-print">
          <p className="text-xs text-[#391C19]/70">
            Tips Cetak: Pilih opsi <strong>"Save as PDF"</strong> atau printer kartu dengan skala <strong>100% (Actual Size)</strong> dan aktifkan <strong>Background Graphics</strong>.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadSvg}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#391C19] bg-[#F7F3EF] hover:bg-[#391C19]/10 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Unduh File Kartu
            </button>
            <button
              type="button"
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#8E1118] hover:bg-[#6B0C11] rounded-lg transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak Kartu / Simpan PDF Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
