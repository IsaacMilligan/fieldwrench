import { NextRequest, NextResponse } from "next/server";
import { readSession } from "@/lib/auth";
import {
  acceptBookingAction,
  addDiscountPresetAction,
  addJobDiscountAction,
  addLaborAction,
  addMileageAction,
  addPartAction,
  addReceiptAction,
  applyVinAction,
  createCustomerAction,
  createJobAction,
  createVehicleAction,
  deleteDiscountPresetAction,
  deleteJobDiscountAction,
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
  updateCustomerAction,
  deleteCustomerAction,
  updateJobAction,
  updateVehicleAction,
  uploadPhotoAction,
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
  update_job: updateJobAction,
  set_status: setJobStatusAction,
  delete_job: deleteJobAction,
  add_labor: addLaborAction,
  delete_labor: deleteLaborAction,
  add_part: addPartAction,
  delete_part: deletePartAction,
  upload_photo: uploadPhotoAction,
  mark_paid: markInvoicePaidAction,
  mark_unpaid: markInvoiceUnpaidAction,
  open_invoice: openInvoiceAction,
  add_receipt: addReceiptAction,
  add_mileage: addMileageAction,
  dismiss_booking: dismissBookingAction,
  restore_booking: restoreBookingAction,
  accept_booking: acceptBookingAction,
};

export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const form = await req.formData();
  const op = String(form.get("_op") ?? "");
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
    if (digest.includes("NEXT_REDIRECT")) throw e;
    console.error("shop op", op, e);
    if (op === "delete_customer") {
      const msg = e instanceof Error ? e.message.slice(0, 160) : "Could not delete this customer.";
      return NextResponse.redirect(new URL(`/customers?e=${encodeURIComponent(msg)}`, origin), 303);
    }
  }
  const back = req.headers.get("referer") || `${origin}/`;
  return NextResponse.redirect(back, 303);
}
