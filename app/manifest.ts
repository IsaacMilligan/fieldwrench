import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FieldWrench",
    short_name: "FieldWrench",
    description: "Driveway shop book — jobs, invoices, profit, VIN, DTC.",
    start_url: "/",
    display: "standalone",
    background_color: "#0F1B2D",
    theme_color: "#0F1B2D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
