export interface UserOrganization {
  id: string;
  name: string;
  slug?: string | null;
  role?: string;
  kind?: string;
  smeId?: string | null;
  platforms: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
  staffRole?: "admin" | "facilitator" | "reviewer" | null;
  platforms?: string[];
  organizations?: UserOrganization[];
}
