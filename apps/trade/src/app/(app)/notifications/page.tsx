import { redirect } from "next/navigation";
import { NotificationCentre, type NotificationList, type NotificationPreferences } from "@/components/notifications/notification-centre";
import { getMe } from "@/lib/api";
import { tradeGet } from "@/lib/trade-api";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  const [list, preferences] = await Promise.all([tradeGet<NotificationList>("/notifications?limit=50"), tradeGet<NotificationPreferences>("/notification-preferences")]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">Notifications</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">What the platform tells you, here and by email. Choose below how each kind reaches you.</p>
      </div>
      {list.data && preferences.data ? (
        <NotificationCentre initial={list.data} preferences={preferences.data} staff={Boolean(me.staffRole)} />
      ) : (
        <p className="text-sm text-ink-2">{list.error ?? "Your notifications aren't available."}</p>
      )}
    </div>
  );
}
