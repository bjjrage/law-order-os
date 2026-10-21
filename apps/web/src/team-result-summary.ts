import type { TeamRun } from "./specialist-engine.js";

type Finding = TeamRun["opinions"][number]["findings"][number];
export type ResultTopic = {
  issue: string;
  title: string;
  action: string;
  priority: number;
  passages: Array<{
    finding: Finding;
    participants: string[];
    title: string;
    matches: boolean;
  }>;
};

function topicLabel(issue: string) {
  if (/importes diferentes/iu.test(issue))
    return {
      title: "Importes distintos entre documentos",
      action: "Aclarar qué importe corresponde y conservar la explicación.",
      priority: 0,
    };
  if (/sin documento identificado|sin respaldo.*anexo/iu.test(issue))
    return {
      title: "Anexo pendiente de incorporar",
      action: "Incorporar el anexo referido antes de cerrar ese punto.",
      priority: 0,
    };
  if (/representación|representaci[oó]n|facultades/iu.test(issue))
    return {
      title: "Representación por acreditar",
      action: "Revisar el instrumento y las facultades de quien firma.",
      priority: 1,
    };
  if (/Comparar instrumentos|versión aplicable/iu.test(issue))
    return {
      title: "Versión del documento por confirmar",
      action: "Identificar la versión aceptada y sus modificaciones.",
      priority: 1,
    };
  if (/Condición documental/iu.test(issue))
    return {
      title: "Condiciones de cumplimiento",
      action: "Revisar de qué depende cada prestación; no darla por cumplida.",
      priority: 2,
    };
  if (/Excepción o reserva/iu.test(issue))
    return {
      title: "Excepciones y reservas",
      action: "Relacionar cada excepción con la obligación que modifica.",
      priority: 2,
    };
  if (/Prestación o deber/iu.test(issue))
    return {
      title: "Obligaciones de las partes",
      action: "Precisar quién debe hacer qué y qué respaldo falta.",
      priority: 2,
    };
  return {
    title: issue,
    action: "Revisar el pasaje y el pendiente indicado por el especialista.",
    priority: 2,
  };
}

/** A presentation of recorded findings, never a new legal conclusion. */
export function buildResultSummary(run: TeamRun) {
  const topics = new Map<string, ResultTopic>();
  let totalPassages = 0,
    matchedPassages = 0;
  for (const opinion of run.opinions)
    for (const finding of opinion.findings) {
      const evidence = run.evidence.find(
        (e) =>
          e.document_id === finding.evidence.document_id &&
          e.version_id === finding.evidence.version_id,
      );
      const matches = Boolean(
        evidence &&
        evidence.text.slice(finding.evidence.start, finding.evidence.end) ===
          finding.evidence.quote,
      );
      totalPassages++;
      if (matches) matchedPassages++;
      let topic = topics.get(finding.issue);
      if (!topic) {
        topic = {
          issue: finding.issue,
          ...topicLabel(finding.issue),
          passages: [],
        };
        topics.set(finding.issue, topic);
      }
      const prior = topic.passages.find(
        (p) =>
          p.finding.evidence.document_id === finding.evidence.document_id &&
          p.finding.evidence.version_id === finding.evidence.version_id &&
          p.finding.evidence.start === finding.evidence.start &&
          p.finding.evidence.end === finding.evidence.end &&
          p.finding.evidence.quote === finding.evidence.quote &&
          p.finding.interpretation === finding.interpretation &&
          p.finding.alternative === finding.alternative &&
          p.finding.missing === finding.missing,
      );
      if (prior) {
        if (!prior.participants.includes(opinion.participant_id))
          prior.participants.push(opinion.participant_id);
      } else
        topic.passages.push({
          finding,
          participants: [opinion.participant_id],
          title: evidence?.title ?? "Documento no localizado",
          matches,
        });
    }
  const accepted = run.objections.filter(
    (o) =>
      run.replies.find((r) => r.objection_id === o.id)?.disposition ===
      "ACCEPTED_LIMIT",
  ).length;
  const disagreements = run.objections.filter(
    (o) =>
      run.replies.find((r) => r.objection_id === o.id)?.disposition ===
      "DISAGREEMENT_PRESERVED",
  ).length;
  return {
    topics: [...topics.values()].sort((a, b) => a.priority - b.priority),
    totalPassages,
    matchedPassages,
    unmatchedPassages: totalPassages - matchedPassages,
    debate: {
      authorized: run.config.adversarial,
      total: run.objections.length,
      accepted,
      disagreements,
      unanswered: run.objections.length - accepted - disagreements,
    },
  };
}
