import { STATUS_LABEL, type PatientStatus } from "@/lib/patients";

const STYLE: Record<PatientStatus, string> = {
  active: "bg-verde-claro text-verde-oscuro",
  invited: "bg-amarillo text-[#5e3f00]",
  inactive: "bg-[#e9ecea] text-[#44524d]",
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
