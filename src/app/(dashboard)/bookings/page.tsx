import { getBookings, getBlockedSlots } from "@/lib/actions/booking";
import { BookingDashboardClient } from "@/components/bookings/booking-dashboard-client";
import { checkPagePermission } from "@/lib/check-permission";

export default async function BookingsPage() {
  await checkPagePermission("/bookings");
  // 이번주 월~토 기간
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const startDate = monday.toISOString().split("T")[0];
  const endDate = saturday.toISOString().split("T")[0];

  const [bookingsResult, blockedSlots] = await Promise.all([
    getBookings({ startDate, endDate, limit: 200 }),
    getBlockedSlots(startDate, endDate),
  ]);

  return (
    <BookingDashboardClient
      initialBookings={bookingsResult.data}
      initialBlocked={blockedSlots}
      initialTotal={bookingsResult.total}
    />
  );
}
