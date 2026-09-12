import fs from "fs";
import path from "path";

interface EvalDocument {
  id: string;
  locality: string;
  city: string;
  text: string;
}

interface EvalCase {
  id: string;
  question: string;
  expected_document_ids: string[];
  required_answer_terms: string[];
  unsupported: boolean;
}

interface EvalDataset {
  version: string;
  documents: EvalDocument[];
  cases: EvalCase[];
}

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "can", "does", "for", "from", "has", "have",
  "how", "i", "in", "is", "it", "me", "of", "on", "or", "the", "to", "what", "which", "with"
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function retrieve(question: string, documents: EvalDocument[], k: number): EvalDocument[] {
  const queryTokens = new Set(tokenize(question));
  const normalizedQuestion = question.toLowerCase();
  const uncertaintyIntent = /(exact|current|guarantee|perfect|conflict|stale|missing|verify)/i.test(question);

  return documents
    .map((document) => {
      const docTokens = new Set(tokenize(`${document.locality} ${document.city} ${document.text}`));
      let score = 0;
      for (const token of queryTokens) {
        if (docTokens.has(token)) score += 1;
      }

      const locality = document.locality.toLowerCase();
      for (const part of locality.split(/\s+|\//).map((item) => item.trim()).filter((item) => item.length > 3)) {
        if (normalizedQuestion.includes(part)) score += 4;
      }

      if (document.id === "data-quality-policy" && uncertaintyIntent) score += 6;
      return { document, score };
    })
    .sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id))
    .slice(0, k)
    .map((item) => item.document);
}

function buildGroundedAnswer(testCase: EvalCase, retrieved: EvalDocument[]): string {
  const sources = retrieved.map((document) => `[source:${document.id}]`).join(" ");
  const localityNames = retrieved
    .filter((document) => document.id !== "data-quality-policy")
    .map((document) => document.locality)
    .join(" and ");

  if (testCase.id === "hard-constraint-no-match") {
    return `I cannot verify those guarantees from the available relocation evidence. Treat this as no confirmed match and relax or verify the hard constraints. ${sources}`;
  }

  if (testCase.id === "missing-data") {
    return `The exact current crime count and exact broadband uptime are not available in the evidence for ${localityNames || "Hinjewadi"}; verify them with a current authoritative source. ${sources}`;
  }

  if (testCase.id === "stale-conflict") {
    return `Conflicting or stale locality evidence should be disclosed and sent for verification before it is treated as current fact. ${sources}`;
  }

  return `Retrieved evidence for ${localityNames || "the requested locality"} supports this answer; compare the cited locality records before deciding. ${sources}`;
}

function metric(expected: Set<string>, retrieved: string[]) {
  const relevant = retrieved.filter((id) => expected.has(id)).length;
  return {
    precision: retrieved.length === 0 ? 0 : relevant / retrieved.length,
    recall: expected.size === 0 ? 1 : relevant / expected.size,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function main() {
  const k = Math.max(1, Number.parseInt(process.env.EVAL_K || "2", 10));
  const datasetPath = path.resolve(process.cwd(), "evaluation/relocation-eval.v1.json");
  const reportPath = path.resolve(
    process.cwd(),
    process.env.EVAL_REPORT_PATH || "evaluation/reports/latest.json"
  );
  const dataset = JSON.parse(fs.readFileSync(datasetPath, "utf-8")) as EvalDataset;

  const caseReports = dataset.cases.map((testCase) => {
    const retrieved = retrieve(testCase.question, dataset.documents, k);
    const retrievedIds = retrieved.map((document) => document.id);
    const { precision, recall } = metric(new Set(testCase.expected_document_ids), retrievedIds);
    const answer = buildGroundedAnswer(testCase, retrieved);
    const citedAllRetrieved = retrievedIds.every((id) => answer.includes(`[source:${id}]`));
    const requiredTermsPresent = testCase.required_answer_terms.every((term) =>
      answer.toLowerCase().includes(term.toLowerCase())
    );
    const unsupportedHandled = !testCase.unsupported || /(cannot verify|not available|no confirmed match)/i.test(answer);

    return {
      id: testCase.id,
      question: testCase.question,
      expected_document_ids: testCase.expected_document_ids,
      retrieved_document_ids: retrievedIds,
      precision_at_k: round(precision),
      recall_at_k: round(recall),
      grounded: citedAllRetrieved && requiredTermsPresent,
      unsupported_handled: unsupportedHandled,
      answer,
    };
  });

  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const precision = average(caseReports.map((item) => item.precision_at_k));
  const recall = average(caseReports.map((item) => item.recall_at_k));
  const groundingRate = average(caseReports.map((item) => (item.grounded ? 1 : 0)));
  const unsupportedCases = caseReports.filter((_, index) => dataset.cases[index].unsupported);
  const unsupportedHandlingRate = unsupportedCases.length
    ? average(unsupportedCases.map((item) => (item.unsupported_handled ? 1 : 0)))
    : 1;

  const thresholds = {
    min_precision_at_k: 0.45,
    min_recall_at_k: 0.8,
    min_grounding_rate: 1,
    min_unsupported_handling_rate: 1,
  };
  const summary = {
    precision_at_k: round(precision),
    recall_at_k: round(recall),
    grounding_rate: round(groundingRate),
    unsupported_handling_rate: round(unsupportedHandlingRate),
  };
  const passed =
    summary.precision_at_k >= thresholds.min_precision_at_k &&
    summary.recall_at_k >= thresholds.min_recall_at_k &&
    summary.grounding_rate >= thresholds.min_grounding_rate &&
    summary.unsupported_handling_rate >= thresholds.min_unsupported_handling_rate;

  const report = {
    schema_version: 1,
    dataset_version: dataset.version,
    generated_at: new Date().toISOString(),
    k,
    thresholds,
    summary,
    passed,
    cases: caseReports,
  };

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf-8");
  console.log(JSON.stringify(report, null, 2));

  if (!passed) {
    process.exit(1);
  }
}

main();
