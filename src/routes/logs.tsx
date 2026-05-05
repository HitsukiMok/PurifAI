import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/dashboard/Placeholder";

export const Route = createFileRoute("/logs")({
  component: () => <Placeholder title="Logs" subtitle="Full ingestion audit trail" />,
});
