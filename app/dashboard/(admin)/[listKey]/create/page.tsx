import { CreatePage } from "@/features/dashboard/screens/CreatePage";
import { RecordsGate } from "@/features/dashboard/components/RecordsGate";

export default async function Page(props: Parameters<typeof CreatePage>[0]) {
  return <RecordsGate><CreatePage {...props} /></RecordsGate>
}
