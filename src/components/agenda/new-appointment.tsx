"use client";

import { useState } from "react";
import { EventForm, type EventDefaults } from "./event-form";
import { PendingPaymentNotice, type PendingTurno } from "./pending-payment-notice";

// Formulario de cita nueva. Al elegir un paciente avisa si tiene turnos anteriores sin pagar.
export function NewAppointment({
  defaults,
  patients,
  pending,
}: {
  defaults: EventDefaults;
  patients: { id: string; name: string }[];
  pending: Record<string, PendingTurno[]>;
}) {
  const [patientId, setPatientId] = useState(defaults.patientId ?? "");
  const patient = patients.find((p) => p.id === patientId);
  return (
    <>
      {patient ? <PendingPaymentNotice name={patient.name.split(" ")[0]} turnos={pending[patient.id] ?? []} /> : null}
      <EventForm defaults={defaults} patients={patients} onPatientChange={setPatientId} />
    </>
  );
}
