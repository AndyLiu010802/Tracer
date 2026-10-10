'use strict';

// Only this fixed provider is contacted. Coordinates are rounded to city-scale
// precision and cached in memory; location is never added to workspace saves.
const TTL = 10 * 60 * 1000;
function createWeatherService({ fetch: fetcher = globalThis.fetch, now = Date.now } = {}) {
  const cache = new Map();
  return async function weather(latitude, longitude) {
    if (latitude === null || longitude === null || String(latitude).trim() === '' || String(longitude).trim() === '') throw Object.assign(new Error('invalid-location'), {status: 400});
    const lat = Number(latitude), lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw Object.assign(new Error('invalid-location'), {status: 400});
    const key = lat.toFixed(2) + ',' + lon.toFixed(2), existing = cache.get(key);
    if (existing && now() - existing.at < TTL) return existing.promise;
    const promise = (async () => {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({latitude: lat.toFixed(2), longitude: lon.toFixed(2), current: 'temperature_2m,weather_code,is_day', daily: 'sunrise,sunset', timezone: 'auto', timeformat: 'unixtime', forecast_days: '2'}).toString();
      const response = await fetcher(url, {signal: AbortSignal.timeout(10000), redirect: 'error'});
      if (!response.ok) throw new Error('weather-unavailable');
      const data = await response.json(), c = data.current, d = data.daily;
      if (!c || !Number.isInteger(c.weather_code) || !Number.isFinite(c.temperature_2m) || !Number.isFinite(c.time) || ![0, 1].includes(c.is_day) || typeof data.timezone !== 'string' || !d || !Array.isArray(d.sunrise) || !Array.isArray(d.sunset)) throw new Error('weather-unavailable');
      new Intl.DateTimeFormat('en', {timeZone: data.timezone});
      // Reject old provider observations, rather than presenting them as live.
      if (Math.abs(now() - c.time * 1000) > 90 * 60 * 1000) throw new Error('weather-stale');
      return {code: c.weather_code, temperature: c.temperature_2m, isDay: c.is_day === 1, observedAt: c.time * 1000, fetchedAt: now(), timezone: data.timezone,
        sun: d.sunrise.slice(0, 2).map((rise, i) => ({rise: Number.isFinite(rise) && rise > 0 ? rise * 1000 : null, set: Number.isFinite(d.sunset[i]) && d.sunset[i] > 0 ? d.sunset[i] * 1000 : null}))};
    })();
    cache.set(key, {at: now(), promise});
    while (cache.size > 64) cache.delete(cache.keys().next().value);
    try { return await promise; } catch (error) { if (cache.get(key)?.promise === promise) cache.delete(key); throw error; }
  };
}
module.exports = {createWeatherService};
