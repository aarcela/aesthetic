'use client';

import {
  CLINIC_HOURS,
  addDays,
  hourLabel,
  sameDay,
  startOfWeek,
} from '@/lib/agenda-dates';
import type { AgendaAppointment, AgendaPatient, AgendaService } from './appointment-modal';

type Props = {
  anchor: Date;
  appointments: AgendaAppointment[];
  patients: Record<string, AgendaPatient>;
  services: Record<string, AgendaService>;
  onSlotClick: (at: Date) => void;
  onEventClick: (appointment: AgendaAppointment) => void;
};

export function WeekCalendar({
  anchor,
  appointments,
  patients,
  services,
  onSlotClick,
  onEventClick,
}: Props) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  function eventsFor(day: Date, hour: number) {
    return appointments.filter((a) => {
      const at = new Date(a.scheduledAt);
      return sameDay(at, day) && at.getHours() === hour;
    });
  }

  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-white/50">
        <div className="border-r border-line" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`border-r border-line px-1 py-3 text-center last:border-r-0 ${
              sameDay(day, today) ? 'bg-botanical/8' : ''
            }`}
          >
            <p className="text-xs font-semibold text-muted">
              {day.toLocaleDateString('es-VE', { weekday: 'short' })}
            </p>
            <p
              className={`tabular text-lg font-semibold ${
                sameDay(day, today) ? 'text-botanical' : 'text-ink'
              }`}
            >
              {day.getDate()}
            </p>
          </div>
        ))}
      </div>

      <div className="max-h-[min(70vh,720px)] overflow-auto">
        {CLINIC_HOURS.map((hour) => (
          <div
            key={hour}
            className="grid min-h-16 grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line last:border-b-0"
          >
            <div className="border-r border-line px-1 py-2 text-right text-xs tabular text-muted">
              {hourLabel(hour)}
            </div>
            {days.map((day) => {
              const slotEvents = eventsFor(day, hour);
              const slotAt = new Date(day);
              slotAt.setHours(hour, 0, 0, 0);
              return (
                <button
                  key={`${day.toISOString()}-${hour}`}
                  type="button"
                  className="group relative min-h-16 border-r border-line p-1 text-left last:border-r-0 hover:bg-mist-deep/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-botanical/40"
                  onClick={() => {
                    if (slotEvents.length === 0) onSlotClick(slotAt);
                  }}
                  aria-label={`Hueco ${hourLabel(hour)} ${day.toLocaleDateString('es-VE')}`}
                >
                  <div className="flex flex-col gap-1">
                    {slotEvents.map((event) => {
                      const patient = patients[event.patientId];
                      const service = services[event.items[0]?.serviceId ?? ''];
                      return (
                        <span
                          key={event.id}
                          role="button"
                          tabIndex={0}
                          className="block truncate rounded-lg bg-botanical px-1.5 py-1 text-[11px] font-semibold leading-tight text-white shadow-sm transition hover:bg-botanical-deep"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              onEventClick(event);
                            }
                          }}
                        >
                          {new Date(event.scheduledAt).toLocaleTimeString('es-VE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {patient ? `${patient.firstName}` : 'Cita'}
                          {service ? ` · ${service.name}` : ''}
                        </span>
                      );
                    })}
                  </div>
                  {slotEvents.length === 0 ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-botanical/0 transition group-hover:text-botanical/45">
                      +
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
