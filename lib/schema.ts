import { z } from "zod";

export const analysisInputSchema = z.object({
  clientBrand: z.string().trim().min(1, "Indica la empresa cliente"),
  competitors: z
    .array(z.string().trim().min(1))
    .min(1, "Agrega al menos un competidor"),
  country: z.string().trim().min(1).default("Bolivia"),
  category: z.string().trim().min(1).default("Automóviles"),
  periodLabel: z.string().trim().min(1).default("Mensual"),
  notes: z.string().trim().default(""),
  knownData: z.string().trim().default(""),
  sources: z
    .array(z.enum(["meta", "google", "press"]))
    .min(1, "Selecciona al menos una fuente"),
  pressMedia: z.array(z.string().trim()).default([]),
  forceDemo: z.boolean().default(false),
});

export type AnalysisInputParsed = z.infer<typeof analysisInputSchema>;
