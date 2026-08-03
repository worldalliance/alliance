import { Injectable } from '@nestjs/common';
import { City } from './city.entity';
import type { Repository } from 'src/utils/Repository';
import { InjectRepository } from '@nestjs/typeorm';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(City)
    private cityRepository: Repository<City>,
  ) {}

  async collectCityIds(filePath: string): Promise<Set<number>> {
    const ids = new Set<number>();

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line || line.startsWith('#')) continue;
      const geonameid = line.split('\t', 2)[0];
      if (!geonameid) continue;
      ids.add(parseInt(geonameid, 10));
    }

    return ids;
  }

  async loadCountryDataFromTxt(): Promise<Record<string, string>> {
    const filePath = path.join(__dirname, 'countryInfo.txt');
    const countries: Record<string, string> = {};
    const data = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const lines = data.split('\n').filter((line) => !line.startsWith('#'));
    for (const line of lines) {
      const [ISO, _ISO3, _ISO_NUMERIC, _fips, country] = line.split('\t', 5);
      countries[ISO] = country;
    }
    return countries;
  }

  async loadEnglishNamesForIds(ids: Set<number>): Promise<Map<number, string>> {
    const filePath = path.join(__dirname, 'alternateNames.txt');
    const english = new Map<number, string>();

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line) continue;
      const cols = line.split('\t');
      // GeoNames: [alternateNameId, geonameid, isolanguage, alternateName, isPreferredName, ...]
      const geonameid = cols[1];
      const isolanguage = cols[2];
      const altName = cols[3];
      const isPreferred = cols[4] === '1';

      if (isolanguage !== 'en' || !geonameid || !altName) continue;

      const id = parseInt(geonameid, 10);
      if (!ids.has(id)) continue;

      // prefer preferred name if present; otherwise first seen
      if (!english.has(id) || isPreferred) {
        english.set(id, altName);
      }
    }

    return english;
  }

  async loadCityDataFromTxt(): Promise<void> {
    const citiesPath = path.join(__dirname, 'cities5000.txt');

    const countries = await this.loadCountryDataFromTxt();

    const ids = await this.collectCityIds(citiesPath);
    const englishNames = await this.loadEnglishNamesForIds(ids);

    const stream = fs.createReadStream(citiesPath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const batch: City[] = [];
    const BATCH_SIZE = 500;

    for await (const line of rl) {
      if (!line || line.startsWith('#')) continue;

      const cols = line.split('\t');
      const geonameid = cols[0];
      if (!geonameid) continue;

      const id = parseInt(geonameid, 10);

      const name = cols[1];
      const asciiname = cols[2];
      const latitude = cols[4];
      const longitude = cols[5];
      const countryCode = cols[8];
      const admin1 = cols[10];
      const admin2 = cols[11];

      batch.push({
        id,
        name,
        countryCode,
        admin1,
        admin2,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        countryName: countries[countryCode],
        asciiName: asciiname,
        englishName: englishNames.get(id) ?? null,
      });

      if (batch.length >= BATCH_SIZE) {
        await this.cityRepository.save(batch);
        batch.length = 0;
      }
    }

    if (batch.length) {
      await this.cityRepository.save(batch);
    }
  }

  async searchCity(
    query: string,
    latitude?: number,
    longitude?: number,
  ): Promise<City[]> {
    const qb = this.cityRepository
      .createQueryBuilder('c')
      .where('(c.name ILIKE :q OR c.englishName ILIKE :q)', {
        q: `%${query}%`,
      });

    if (latitude != null && longitude != null) {
      qb.orderBy(
        '( (c.latitude  - :lat) * (c.latitude  - :lat) ' +
          '+ (c.longitude - :lon) * (c.longitude - :lon) )',
        'ASC',
      ).setParameters({ lat: latitude, lon: longitude });
    } else {
      qb.orderBy('c.name', 'ASC');
    }

    const cities = await qb.limit(10).getMany();
    return cities;
  }
}
