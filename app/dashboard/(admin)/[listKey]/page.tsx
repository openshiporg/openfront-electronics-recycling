import { ListPage } from "@/features/dashboard/screens/ListPage";
import { RecordsGate } from "@/features/dashboard/components/RecordsGate";

export default async function Page(props: Parameters<typeof ListPage>[0]) {
  return <RecordsGate><ListPage {...props} /></RecordsGate>
}
