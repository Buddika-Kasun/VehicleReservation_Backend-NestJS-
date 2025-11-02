
import { User } from '../../database/entities/user.entity';

export function sanitizeUser(user: User): any {
  if (!user) return null;

  const { passwordHash, ...sanitizedUser } = user;

  // Add full URL for profile picture if it exists
  if (sanitizedUser.profilePicture) {
    sanitizedUser.profilePicture = getFullProfilePictureUrl(sanitizedUser.profilePicture);
  }

  return sanitizedUser;
}

export function sanitizeUsers(users: User[]): any[] {
  if (!users || !Array.isArray(users)) return [];
  
  return users.map(user => sanitizeUser(user));
}

export function getFullProfilePictureUrl(profilePicturePath: string): string {
  if (!profilePicturePath) return null;
  
  // If it's already a full URL, return as is
  if (profilePicturePath.startsWith('http')) {
    return profilePicturePath;
  }
  
  // Remove leading slash if present
  const cleanPath = profilePicturePath.startsWith('/') 
    ? profilePicturePath.substring(1) 
    : profilePicturePath;
  
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  return `${baseUrl}/${cleanPath}`;
}