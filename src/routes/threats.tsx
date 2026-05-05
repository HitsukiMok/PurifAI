import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/dashboard/Placeholder";

export const Route = createFileRoute("/threats")({
  component: () => <Placeholder title="Threats" subtitle="Detected attack techniques" />,
});
