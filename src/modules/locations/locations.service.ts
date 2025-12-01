import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosResponse } from 'axios';

interface NominatimLocation {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  category: string;
  type: string;
  place_rank: number;
  importance: number;
  addresstype: string;
  name: string;
  display_name: string;
  address: any;
  boundingbox: string[];
}

@Injectable()
export class LocationsService {
  private readonly nominatimBaseUrl = 'https://nominatim.openstreetmap.org';

  constructor(private readonly httpService: HttpService) {}

  async searchLocations(query: string, countrycodes: string = 'lk'): Promise<any[]> {
    if (!query || query.length < 2) {
      throw new HttpException('Query must be at least 2 characters long', HttpStatus.BAD_REQUEST);
    }

    try {
      const response: AxiosResponse<NominatimLocation[]> = await firstValueFrom(
        this.httpService.get(`${this.nominatimBaseUrl}/search`, {
          params: {
            q: query.trim(),
            format: 'json',
            addressdetails: 1,
            limit: 10,
            countrycodes: countrycodes,
            'accept-language': 'en',
            autocomplete: 1,
          },
          headers: {
            'User-Agent': 'VehicleReservationApp/1.0',
          },
        }),
      );

      // Transform the response to match your frontend expectations
      return response.data.map(location => ({
        display_name: location.display_name,
        lat: location.lat,
        lon: location.lon,
        type: location.type,
        address: location.address,
        boundingbox: location.boundingbox,
      }));
    } catch (error) {
      console.error('Nominatim API error:', error);
      throw new HttpException(
        'Failed to search locations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Add reverse geocode method
  async reverseGeocode(lat: number, lon: number): Promise<any> {
    if (!lat || !lon) {
      throw new HttpException('Latitude and longitude are required', HttpStatus.BAD_REQUEST);
    }

    try {
      const response: AxiosResponse<any> = await firstValueFrom(
        this.httpService.get(`${this.nominatimBaseUrl}/reverse`, {
          params: {
            lat: lat,
            lon: lon,
            format: 'json',
            addressdetails: 1,
            'accept-language': 'en',
          },
          headers: {
            'User-Agent': 'VehicleReservationApp/1.0',
          },
        }),
      );

      // Transform the response
      return {
        display_name: response.data.display_name,
        lat: response.data.lat,
        lon: response.data.lon,
        type: response.data.type,
        address: response.data.address,
        boundingbox: response.data.boundingbox,
      };
    } catch (error) {
      console.error('Nominatim reverse geocode API error:', error);
      throw new HttpException(
        'Failed to reverse geocode location',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  
}