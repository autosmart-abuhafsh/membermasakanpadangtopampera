import React, { useEffect, useState } from 'react';
import { createInitialSeedState, LoyaltyDatabaseState } from './data/initialSeed';
import { Member, PointPolicy, SystemSettings, User } from './types/loyalty';
import { LandingAndAuthView } from './components/LandingAndAuthView';
import { MemberPortal } from './components/MemberPortal';
import { AdminPortal } from './components/AdminPortal';

export default function App() {
  const [dbState, setDbState] = useState<LoyaltyDatabaseState>(() => createInitialSeedState());
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function fetchServerState() {
      try {
        const res = await fetch('/api/state');
        if (res.ok) {
          const data = (await res.json()) as LoyaltyDatabaseState;
          if (mounted && data && Array.isArray(data.members)) {
            setDbState(data);
          }
        }
      } catch (_err) {
        // Fallback to initial seed state if server is starting
      } finally {
        if (mounted) setLoadingInitial(false);
      }
    }
    fetchServerState();
    return () => {
      mounted = false;
    };
  }, []);

  const apiCall = async <T,>(url: string, options?: RequestInit): Promise<T> => {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Terjadi kesalahan pada server.');
    }
    if (data?.state) {
      setDbState(data.state);
    }
    return data as T;
  };

  const handleLogin = async (identifier: string, password?: string) => {
    const res = await apiCall<{ user: User; member: Member | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    });
    setCurrentUser(res.user);
    setCurrentMemberId(res.member?.memberId || null);
  };

  const handleQuickSwitchUser = async (userId: string) => {
    const res = await apiCall<{ user: User; member: Member | null }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ quickSwitchUserId: userId }),
    });
    setCurrentUser(res.user);
    setCurrentMemberId(res.member?.memberId || null);
  };

  const handleRegisterMember = async (payload: {
    fullName: string;
    phone: string;
    email?: string;
    address?: string;
    birthDate?: string;
    password?: string;
  }) => {
    const res = await apiCall<{ member: Member; user: User; state: LoyaltyDatabaseState }>(
      '/api/members',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    setCurrentUser(res.user);
    setCurrentMemberId(res.member.memberId);
  };

  const activePolicy: PointPolicy =
    dbState.pointPolicies.find((p) => p.isActive) || dbState.pointPolicies[0];

  const activeMember = currentMemberId
    ? dbState.members.find((m) => m.memberId === currentMemberId) || null
    : currentUser
    ? dbState.members.find((m) => m.userId === currentUser.userId) || null
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Persistent Top Role Switcher Strip when Logged In for Easy Multi-Role Testing */}
      {currentUser && (
        <div className="no-print bg-[#25110F] text-[#F7F3EF] px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b border-[#D9B432]/25">
          <div className="flex items-center gap-2">
            <span className="text-[#D9B432] font-bold">Mode Aktif:</span>
            <span className="font-semibold">
              {currentUser.fullName} ({currentUser.role}
              {activeMember ? ` · ${activeMember.memberId}` : ''})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[#F7F3EF]/60 hidden sm:inline">Pindah Peran Cepat:</span>
            <button
              type="button"
              onClick={() => handleQuickSwitchUser('USR-MEM-1')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                activeMember?.memberId === 'TA-0001'
                  ? 'bg-[#D9B432] text-[#391C19]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Member (TA-0001)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitchUser('USR-KASIR-1')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                currentUser.role === 'KASIR'
                  ? 'bg-[#D9B432] text-[#391C19]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Kasir
            </button>
            <button
              type="button"
              onClick={() => handleQuickSwitchUser('USR-OWNER')}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer ${
                currentUser.role === 'OWNER'
                  ? 'bg-[#D9B432] text-[#391C19]'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              Owner / Admin
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentUser(null);
                setCurrentMemberId(null);
              }}
              className="px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#8E1118] hover:bg-[#6B0C11] text-white cursor-pointer"
            >
              Halaman Utama
            </button>
          </div>
        </div>
      )}

      {loadingInitial && !dbState.members.length ? (
        <div className="p-12 text-center text-sm font-medium text-[#391C19]">
          Memuat sistem Top Ampera Loyalty...
        </div>
      ) : !currentUser ? (
        <LandingAndAuthView
          members={dbState.members}
          transactions={dbState.transactions}
          rewards={dbState.rewards}
          announcements={dbState.announcements}
          awards={dbState.awards}
          policy={activePolicy}
          settings={dbState.settings}
          onLogin={handleLogin}
          onQuickSwitchUser={handleQuickSwitchUser}
          onRegisterMember={handleRegisterMember}
        />
      ) : currentUser.role === 'MEMBER' && activeMember ? (
        <MemberPortal
          currentUser={currentUser}
          member={activeMember}
          allMembers={dbState.members}
          transactions={dbState.transactions}
          pointLedger={dbState.pointLedger}
          policy={activePolicy}
          rewards={dbState.rewards}
          redemptions={dbState.redemptions}
          announcements={dbState.announcements}
          awards={dbState.awards}
          settings={dbState.settings}
          onSubmitTransaction={async (payload) => {
            await apiCall('/api/transactions', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                source: 'MEMBER_REQUEST',
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: 'MEMBER',
              }),
            });
          }}
          onRequestRedemption={async (rewardId) => {
            await apiCall('/api/redemptions', {
              method: 'POST',
              body: JSON.stringify({
                memberId: activeMember.memberId,
                rewardId,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: 'MEMBER',
              }),
            });
          }}
          onUpdateProfile={async (updates) => {
            await apiCall(`/api/members/${activeMember.memberId}`, {
              method: 'PUT',
              body: JSON.stringify({
                ...updates,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: 'MEMBER',
              }),
            });
          }}
          onLogout={() => {
            setCurrentUser(null);
            setCurrentMemberId(null);
          }}
        />
      ) : (
        <AdminPortal
          currentUser={currentUser}
          users={dbState.users}
          members={dbState.members}
          transactions={dbState.transactions}
          pointLedger={dbState.pointLedger}
          policy={activePolicy}
          rewards={dbState.rewards}
          redemptions={dbState.redemptions}
          announcements={dbState.announcements}
          awards={dbState.awards}
          activityLogs={dbState.activityLogs}
          policyHistory={dbState.policyHistory}
          settings={dbState.settings}
          onCreateMember={async (payload) => {
            await apiCall('/api/members', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onUpdateMember={async (memberId, updates) => {
            await apiCall(`/api/members/${memberId}`, {
              method: 'PUT',
              body: JSON.stringify({
                ...updates,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onDeleteMember={async (memberId) => {
            await apiCall(`/api/members/${memberId}`, {
              method: 'DELETE',
              body: JSON.stringify({
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onCreateDirectTransaction={async (payload) => {
            await apiCall('/api/transactions', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                source: 'CASHIER_DIRECT',
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onVerifyTransaction={async (transactionId, decision, rejectionReason) => {
            await apiCall(`/api/transactions/${transactionId}/verify`, {
              method: 'POST',
              body: JSON.stringify({
                decision,
                rejectionReason,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onAdjustPoints={async (payload) => {
            await apiCall('/api/points/adjust', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onSavePolicy={async (policy: PointPolicy) => {
            await apiCall('/api/policies/active', {
              method: 'PUT',
              body: JSON.stringify({
                policy,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onCreateReward={async (payload) => {
            await apiCall('/api/rewards', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onUpdateReward={async (rewardId, updates) => {
            await apiCall(`/api/rewards/${rewardId}`, {
              method: 'PUT',
              body: JSON.stringify({
                ...updates,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onDeleteReward={async (rewardId) => {
            await apiCall(`/api/rewards/${rewardId}`, {
              method: 'DELETE',
            });
          }}
          onVerifyRedemption={async (redemptionId, decision, rejectionReason) => {
            await apiCall(`/api/redemptions/${redemptionId}/verify`, {
              method: 'POST',
              body: JSON.stringify({
                decision,
                rejectionReason,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
                actorRole: currentUser.role,
              }),
            });
          }}
          onAssignAward={async (payload) => {
            await apiCall('/api/awards', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onUpdateAwardStatus={async (awardId, status) => {
            await apiCall(`/api/awards/${awardId}`, {
              method: 'PUT',
              body: JSON.stringify({
                status,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onCreateAnnouncement={async (payload) => {
            await apiCall('/api/announcements', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onUpdateAnnouncement={async (announcementId, updates) => {
            await apiCall(`/api/announcements/${announcementId}`, {
              method: 'PUT',
              body: JSON.stringify(updates),
            });
          }}
          onDeleteAnnouncement={async (announcementId) => {
            await apiCall(`/api/announcements/${announcementId}`, {
              method: 'DELETE',
            });
          }}
          onSaveSettings={async (settings: SystemSettings) => {
            await apiCall('/api/settings', {
              method: 'PUT',
              body: JSON.stringify({
                settings,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onCreateStaffAccount={async (payload) => {
            await apiCall('/api/accounts', {
              method: 'POST',
              body: JSON.stringify({
                ...payload,
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onSetupOwnerSecurity={async (payload) => {
            await apiCall('/api/auth/setup-owner', {
              method: 'POST',
              body: JSON.stringify(payload),
            });
          }}
          onClearDemoData={async () => {
            await apiCall('/api/demo/clear', {
              method: 'POST',
              body: JSON.stringify({
                actorId: currentUser.userId,
                actorName: currentUser.fullName,
              }),
            });
          }}
          onResetDemoData={async () => {
            await apiCall('/api/demo/reset', {
              method: 'POST',
            });
          }}
          onLogout={() => {
            setCurrentUser(null);
            setCurrentMemberId(null);
          }}
        />
      )}
    </div>
  );
}
