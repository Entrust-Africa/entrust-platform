export type { UserProfile, UserOrganization } from "@entrust/account";
export {
  DELIVERY_MODES,
  type DeliveryMode,
  ENROLLMENT_STATUSES,
  type EnrollmentStatus,
} from "@entrust/db";
import type { DeliveryMode, EnrollmentStatus } from "@entrust/db";

export interface TradeProgram {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TradeCohort {
  id: string;
  programId: string;
  programName: string;
  name: string;
  deliveryMode: DeliveryMode;
  country: string;
  language: string;
  sponsorOrganizationId: string | null;
  sponsorName: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  enrolledCount: number;
}

export interface TradeCohortEnrolment {
  enrollmentId: string;
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  tradingName: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
}

export interface TradeCohortDetail extends Omit<TradeCohort, "enrolledCount"> {
  enrolments: TradeCohortEnrolment[];
}

export interface TradeEnrollmentSummary {
  id: string;
  cohortId: string;
  cohortName: string;
  programId: string;
  programName: string;
  organizationId: string;
  organizationName: string;
  smeId: string | null;
  legalName: string | null;
  status: EnrollmentStatus;
  enrolledAt: string;
  completedAt: string | null;
  withdrawnAt: string | null;
}
