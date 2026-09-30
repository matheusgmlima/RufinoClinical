import { PageSkeleton } from "@/components/admin/skeletons";

// Switching panel sections shows this at once (it is prefetched) instead of waiting on the data.
export default function AdminLoading() {
  return <PageSkeleton />;
}
