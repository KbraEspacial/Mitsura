import { google } from "googleapis";

export function createCalendarClient(accessToken: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function createCalendarEvent(
  accessToken: string,
  task: { id: string; title: string; description?: string | null; dueDate: Date },
) {
  const calendar = createCalendarClient(accessToken);
  const dateStr = task.dueDate.toISOString().split("T")[0];
  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: task.title,
      description: task.description ?? "",
      start: { date: dateStr },
      end: { date: dateStr },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "popup", minutes: 30 },
        ],
      },
    },
  });
  return event.data.id;
}

export async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  task: { title: string; description?: string | null; dueDate: Date },
) {
  const calendar = createCalendarClient(accessToken);
  const dateStr = task.dueDate.toISOString().split("T")[0];
  await calendar.events.update({
    calendarId: "primary",
    eventId,
    requestBody: {
      summary: task.title,
      description: task.description ?? "",
      start: { date: dateStr },
      end: { date: dateStr },
    },
  });
}

export async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const calendar = createCalendarClient(accessToken);
  await calendar.events.delete({
    calendarId: "primary",
    eventId,
  });
}
