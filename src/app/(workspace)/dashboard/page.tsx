import { redirect } from "next/navigation";
import { getUserHomeData } from "@/lib/dashboard/user-home-data";
import UserDashboardClient from "./UserDashboardClient";

export default async function UserDashboardPage() {
  const data = await getUserHomeData();
  if (!data) redirect("/login");
  return <UserDashboardClient data={data} />;
}
