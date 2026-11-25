import { BlockIcon, CheckCircleIcon, ClockIcon, FlagIcon } from "@/components/icons";
import { STATUS_LABEL, type PatientStatus } from "@/lib/patients";

const STYLE: Record<PatientStatus, string> = {
  active: "bg-verde-claro text-verde-oscuro",
  invited: "bg-amarillo text-[#5e3f00]",
  discharged: "bg-violeta text-violeta-texto",
  blocked: "bg-[#e9ecea] text-[#44524d]",
};

const ICON: Record<PatientStatus, (p: { size?: number }) => React.JSX.Element> = {
  active: CheckCircleIcon,
  invited: ClockIcon,
  discharged: FlagIcon,
  blocked: BlockIcon,
};

export function StatusBadge({ status }: { status: PatientStatus }) {
  const Icon = ICON[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold ${STYLE[status]}`}>
      <Icon size={15} />
      {STATUS_LABEL[status]}
    </span>
  );
}
