import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mentionsBuilding, zoneName } from "./spot-name.ts";

describe("zoneName", () => {
  it("strips an exact building prefix", () => {
    assert.equal(zoneName("Chemistry — Upper Levels", "Chemistry"), "Upper Levels");
    assert.equal(
      zoneName("University Center — Food Court Seating", "University Center"),
      "Food Court Seating",
    );
  });

  it("strips a prefix that punctuates the building differently", () => {
    // The case that forced the fuzzy match: "(Library)" vs " Library".
    assert.equal(
      zoneName("AOK (Library) — 2nd Floor Study Area", "AOK Library"),
      "2nd Floor Study Area",
    );
  });

  it("strips a prefix that abbreviates the building", () => {
    assert.equal(zoneName("AOK — Atrium (24h)", "AOK Library"), "Atrium (24h)");
  });

  it("strips a prefix spelled out more fully than the building column", () => {
    assert.equal(
      zoneName("Math & Psychology — Base Floor", "Math & Psych"),
      "Base Floor",
    );
  });

  it("keeps hyphenated venue names intact", () => {
    assert.equal(zoneName("Chick-fil-A", "University Center"), "Chick-fil-A");
    assert.equal(zoneName("Blends and Bowls", "Commons"), "Blends and Bowls");
  });

  it("does not treat a bare hyphen as a building separator", () => {
    // This is the case that actually pins SEPARATOR, and the two assertions
    // above are NOT it — they pass even with a bare hyphen in the character
    // class, because the building check rejects "Chick" ≠ "University Center"
    // and saves the name for an unrelated reason. Verified by breaking
    // SEPARATOR deliberately and watching them stay green (§Phase 6: a check
    // that has never been observed to fail is not yet a check).
    //
    // Here the head DOES match the building, so only the separator stands
    // between a hyphenated name and a mangled one.
    assert.equal(
      zoneName("Commons-Adjacent Cafe", "Commons"),
      "Commons-Adjacent Cafe",
      "a hyphen with no surrounding spaces is part of the name",
    );
    assert.equal(
      zoneName("ITE-Annex Reading Room", "ITE"),
      "ITE-Annex Reading Room",
    );
  });

  it("keeps dashes that are part of the zone, not a building separator", () => {
    assert.equal(
      zoneName("ITE — 2nd–4th Floor", "ITE"),
      "2nd–4th Floor",
      "only the FIRST separator splits; the en dash inside the range survives",
    );
    assert.equal(
      zoneName("AOK (Library) — 3rd/4th Floor (Quiet)", "AOK Library"),
      "3rd/4th Floor (Quiet)",
    );
  });

  it("leaves the name alone when the head is not the building", () => {
    // A food spot that happens to carry a dash must not lose its first half.
    assert.equal(
      zoneName("Halal Shack — Commons", "University Center"),
      "Halal Shack — Commons",
    );
  });

  it("leaves the name alone when there is no tail", () => {
    assert.equal(zoneName("Commons — ", "Commons"), "Commons — ");
  });

  it("keeps the building as the title for a whole-building zone", () => {
    // "Building-wide" alone titles a row with a shape instead of a place.
    assert.equal(
      zoneName("Administration — Building-wide", "Administration"),
      "Administration",
    );
    assert.equal(
      zoneName("Fine Arts — Building-wide", "Fine Arts"),
      "Fine Arts",
    );
  });
});

describe("mentionsBuilding", () => {
  it("is true when the title already carries the building", () => {
    assert.equal(mentionsBuilding("Administration", "Administration"), true);
    assert.equal(
      mentionsBuilding("AOK (Library) — 2nd Floor Study Area", "AOK Library"),
      true,
      "a Best bet keeping its full name must not repeat the building below",
    );
  });

  it("is false for a stripped zone title", () => {
    assert.equal(mentionsBuilding("2nd Floor Study Area", "AOK Library"), false);
    assert.equal(mentionsBuilding("Upper Levels", "Chemistry"), false);
  });

  it("is false for a venue that merely sits in the building", () => {
    assert.equal(mentionsBuilding("Chick-fil-A", "University Center"), false);
  });
});
