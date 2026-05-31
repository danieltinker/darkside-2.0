import { loadModel } from "@/brain/adapter/loadModel";
import { BrainBoard } from "@/brain/components/BrainBoard";

// Server component: read gems/taxonomy on the server, hand a plain-JSON model to
// the client board. force-dynamic keeps it simple (no caching of fs reads).
export const dynamic = "force-dynamic";

export default function BrainPage() {
  const model = loadModel();
  return <BrainBoard model={model} />;
}
