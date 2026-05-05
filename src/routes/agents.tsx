import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/dashboard/Placeholder";

export const Route = createFileRoute("/agents")({
  component: () => <Placeholder title="AI Agents" subtitle="Inventory & policy bindings" />,
});
