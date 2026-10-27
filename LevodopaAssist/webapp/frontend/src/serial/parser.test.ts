import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyLine } from "./parser";

test("línea vacía", () => {
  assert.deepEqual(classifyLine(""), { type: "EMPTY" });
  assert.deepEqual(classifyLine("   "), { type: "EMPTY" });
});

test("muestra cruda", () => {
  assert.deepEqual(classifyLine("512"), { type: "RAW_SAMPLE", value: 512 });
  assert.deepEqual(classifyLine("-3"), { type: "RAW_SAMPLE", value: -3 });
});

test("detalle de contracción", () => {
  assert.deepEqual(classifyLine(",620,180"), {
    type: "CONTRACTION_DETAIL",
    amplitude: 620,
    durationMs: 180,
  });
});

test("línea resumen (formato real del firmware)", () => {
  const line = ",,,3,10023,17.9,650,600,410,190,850,480";
  const parsed = classifyLine(line);
  assert.equal(parsed.type, "SUMMARY");
  if (parsed.type === "SUMMARY") {
    assert.deepEqual(parsed.fields, {
      conNum: 3,
      timerMedicionMs: 10023,
      conXMinuto: 17.9,
      peakMax: 650,
      promedioPeaks: 600,
      yyn: 410,
      promedioLthMs: 190,
      promedioBtwMs: 850,
      thresh: 480,
    });
  }
});

test("resumen con con_num=0 (sin contracciones detectadas)", () => {
  const line = ",,,0,10011,0,0,0,405,0,0,470";
  const parsed = classifyLine(line);
  assert.equal(parsed.type, "SUMMARY");
});

test("basura de bootloader tras reset no rompe el parser", () => {
  assert.deepEqual(classifyLine("ets Jul 29 2019 12:21:46"), {
    type: "UNKNOWN",
    raw: "ets Jul 29 2019 12:21:46",
  });
  assert.deepEqual(classifyLine("rst:0x1 (POWERON_RESET),boot:0x13"), {
    type: "UNKNOWN",
    raw: "rst:0x1 (POWERON_RESET),boot:0x13",
  });
});

test("no confunde detalle de contracción con resumen", () => {
  assert.equal(classifyLine(",620,180").type, "CONTRACTION_DETAIL");
  assert.equal(classifyLine(",,,1,10000,6,500,500,400,100,900,450").type, "SUMMARY");
});
