'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ROLE_LABEL } from '@/lib/roles';
import { PageLoading } from '@/components/ui/Loading';
import { RoleActions } from '@/components/dashboard/RoleActions';
import { SuperAdminBoard } from '@/components/dashboard/boards/SuperAdmin';
import { FinanceBoard } from '@/components/dashboard/boards/Finance';
import { ModeratorBoard } from '@/components/dashboard/boards/Moderator';
import { AuditorBoard } from '@/components/dashboard/boards/Auditor';
import { NationalBoard } from '@/components/dashboard/boards/National';
import { RegionalBoard } from '@/components/dashboard/boards/Regional';
import { AmbassadorBoard } from '@/components/dashboard/boards/Ambassador';
import { DirectorBoard } from '@/components/dashboard/boards/Director';
import { StaffBoard } from '@/components/dashboard/boards/Staff';
import { AgentBoard } from '@/components/dashboard/boards/Agent';
import { DonorBoard } from '@/components/dashboard/boards/Donor';
import { PartnerBoard } from '@/components/dashboard/boards/Partner';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useSWR<any>('/dashboard', fetcher, { refreshInterval: 60000 });

  if (isLoading || !data || !user) return <PageLoading />;

  const boards: Record<string, React.ComponentType<{ data: any }>> = {
    SUPER_ADMIN: SuperAdminBoard,
    ADMIN_FINANCE: FinanceBoard,
    MODERATOR: ModeratorBoard,
    ETHICS_AUDITOR: AuditorBoard,
    NATIONAL_MANAGER: NationalBoard,
    REGIONAL_MANAGER: RegionalBoard,
    AMBASSADOR: AmbassadorBoard,
    ORPHANAGE_DIRECTOR: DirectorBoard,
    ORPHANAGE_STAFF: StaffBoard,
    FIELD_AGENT: AgentBoard,
    DONOR: DonorBoard,
    PARTNER: PartnerBoard,
  };

  const Board = boards[user.role];

  return (
    <div className="space-y-7">
      <header>
        <h1 className="text-xl font-semibold tracking-tight text-ink-950 sm:text-2xl">
          Bonjour {user.firstName}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {ROLE_LABEL[user.role]}
          {user.orphanage ? ` · ${user.orphanage.name}` : ''}
          {user.province ? ` · ${user.province.nameFr}` : ''}
          {user.country && !user.province ? ` · ${user.country.nameFr}` : ''}
        </p>
      </header>

      {Board ? <Board data={data} /> : null}

      <RoleActions role={user.role} />
    </div>
  );
}
