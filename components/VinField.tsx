"use client";

import { useState } from "react";
import { ScanVinButton } from "@/components/ScanVinButton";

export function VinField({
  name = "vin",
  defaultValue = "",
}: {
  name?: string;
  defaultValue?: string;
}) {
  const [vin, setVin] = useState(defaultValue);
  return (
    <>
      <input
        className="field font-mono uppercase"
        name={name}
        value={vin}
        maxLength={17}
        onChange={(e) => setVin(e.target.value.toUpperCase())}
        placeholder="1FTFW1E59JFA12345"
      />
      <ScanVinButton onVin={setVin} />
    </>
  );
}
