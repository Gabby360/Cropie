// CROPIE — Supabase Authentication & Database Integration Architecture Module
import { supabase } from './supabase.js';

export class CropieAuthService {
  constructor() {
    this.supabase = supabase;
    this.LOCAL_USER_KEY = 'cropie_active_user_session';
  }

  // Retrieve current active Supabase user session
  async getCurrentUser() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error || !session) {
        const local = localStorage.getItem(this.LOCAL_USER_KEY);
        return local ? JSON.parse(local) : null;
      }
      
      const user = session.user;
      return {
        id: user.id,
        email: user.email,
        fullName: user.user_metadata?.full_name || user.email.split('@')[0],
        phone: user.user_metadata?.phone_number || ''
      };
    } catch (err) {
      console.warn('Supabase getSession notice:', err);
      const local = localStorage.getItem(this.LOCAL_USER_KEY);
      return local ? JSON.parse(local) : null;
    }
  }

  // Get User Profile from public.profiles table
  async getUserProfile(userId) {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.warn('Profile query notice:', error);
      }
      return data || null;
    } catch {
      return null;
    }
  }

  // Get User Farm from public.farms table
  async getUserFarm(userId) {
    try {
      const { data, error } = await this.supabase
        .from('farms')
        .select('*, crops(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (data && data.length > 0) {
        const farm = data[0];
        const primaryCrop = (farm.crops && farm.crops.length > 0) ? farm.crops[0] : null;

        return {
          id: farm.id,
          userId: farm.user_id,
          farmName: farm.farm_name || 'My Farm',
          locationName: farm.location_name || 'Ejura, Ashanti Region, Ghana',
          latitude: farm.latitude || 7.3824,
          longitude: farm.longitude || -1.3621,
          locationSource: farm.location_source || 'GPS',
          farmSize: farm.farm_size || 2,
          farmSizeUnit: farm.farm_size_unit || 'Acres',
          soilType: farm.soil_type || 'Loam',
          irrigationType: farm.irrigation_type || 'Rainfed',
          crop: primaryCrop ? primaryCrop.crop_name : 'maize',
          plantingDate: primaryCrop ? primaryCrop.planting_date : '2026-06-10',
          growthStage: primaryCrop ? primaryCrop.growth_stage : 'Flowering / Tasseling — Estimated'
        };
      }
      return null;
    } catch (err) {
      console.warn('Supabase farm query notice:', err);
      // Fallback local storage farm lookup
      try {
        const localFarms = JSON.parse(localStorage.getItem('cropie_farms')) || [];
        return localFarms.find(f => f.userId === userId) || null;
      } catch {
        return null;
      }
    }
  }

  // Sign Up User with Supabase Auth (Creates auth.users and triggers public.profiles)
  async registerUser({ fullName, email, password }) {
    if (!fullName || fullName.trim().length === 0) {
      throw new Error('Please enter your full name.');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password || password.length < 4) {
      throw new Error('Please enter a password with at least 4 characters.');
    }

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: fullName.trim()
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered') || error.status === 400) {
          throw new Error('This email is already registered. Please sign in instead.');
        }
        throw new Error(error.message || 'We couldn\'t create your account. Please try again.');
      }

      const user = data.user || data.session?.user;
      if (!user) {
        throw new Error('Account creation pending. Please check your email for confirmation.');
      }

      const activeUser = {
        id: user.id,
        email: user.email,
        fullName: fullName.trim()
      };

      localStorage.setItem(this.LOCAL_USER_KEY, JSON.stringify(activeUser));

      return {
        user: activeUser,
        message: 'Account created successfully.'
      };
    } catch (err) {
      console.warn('Supabase SignUp catch:', err);
      throw err;
    }
  }

  // Login User with Supabase Auth
  async loginUser({ emailOrPhone, password, rememberMe }) {
    if (!emailOrPhone || emailOrPhone.trim().length === 0) {
      throw new Error('Please enter your email address.');
    }

    if (!password || password.length === 0) {
      throw new Error('Please enter your password.');
    }

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email: emailOrPhone.trim().toLowerCase(),
        password: password
      });

      if (error) {
        if (error.message.includes('Invalid login credentials') || error.status === 400) {
          throw new Error('Incorrect email or password.');
        }
        throw new Error(error.message || 'Authentication failed. Please check your credentials.');
      }

      const user = data.user;
      const profile = await this.getUserProfile(user.id);
      
      const activeUser = {
        id: user.id,
        email: user.email,
        fullName: profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0]
      };

      localStorage.setItem(this.LOCAL_USER_KEY, JSON.stringify(activeUser));

      const farm = await this.getUserFarm(user.id);

      return {
        user: activeUser,
        hasFarm: !!farm,
        farm,
        message: 'Signed in successfully.'
      };
    } catch (err) {
      console.warn('Supabase Login catch:', err);
      throw err;
    }
  }

  // Save Farm & Crops to Supabase public.farms and public.crops
  async saveFarmProfile({ userId, farmName, locationName, latitude, longitude, locationSource, crop, crops, plantingDate, farmSize, farmSizeUnit }) {
    if (!userId) {
      const current = await this.getCurrentUser();
      if (current) userId = current.id;
      else throw new Error('User session expired. Please sign in again.');
    }

    if (!locationName || locationName.trim().length === 0) {
      throw new Error('Please provide or search for your farm location.');
    }

    const rawCrops = crops || (crop ? [crop] : []);
    const cropList = Array.isArray(rawCrops) && rawCrops.length > 0 
      ? rawCrops 
      : ['Maize'];

    if (!plantingDate) {
      throw new Error('Please select your planting date.');
    }

    const finalFarmName = farmName && farmName.trim().length > 0 ? farmName.trim() : 'My Farm';
    const numSize = farmSize ? parseFloat(farmSize) : 2;

    try {
      // 1. Insert into public.farms
      const farmPayload = {
        user_id: userId,
        farm_name: finalFarmName,
        location_name: locationName.trim(),
        latitude: latitude || 7.3824,
        longitude: longitude || -1.3621,
        farm_size: numSize,
        farm_size_unit: farmSizeUnit || 'Acres',
        soil_type: 'Loam',
        irrigation_type: 'Rainfed'
      };

      const { data: farmData, error: farmError } = await this.supabase
        .from('farms')
        .insert([farmPayload])
        .select()
        .single();

      let savedFarmId = farmData?.id;

      if (farmError) {
        console.warn('Supabase farm insert notice:', farmError);
        const { data: existingFarms } = await this.supabase
          .from('farms')
          .select('id')
          .eq('user_id', userId)
          .limit(1);

        if (existingFarms && existingFarms.length > 0) {
          savedFarmId = existingFarms[0].id;
          await this.supabase
            .from('farms')
            .update(farmPayload)
            .eq('id', savedFarmId);
        }
      }

      // 2. Insert each selected crop as an individual record in public.crops
      if (savedFarmId) {
        const cropPayloads = cropList.map(cName => ({
          farm_id: savedFarmId,
          crop_name: cName,
          variety: cName.toLowerCase() === 'maize' ? 'Obatanpa Quality Protein Maize' : 'Standard Variety',
          planting_date: plantingDate,
          growth_stage: cName.toLowerCase() === 'maize' ? 'Flowering / Tasseling' : 'Active Growth',
          area_planted: numSize,
          area_unit: farmSizeUnit || 'Acres',
          status: 'Active'
        }));

        const { error: cropError } = await this.supabase
          .from('crops')
          .insert(cropPayloads);

        if (cropError) {
          console.warn('Supabase crops insert notice:', cropError);
        }
      }

      // Local mirror backup for seamless UI rendering
      const farmProfile = {
        id: savedFarmId || ('farm_' + Date.now().toString(36)),
        userId,
        farmName: finalFarmName,
        locationName: locationName.trim(),
        latitude: latitude || 7.3824,
        longitude: longitude || -1.3621,
        locationSource: locationSource || 'Manual',
        crop: cropList[0].toLowerCase(),
        crops: cropList,
        plantingDate,
        farmSize: numSize,
        farmSizeUnit: farmSizeUnit || 'Acres',
        updatedAt: new Date().toISOString()
      };

      const localFarms = JSON.parse(localStorage.getItem('cropie_farms')) || [];
      const idx = localFarms.findIndex(f => f.userId === userId);
      if (idx >= 0) localFarms[idx] = farmProfile;
      else localFarms.push(farmProfile);
      localStorage.setItem('cropie_farms', JSON.stringify(localFarms));

      return {
        farm: farmProfile,
        message: 'Your farm is ready for Cropie.'
      };
    } catch (err) {
      console.warn('Supabase saveFarmProfile catch:', err);
      throw err;
    }
  }

  // Request Password Reset
  async requestPasswordReset(email) {
    if (!email || email.trim().length === 0) {
      throw new Error('Please enter your registered email address.');
    }

    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (error) throw error;
      return {
        message: 'Check your email for instructions to reset your password.'
      };
    } catch (err) {
      return {
        message: 'Check your email for instructions to reset your password.'
      };
    }
  }

  // Sign Out User
  async logout() {
    try {
      await this.supabase.auth.signOut();
    } catch (err) {
      console.warn('Logout notice:', err);
    } finally {
      localStorage.removeItem(this.LOCAL_USER_KEY);
      sessionStorage.removeItem(this.LOCAL_USER_KEY);
    }
  }
}
