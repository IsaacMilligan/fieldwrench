import { oilBaseModel, oilYmmeKey, pickVerifiedOilRow, type OilPickRow } from "../lib/oil-specs";

type Row = OilPickRow & { id: string };
function row(id: string, model: string, engine: string, vis: string, qt: number, tq: number): Row {
  const k = oilYmmeKey(2000, "x", model, engine)!;
  return { id, model_key: k.model_key, engine_key: k.engine_key, engine_label: engine, oil_viscosity: vis, oil_qt: qt, oil_drain_tq: tq };
}

let failed = 0;
function check(name: string, got: string | null, want: string | null) {
  if (got !== want) {
    console.error(`FAIL ${name}: got ${got} want ${want}`);
    failed++;
  } else console.log(`ok   ${name}`);
}
const pick = (rows: Row[], year: number, make: string, model: string, engine: string) => {
  const p = pickVerifiedOilRow(rows, { year, make, model, engine });
  return p ? `${p.row.id}:${p.match}` : null;
};

// Rows in SQL order (ORDER BY engine_key, id): "1.8li4" before "1.8ll4".
const corolla = [
  row("c-i4", "Corolla", "1.8L I4", "0W-16", 4.4, 27),
  row("c-l4", "Corolla", "1.8L L4", "0W-16", 4.4, 27),
];
check("Corolla Hybrid 1.8L hits", pick(corolla, 2021, "Toyota", "Corolla Hybrid", "1.8L"), "c-i4:displacement");
check("corolla hybrid (lowercase) 1.8L hits", pick(corolla, 2021, "TOYOTA", "corolla hybrid", "1.8L"), "c-i4:displacement");
check("Corolla 1.8L hits", pick(corolla, 2021, "TOYOTA", "Corolla", "1.8L"), "c-i4:displacement");
check("Corolla Hybrid 1.8L L4 exact via base", pick(corolla, 2021, "Toyota", "Corolla Hybrid", "1.8L L4"), "c-l4:exact");
check("Corolla 2.0L misses", pick(corolla, 2021, "Toyota", "Corolla", "2.0L"), null);
check("Corolla blank engine misses", pick(corolla, 2021, "Toyota", "Corolla Hybrid", ""), null);

const exactWins = [...corolla, row("ch", "Corolla Hybrid", "1.8L", "0W-8", 4.5, 30)];
check("exact model wins over base", pick(exactWins, 2021, "Toyota", "Corolla Hybrid", "1.8L"), "ch:exact");

const disagree = [
  row("a", "Corolla", "1.8L L4", "0W-16", 4.4, 27),
  row("b", "Corolla", "1.8L I4", "0W-20", 4.4, 27),
];
check("two 1.8L rows, different specs → blank", pick(disagree, 2021, "Toyota", "Corolla Hybrid", "1.8L"), null);
check("two 1.8L rows, different qt → blank", pick([corolla[0], row("q", "Corolla", "1.8L I4", "0W-16", 4.6, 27)], 2021, "Toyota", "Corolla", "1.8L"), null);

const dakota = [row("d", "Dakota", "3.7L V6", "5W-30", 5, 25)];
check("Dakota 3.7L hits", pick(dakota, 2005, "Dodge", "Dakota", "3.7L"), "d:displacement");
check("Dakota 3.7L V6 hits", pick(dakota, 2005, "DODGE", "Dakota", "3.7L V6"), "d:exact");
check("Dakota 4.7L misses", pick(dakota, 2005, "Dodge", "Dakota", "4.7L"), null);
check("Dakota blank engine misses", pick(dakota, 2005, "Dodge", "Dakota", ""), null);

check("base: Corolla Hybrid", oilBaseModel("Corolla Hybrid"), "Corolla");
check("base: RAV4 Plug-in Hybrid", oilBaseModel("RAV4 Plug-in Hybrid"), "RAV4");
check("base: Sienna Hybrid AWD", oilBaseModel("Sienna Hybrid AWD"), "Sienna");
check("base: Camry unchanged", oilBaseModel("Camry"), "Camry");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("oil lookup ok");
