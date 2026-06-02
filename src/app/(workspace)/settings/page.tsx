// /settings — account settings on the UFF workspace shell (Build 16.5b).
// Account-scoped (not team-scoped), so it uses the user-context sidebar.

import { redirect } from "next/navigation";
import { getUserHomeData } from "@/lib/dashboard/user-home-data";
import SettingsClient from "./SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const data = await getUserHomeData();
  if (!data) redirect("/login");
  return <SettingsClient data={data} />;
}
