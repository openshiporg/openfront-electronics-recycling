import { ItemPage } from "@/features/dashboard/screens/ItemPage";
import { RecordsGate } from "@/features/dashboard/components/RecordsGate";

export default async function Page(props: Parameters<typeof ItemPage>[0]) {
  return <RecordsGate><ItemPage {...props} /></RecordsGate>
}
