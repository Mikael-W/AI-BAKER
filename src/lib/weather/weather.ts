const LATITUDE = 43.61;
const LONGITUDE = 3.88;

export type Meteo = {
  date: string;
  temperatureMax: number | null;
  precipitationMm: number | null;
  resume: string;
};

function resumeMeteo(
  temperatureMax: number | null,
  precipitationMm: number | null,
): string {
  if ((precipitationMm ?? 0) >= 5) return "pluvieux";
  if ((precipitationMm ?? 0) >= 1) return "quelques averses";
  if ((temperatureMax ?? 0) >= 28) return "chaud et ensoleillé";
  return "temps clément";
}

export async function getMeteo(date: string): Promise<Meteo | null> {
  const baseUrl = process.env.OPENMETEO_API_URL;
  if (!baseUrl) return null;

  const url =
    `${baseUrl}?latitude=${LATITUDE}` +
    `&longitude=${LONGITUDE}&daily=temperature_2m_max,precipitation_sum` +
    `&timezone=Europe%2FParis&start_date=${date}&end_date=${date}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = (await response.json()) as {
      daily?: {
        time?: string[];
        temperature_2m_max?: (number | null)[];
        precipitation_sum?: (number | null)[];
      };
    };

    const index = data.daily?.time?.indexOf(date) ?? -1;
    if (index < 0) return null;

    const temperatureMax = data.daily?.temperature_2m_max?.[index] ?? null;
    const precipitationMm = data.daily?.precipitation_sum?.[index] ?? null;

    return {
      date,
      temperatureMax,
      precipitationMm,
      resume: resumeMeteo(temperatureMax, precipitationMm),
    };
  } catch {
    return null;
  }
}
