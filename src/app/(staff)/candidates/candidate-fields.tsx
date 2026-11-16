import { EXPERIENCE_LEVELS } from "@/db/schema";
import { EXPERIENCE_LABELS } from "@/lib/labels";

type Candidate = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  experienceLevel: string;
  yearsExperience: number | null;
  currentCompany: string | null;
  position: string | null;
  notes: string | null;
};

export function CandidateFields({ candidate, disabled }: { candidate?: Candidate; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" required className="input" defaultValue={candidate?.firstName} />
      </div>
      <div>
        <label className="label" htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" required className="input" defaultValue={candidate?.lastName} />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required className="input" defaultValue={candidate?.email} />
      </div>
      <div>
        <label className="label" htmlFor="phone">Phone</label>
        <input id="phone" name="phone" className="input" defaultValue={candidate?.phone ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="position">Position applied for</label>
        <input id="position" name="position" className="input" placeholder="e.g. Structural Engineer I" defaultValue={candidate?.position ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="experienceLevel">Experience level</label>
        <select id="experienceLevel" name="experienceLevel" className="input" defaultValue={candidate?.experienceLevel ?? "entry"}>
          {EXPERIENCE_LEVELS.map((l) => (
            <option key={l} value={l}>{EXPERIENCE_LABELS[l]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="yearsExperience">Years of experience</label>
        <input id="yearsExperience" name="yearsExperience" type="number" min={0} max={60} className="input" defaultValue={candidate?.yearsExperience ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="currentCompany">Current company</label>
        <input id="currentCompany" name="currentCompany" className="input" defaultValue={candidate?.currentCompany ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} className="input" defaultValue={candidate?.notes ?? ""} />
      </div>
    </fieldset>
  );
}
