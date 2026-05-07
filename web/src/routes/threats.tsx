import { createFileRoute } from "@tanstack/react-router";
import { ThreatsPage } from "@/components/dashboard/ThreatsPage";

export const Route = createFileRoute("/threats")({
  head: () => ({
    meta: [
      { title: "Threats — AgentShield Platform" },
      { name: "description", content: "Detected attack techniques and threat intelligence." },
    ],
  }),
  component: ThreatsPage,
});
