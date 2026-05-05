import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/dashboard/Placeholder";

export const Route = createFileRoute("/policies")({
  component: () => <Placeholder title="Policies" subtitle="Sanitization & blocking rules" />,
});
