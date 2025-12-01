import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CalculateRouteDto, VehicleType } from './dto/calculate-route.dto';

interface OSRMResponse {
  code: string;
  routes: Array<{
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
    distance: number;
    duration: number;
    legs: any[];
  }>;
  waypoints: any[];
}

@Injectable()
export class RoutesService {
  private readonly osrmBaseUrl = 'http://router.project-osrm.org';

  constructor(private readonly httpService: HttpService) {}

  async calculateRoute(calculateRouteDto: CalculateRouteDto): Promise<any> {
    const { points, vehicleType } = calculateRouteDto;

    if (points.length < 2) {
      throw new HttpException('At least 2 points are required', HttpStatus.BAD_REQUEST);
    }

    try {
      // Convert points to OSRM format: "lon,lat;lon,lat;..."
      const coordinates = points
        .map(point => `${point.longitude},${point.latitude}`)
        .join(';');

      const response = await firstValueFrom(
        this.httpService.get<OSRMResponse>(
          `${this.osrmBaseUrl}/route/v1/driving/${coordinates}`,
          {
            params: {
              overview: 'full',
              geometries: 'geojson',
              steps: 'true',
              annotations: 'true',
            },
          },
        ),
      );

      if (response.data.code !== 'Ok' || !response.data.routes.length) {
        throw new HttpException('No route found', HttpStatus.NOT_FOUND);
      }

      const route = response.data.routes[0];
      const coordinatesList = route.geometry.coordinates;

      // Transform to frontend format
      return {
        route: coordinatesList.map(coord => ({
          latitude: coord[1], // OSRM returns [lon, lat]
          longitude: coord[0],
        })),
        distance: route.distance, // meters
        duration: route.duration, // seconds
        legs: route.legs,
        waypoints: response.data.waypoints,
      };
    } catch (error) {
      console.error('OSRM API error:', error);
      
      // Fallback: Return straight line if OSRM fails
      return this.getStraightLineRoute(points);
    }
  }

  private getStraightLineRoute(points: any[]): any {
    const routePoints = [];
    
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      
      // Add start point
      routePoints.push({ latitude: start.latitude, longitude: start.longitude });
      
      // Add intermediate points for visualization
      const steps = 10;
      for (let j = 1; j < steps; j++) {
        const ratio = j / steps;
        const lat = start.latitude + (end.latitude - start.latitude) * ratio;
        const lng = start.longitude + (end.longitude - start.longitude) * ratio;
        routePoints.push({ latitude: lat, longitude: lng });
      }
    }
    
    // Add final point
    if (points.length > 0) {
      routePoints.push({ 
        latitude: points[points.length - 1].latitude, 
        longitude: points[points.length - 1].longitude 
      });
    }

    return {
      route: routePoints,
      distance: this.calculateStraightLineDistance(points),
      duration: this.calculateEstimatedDuration(points),
      legs: [],
      waypoints: points.map((point, index) => ({
        location: [point.longitude, point.latitude],
        name: `Waypoint ${index + 1}`,
      })),
      note: 'Straight line route (OSRM unavailable)',
    };
  }

  private calculateStraightLineDistance(points: any[]): number {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      totalDistance += this.haversineDistance(start, end);
    }
    return totalDistance;
  }

  private haversineDistance(point1: any, point2: any): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(point2.latitude - point1.latitude);
    const dLon = this.toRad(point2.longitude - point1.longitude);
    const lat1 = this.toRad(point1.latitude);
    const lat2 = this.toRad(point2.latitude);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateEstimatedDuration(points: any[]): number {
    const distance = this.calculateStraightLineDistance(points);
    const averageSpeed = 50; // km/h
    return (distance / 1000) / averageSpeed * 3600; // Convert to seconds
  }
}