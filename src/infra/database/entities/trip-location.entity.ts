// trip-location.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Trip } from './trip.entity';

@Entity()
export class TripLocation {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Trip, trip => trip.location)
  @JoinColumn()
  trip: Trip;

  // Start location
  @Column('decimal', { precision: 10, scale: 8 })
  startLatitude: number;

  @Column('decimal', { precision: 11, scale: 8 })
  startLongitude: number;

  @Column({ length: 255 })
  startAddress: string;

  // End location
  @Column('decimal', { precision: 10, scale: 8 })
  endLatitude: number;

  @Column('decimal', { precision: 11, scale: 8 })
  endLongitude: number;

  @Column({ length: 255 })
  endAddress: string;

  // Intermediate stops (stored as JSON)
  @Column('jsonb', { default: [] })
  intermediateStops: Array<{
    latitude: number;
    longitude: number;
    address: string;
    order: number;
  }>;

  @Column({ type: 'int', default: 0 })
  totalStops: number;

  // Complete location data including route
  @Column('jsonb', { nullable: true })
  locationData?: any;

  // Calculated distance in km
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  distance: number;

  // Estimated duration in minutes
  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  estimatedDuration: number;
}