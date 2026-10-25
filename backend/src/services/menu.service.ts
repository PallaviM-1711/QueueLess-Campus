import { Types } from 'mongoose';
import { Canteen } from '../models/Canteen';
import { MenuItem, type IMenuItem } from '../models/MenuItem';
import { User } from '../models/User';
import { createError } from '../middleware/errorHandler';

export interface MenuItemInput {
  name: string;
  description?: string;
  category: string;
  price: number;
  imageUrl?: string;
  isAvailable?: boolean;
  isVeg?: boolean;
  preparationTimeMinutes?: number;
}

export interface MenuFilters {
  search?: string;
  category?: string;
  isVeg?: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function listCanteens(universityId: string) {
  if (!Types.ObjectId.isValid(universityId)) {
    throw createError('Invalid university identifier', 400);
  }
  return Canteen.find({ university: universityId, isActive: true })
    .select('name description location imageUrl isOpen openingTime closingTime')
    .sort({ name: 1 })
    .lean();
}

export async function listCanteensForUser(userId: string, universityId: string) {
  const user = await User.findById(userId).select('university isActive isEmailVerified');
  if (!user || !user.isActive || !user.isEmailVerified) {
    throw createError('Your account is not active', 403);
  }
  if (user.university.toString() !== universityId) {
    throw createError('Your account access has changed; please sign in again', 401);
  }
  return listCanteens(universityId);
}

export async function getMenu(canteenId: string, filters: MenuFilters) {
  if (!Types.ObjectId.isValid(canteenId)) {
    throw createError('Invalid canteen identifier', 400);
  }
  const canteen = await Canteen.findOne({ _id: canteenId, isActive: true })
    .select('name university isOpen');
  if (!canteen) throw createError('Canteen not found', 404);

  const query: Record<string, unknown> = {
    canteen: canteen._id,
    isActive: true,
  };
  if (filters.category) query.category = new RegExp(`^${escapeRegex(filters.category)}$`, 'i');
  if (filters.isVeg !== undefined) query.isVeg = filters.isVeg;
  if (filters.search) {
    const search = new RegExp(escapeRegex(filters.search), 'i');
    query.$or = [{ name: search }, { description: search }];
  }

  const items = await MenuItem.find(query)
    .select('-__v')
    .sort({ category: 1, name: 1 })
    .lean();
  const categories = await MenuItem.distinct('category', {
    canteen: canteen._id,
    isActive: true,
  });
  return { canteen, items, categories: categories.sort((a, b) => a.localeCompare(b)) };
}

export async function createMenuItem(
  canteenId: string,
  input: MenuItemInput
): Promise<IMenuItem> {
  return MenuItem.create({ ...input, canteen: canteenId });
}

export async function updateMenuItem(
  canteenId: string,
  itemId: string,
  input: Partial<MenuItemInput>
): Promise<IMenuItem> {
  if (!Types.ObjectId.isValid(itemId)) throw createError('Invalid menu item identifier', 400);
  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, canteen: canteenId, isActive: true },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!item) throw createError('Menu item not found', 404);
  return item;
}

export async function deactivateMenuItem(canteenId: string, itemId: string): Promise<void> {
  if (!Types.ObjectId.isValid(itemId)) throw createError('Invalid menu item identifier', 400);
  const item = await MenuItem.findOneAndUpdate(
    { _id: itemId, canteen: canteenId, isActive: true },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!item) throw createError('Menu item not found', 404);
}
