'use client';

import { monthGridDays, sameDay, startOfMonth } from '@/lib/agenda-dates';
import type { AgendaAppointment, AgendaPatient, AgendaService } from './appointment-modal';

type Props = {
  anchor: Date;
  appointments: AgendaAppointment[];
  patients: Record<string, AgendaPatient>;
  services: Record<string, AgendaService>;
  onDayClick: (at: Date) => void;
  onEventClick: (appointment: AgendaAppointment) => void;
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function MonthCalendar({
  anchor,
  appointments,
  patients,
  services,
  onDayClick,
  onEventClick,
}: Props) {
  const days = monthGridDays(anchor);
  const month = startOfMonth(anchor).getMonth();
  const today = new Date();

  function eventsFor(day: Date) {
    return appointments
      .filter((a) => sameDay(new Date(a.scheduledAt), day))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-white/50">
        {WEEKDAYS.map((label) => (
          <div
            key={label}
            className="border-r border-line px-2 py-2 text-center text-xs font-semibold text-muted last:border-r-0"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const inMonth = day.getMonth() === month;
          const dayEvents = eventsFor(day);
          const isToday = sameDay(day, today);
          const defaultAt = new Date(day);
          defaultAt.setHours(9, 0, 0, 0);

          return (
            <button
              key={day.toISOString()}
              type="button"
              className={`min-h-28 border-b border-r border-line p-1.5 text-left align-top transition last:border-r-0 hover:bg-mist-deep/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-botanical/40 ${
                inMonth ? 'bg-transparent' : 'bg-mist/40'
              } ${isToday ? 'bg-botanical/6' : ''}`}
              onClick={() => onDayClick(defaultAt)}
              aria-label={`Día ${day.toLocaleDateString('es-VE')}`}
            >
              <span
                className={`tabular inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday
                    ? 'bg-botanical text-white'
                    : inMonth
                      ? 'text-botanical'
                      : 'text-muted'
                }`}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map((event) => {
                  const patient = patients[event.patientId];
                  const service = services[event.items[0]?.serviceId ?? ''];
                  return (
                    <span
                      key={event.id}
                      role="button"
                      tabIndex={0}
                      className="block truncate rounded-md bg-botanical/90 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-botanical-deep"
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
                      {patient?.firstName ?? 'Cita'}
                      {service ? ` · ${service.name}` : ''}
                    </span>
                  );
                })}
                {dayEvents.length > 3 ? (
                  <p className="text-[10px] font-semibold text-muted">
                    +{dayEvents.length - 3} más
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
