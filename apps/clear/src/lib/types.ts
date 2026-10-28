export interface UserProfile {
  id: string;
  name: string;
  email: string;
  activeOrganizationId?: string | null;
}
