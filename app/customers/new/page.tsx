import { Shell } from "@/components/Shell";
import { requireSession } from "@/lib/auth";
import { createCustomerAction } from "@/lib/actions";

export default async function NewCustomerPage() {
  await requireSession();
  return (
    <Shell title="New customer">
      <form action={createCustomerAction}>
        <label className="lbl">Name</label>
        <input className="field" name="name" required />
        <label className="lbl">Phone</label>
        <input className="field" name="phone" type="tel" />
        <label className="lbl">Email</label>
        <input className="field" name="email" type="email" />
        <label className="lbl">Address</label>
        <input className="field" name="address" />
        <label className="lbl">Notes</label>
        <textarea className="field min-h-24" name="notes" />
        <button className="tap mt-6" type="submit">
          Save customer
        </button>
      </form>
    </Shell>
  );
}
