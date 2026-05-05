import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/dashboard/Placeholder";

export const Route = createFileRoute("/settings")({
  component: () => <Placeholder title="Settings" subtitle="Workspace configuration" />,
});
