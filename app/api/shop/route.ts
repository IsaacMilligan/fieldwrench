import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  acceptBookingAction,
  addDiscountPresetAction,
  addJobDiscountAction,
  addCatalogItemAction,
  addLaborAction,
  updateLaborAction,
  addMileageAction,
  addOilPartAction,
  addPartAction,
  applyJobTemplateAction,
  updatePartAction,
  addReceiptAction,
  applyVinAction,
  createCustomerAction,
  createJobAction,
  createVehicleAction,
  deleteDiscountPresetAction,
  deleteJobDiscountAction,
  deleteCatalogItemAction,
  deleteLaborAction,
  deletePartAction,
  deleteJobAction,
  dismissBookingAction,
  logoutAction,
  markInvoicePaidAction,
  markInvoiceUnpaidAction,
  openInvoiceAction,
  resetDemoAction,
  restoreBookingAction,
  saveOilSpecAction,
  saveShopSpecAction,
  saveSettingsAction,
  saveThemeAction,
  setJobStatusAction,
  updateDiscountPresetAction,
  updateCatalogItemAction,
  updateCustomerAction,
  deleteCustomerAction,
  updateJobAction,
  updateVehicleAction,
  uploadPhotoAction,
  deletePhotoAction,
  updateJobTemplateAction,
  archiveJobTemplateAction,
  reorderJobTemplateAction,
  addJobTemplateLineAction,
  deleteJobTemplateLineAction,
} from "@/lib/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS: Record<string, (form: FormData) => Promise<unknown>> = {
  logout: () => logoutAction(),
  save_settings: saveSettingsAction,
  add_discount_preset: addDiscountPresetAction,
  update_discount_preset: updateDiscountPresetAction,
  delete_discount_preset: deleteDiscountPresetAction,
  add_job_discount: addJobDiscountAction,
  delete_job_discount: deleteJobDiscountAction,
  add_catalog_item: addCatalogItemAction,
  update_catalog_item: updateCatalogItemAction,
  delete_catalog_item: deleteCatalogItemAction,
  save_theme: saveThemeAction,
  reset_demo: resetDemoAction,
  create_customer: createCustomerAction,
  update_customer: updateCustomerAction,
  delete_customer: deleteCustomerAction,
  create_vehicle: createVehicleAction,
  update_vehicle: updateVehicleAction,
  apply_vin: applyVinAction,
  save_oil_spec: saveOilSpecAction,
  save_shop_spec: saveShopSpecAction,
  create_job: createJobAction,
  apply_job_template: applyJobTemplateAction,
  update_job_template: updateJobTemplateAction,
  archive_job_template: archiveJobTemplateAction,
  reorder_job_template: reorderJobTemplateAction,
  add_job_template_line: addJobTemplateLineAction,
  delete_job_template_line: deleteJobTemplateLineAction,
  update_job: updateJobAction,
  set_status: setJobStatusAction,
  delete_job: deleteJobAction,
  add_labor: addLaborAction,
  update_labor: updateLaborAction,
  delete_labor: deleteLaborAction,
  add_part: addPartAction,
  update_part: updatePartAction,
  add_oil_part: addOilPartAction,
  delete_part: deletePartAction,
  upload_photo: uploadPhotoAction,
  delete_photo: deletePhotoAction,
  mark_paid: markInvoicePaidAction,
  mark_unpaid: markInvoiceUnpaidAction,
  open_invoice: openInvoiceAction,
  add_receipt: addReceiptAction,
  add_mileage: addMileageAction,
  dismiss_booking: dismissBookingAction,
  restore_booking: restoreBookingAction,
  accept_booking: acceptBookingAction,
};

const LINE_SECTION: Record<string, string> = {
  add_part: "parts",
  update_part: "parts",
  delete_part: "parts",
  add_oil_part: "parts",
  add_labor: "labor",
  update_labor: "labor",
  delete_labor: "labor",
  add_job_discount: "discounts",
  delete_job_discount: "discounts",
  upload_photo: "photos",
  delete_photo: "photos",
};

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const form = await req.formData();
  const op = String(form.get("_op") ?? "");
  const ajax = req.headers.get("x-fw-ajax") === "1";
  if (op !== "logout") {
    const s = await readSession();
    if (!s) return NextResponse.redirect(new URL("/login", origin), 303);
  }
  const fn = OPS[op];
  if (!fn) return NextResponse.redirect(new URL("/", origin), 303);
  try {
    await fn(form);
  } catch (e) {
    const digest = e && typeof e === "object" && "digest" in e ? String((e as { digest?: string }).digest) : "";
    if (digest.includes("NEXT_REDIRECT")) {
      if (ajax && LINE_SECTION[op]) return NextResponse.json({ ok: true });
      throw e;
    }
    console.error("shop op", op, e);
    if (op === "upload_photo") {
      const jobId = String(form.get("job_id") ?? "");
      const msg = e instanceof Error ? e.message.slice(0, 180) : "Could not save photo.";
      if (ajax) return NextResponse.json({ ok: false, error: msg }, { status: 400 });
      const u = new URL(jobId ? `/jobs/${jobId}` : "/", origin);
      u.searchParams.set("e", "photo");
      u.searchParams.set("msg", msg);
      u.hash = "photos";
      return NextResponse.redirect(u, 303);
    }
    if (op === "delete_customer") {
      const msg = e instanceof Error ? e.message.slice(0, 160) : "Could not delete this customer.";
      return NextResponse.redirect(new URL(`/customers?e=${encodeURIComponent(msg)}`, origin), 303);
    }
  }
  if (ajax && LINE_SECTION[op]) return NextResponse.json({ ok: true });
  const back = req.headers.get("referer") || `${origin}/`;
  const section = LINE_SECTION[op];
  if (section) {
    try {
      const url = new URL(back);
      url.hash = section;
      return NextResponse.redirect(url, 303);
    } catch {
      /* fall through */
    }
  }
  return NextResponse.redirect(back, 303);
}
