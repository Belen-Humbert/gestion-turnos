-- Dos eventos no cancelados no pueden superponerse. El rango es [inicio, fin): uno puede
-- terminar a la misma hora en que empieza el siguiente.
ALTER TABLE "events"
  ADD CONSTRAINT "events_no_overlap"
  EXCLUDE USING gist (tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("cancelled_at" IS NULL);
