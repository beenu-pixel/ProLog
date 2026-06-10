import { describe, expect, it } from "vitest";

import {
  METRICS,
  METRIC_BY_KEY,
  averageMetric,
  metricLevelLabel,
} from "@/lib/metrics";
import type { Entry, MetricKey, Scale } from "@/lib/types";

function entry(partial: Partial<Entry>): Entry {
  return {
    id: "x",
    title: "t",
    content: "",
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe("rejestr METRICS", () => {
  it("ma 5 metryk o unikalnych kluczach", () => {
    expect(METRICS).toHaveLength(5);
    const keys = new Set(METRICS.map((m) => m.key));
    expect(keys.size).toBe(5);
  });

  it("każda metryka ma 5 etykiet poziomów", () => {
    for (const metric of METRICS) {
      expect(metric.levels).toHaveLength(5);
      for (const label of metric.levels) {
        expect(label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("METRIC_BY_KEY odwzorowuje każdą metrykę", () => {
    for (const metric of METRICS) {
      expect(METRIC_BY_KEY[metric.key]).toBe(metric);
    }
  });

  it("stres jest oznaczony jako odwrotny", () => {
    expect(METRIC_BY_KEY.stress.inverted).toBe(true);
  });

  it("metricLevelLabel zwraca słowo poziomu", () => {
    expect(metricLevelLabel("mood", 5 as Scale)).toBe("Bardzo dobrze");
    expect(metricLevelLabel("mood", 1 as Scale)).toBe("Bardzo źle");
  });
});

describe("averageMetric", () => {
  const key: MetricKey = "mood";

  it("zwraca null dla pustej listy", () => {
    expect(averageMetric([], key)).toBeNull();
  });

  it("zwraca null, gdy żaden wpis nie ma metryki", () => {
    expect(averageMetric([entry({}), entry({})], key)).toBeNull();
  });

  it("uśrednia tylko obecne wartości (pomija braki)", () => {
    const entries = [
      entry({ mood: 4 }),
      entry({ mood: 2 }),
      entry({}), // bez mood — pomijane
    ];
    expect(averageMetric(entries, key)).toBe(3);
  });
});
