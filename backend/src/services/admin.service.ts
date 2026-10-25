import { Types } from 'mongoose';
import { Canteen } from '../models/Canteen';
import { User } from '../models/User';
import { University } from '../models/University';
import { createError } from '../middleware/errorHandler';
import { UserRole } from '../types/enums';

export interface CanteenInput {
  name: string;
  description?: string;
  location?: string;
  imageUrl?: string;
  openingTime?: string;
  closingTime?: string;
  isOpen?: boolean;
}

export async function listAdminCanteens(universityId: string) {
  return Canteen.find({ university: universityId }).sort({ name: 1 });
}

export async function createAdminCanteen(
  universityId: string,
  input: CanteenInput
) {
  if (!Types.ObjectId.isValid(universityId)) {
    throw createError('Invalid university identifier', 400);
  }
  const university = await University.findOne({ _id: universityId, isActive: true });
  if (!university) throw createError('University is not active', 404);
  if (await Canteen.exists({ university: universityId, name: input.name })) {
    throw createError('A canteen with this name already exists', 409);
  }
  return Canteen.create({ ...input, university: university._id });
}

export async function updateAdminCanteen(
  universityId: string,
  canteenId: string,
  input: Partial<CanteenInput>
) {
  if (!Types.ObjectId.isValid(canteenId)) {
    throw createError('Invalid canteen identifier', 400);
  }
  const canteen = await Canteen.findOneAndUpdate(
    { _id: canteenId, university: universityId },
    { $set: input },
    { new: true, runValidators: true }
  );
  if (!canteen) throw createError('Canteen not found', 404);
  return canteen;
}

export async function listAdminStaff(universityId: string) {
  return User.find({
    university: universityId,
    role: { $in: [UserRole.STAFF, UserRole.CANTEEN_ADMIN] },
  })
    .select('name email role university canteen isEmailVerified isActive createdAt')
    .populate('canteen', 'name')
    .sort({ createdAt: -1 });
}

export async function updateAdminStaff(
  universityId: string,
  staffId: string,
  input: { canteenId?: string; isActive?: boolean }
) {
  if (!Types.ObjectId.isValid(staffId)) {
    throw createError('Invalid staff identifier', 400);
  }
  const staff = await User.findOne({
    _id: staffId,
    university: universityId,
    role: { $in: [UserRole.STAFF, UserRole.CANTEEN_ADMIN] },
  });
  if (!staff) throw createError('Staff account not found', 404);

  if (input.canteenId) {
    const canteen = await Canteen.findOne({
      _id: input.canteenId,
      university: universityId,
      isActive: true,
    });
    if (!canteen) throw createError('Canteen not found in your university', 404);
    staff.canteen = canteen._id;
  }
  if (input.isActive !== undefined) staff.isActive = input.isActive;
  await staff.save();
  return staff;
}
