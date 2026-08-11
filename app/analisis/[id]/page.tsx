import { AnalysisStatus } from "@/components/AnalysisStatus";

type Props = { params: Promise<{ id: string }> };

export default async function AnalisisPage({ params }: Props) {
  const { id } = await params;
  return <AnalysisStatus id={id} />;
}
